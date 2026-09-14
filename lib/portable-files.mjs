import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const AREA_NAMES = new Set(['workspace', 'media', 'plugins']);
const MAX_FILES = 5000;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
const MAX_FILE_BYTES = 16 * 1024 * 1024;

function safeRelativePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('The backup contains an unsafe file path.');
  }
  return normalized;
}

function inside(root, relativePath) {
  const target = path.resolve(root, relativePath);
  const relative = path.relative(path.resolve(root), target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('The backup file path escapes its private data area.');
  return target;
}

async function visit(root, current, area, output, totals) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await visit(root, absolute, area, output, totals);
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(absolute);
    if (stat.size > MAX_FILE_BYTES) throw new Error(`${entry.name} is larger than the 16 MB portable-backup limit.`);
    totals.files += 1;
    totals.bytes += stat.size;
    if (totals.files > MAX_FILES || totals.bytes > MAX_TOTAL_BYTES) throw new Error('Private files exceed the 48 MB portable-backup limit. Move large files out of the workspace and try again.');
    const bytes = await fs.readFile(absolute);
    output.push({
      area,
      path: path.relative(root, absolute).replace(/\\/g, '/'),
      size: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      data: bytes.toString('base64')
    });
  }
}

export async function collectPortableFiles(roots) {
  const files = [];
  const totals = { files: 0, bytes: 0 };
  for (const area of AREA_NAMES) {
    const root = roots[area];
    if (!root) throw new Error(`Missing backup root for ${area}.`);
    await fs.mkdir(root, { recursive: true });
    await visit(root, root, area, files, totals);
  }
  return { areas: [...AREA_NAMES], files, totals };
}

function validateFileRecord(record, totals) {
  if (!record || !AREA_NAMES.has(record.area)) throw new Error('The backup contains an unknown private data area.');
  const relativePath = safeRelativePath(record.path);
  if (typeof record.data !== 'string' || record.data.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 16) throw new Error('A backup file is too large or unreadable.');
  const bytes = Buffer.from(record.data, 'base64');
  if (bytes.length > MAX_FILE_BYTES || bytes.length !== Number(record.size)) throw new Error('A backup file has an invalid size.');
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(String(record.sha256)) || digest !== record.sha256) throw new Error('A backup file failed its integrity check.');
  totals.files += 1;
  totals.bytes += bytes.length;
  if (totals.files > MAX_FILES || totals.bytes > MAX_TOTAL_BYTES) throw new Error('The backup exceeds the portable-file safety limits.');
  return { area: record.area, relativePath, bytes };
}

export async function restorePortableFiles(bundle, roots) {
  if (!bundle) return { restored: false, files: 0, bytes: 0 };
  if (!Array.isArray(bundle.areas) || bundle.areas.some((area) => !AREA_NAMES.has(area)) || !Array.isArray(bundle.files)) throw new Error('The backup private-file bundle is invalid.');
  const totals = { files: 0, bytes: 0 };
  const records = bundle.files.map((record) => validateFileRecord(record, totals));
  const transactionId = crypto.randomUUID();
  const prepared = new Map();
  const moved = [];
  try {
    for (const area of AREA_NAMES) {
      const target = roots[area];
      const temporary = `${target}.restore-${transactionId}`;
      await fs.mkdir(temporary, { recursive: true });
      prepared.set(area, temporary);
    }
    for (const record of records) {
      const output = inside(prepared.get(record.area), record.relativePath);
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, record.bytes, { mode: 0o600 });
    }
    for (const area of AREA_NAMES) {
      const target = path.resolve(roots[area]);
      const previous = `${target}.restore-previous`;
      const temporary = prepared.get(area);
      await fs.rm(previous, { recursive: true, force: true });
      const item = { target, previous, movedCurrent: false, installed: false };
      moved.push(item);
      try { await fs.rename(target, previous); item.movedCurrent = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await fs.rename(temporary, target);
      item.installed = true;
    }
    return { restored: true, files: totals.files, bytes: totals.bytes };
  } catch (error) {
    for (const item of moved.reverse()) {
      if (item.installed) await fs.rm(item.target, { recursive: true, force: true }).catch(() => {});
      if (item.movedCurrent) await fs.rename(item.previous, item.target).catch(() => {});
    }
    throw error;
  } finally {
    for (const temporary of prepared.values()) await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
  }
}

export async function rollbackPortableFiles(roots) {
  const transactionId = crypto.randomUUID();
  const moved = [];
  let rolledBack = 0;
  try {
    for (const area of AREA_NAMES) {
      if (!roots[area]) throw new Error(`Missing backup root for ${area}.`);
      const target = path.resolve(roots[area]);
      const previous = `${target}.restore-previous`;
      const currentBackup = `${target}.rollback-current-${transactionId}`;
      try {
        await fs.access(previous);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      moved.push({ target, previous, currentBackup, movedCurrent: false, movedPrevious: false });
      const item = moved.at(-1);
      await fs.rm(currentBackup, { recursive: true, force: true });
      try {
        await fs.rename(target, currentBackup);
        item.movedCurrent = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await fs.rename(previous, target);
      item.movedPrevious = true;
      rolledBack += 1;
    }
    return { rolledBack };
  } catch (error) {
    for (const item of moved.reverse()) {
      if (item.movedPrevious) await fs.rename(item.target, item.previous).catch(() => {});
      if (item.movedCurrent) await fs.rename(item.currentBackup, item.target).catch(() => {});
    }
    throw error;
  }
}

export const portableFileLimits = Object.freeze({ maxFiles: MAX_FILES, maxTotalBytes: MAX_TOTAL_BYTES, maxFileBytes: MAX_FILE_BYTES });
