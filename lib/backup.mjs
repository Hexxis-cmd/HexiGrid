import crypto from 'node:crypto';

const VERSION = 1;
const KDF = 'scrypt';
const CIPHER = 'aes-256-gcm';
const FORMAT = 'hexigrid-backup';
const LEGACY_FORMAT = 'aveniq-backup';

function asBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

export function encryptBackup(payload, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Use a backup passphrase with at least 12 characters.');
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const cipher = crypto.createCipheriv(CIPHER, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    format: FORMAT, version: VERSION, kdf: KDF, cipher: CIPHER,
    salt: salt.toString('base64url'), iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'), data: ciphertext.toString('base64url'),
    createdAt: new Date().toISOString()
  };
}

export function decryptBackup(envelope, passphrase) {
  if (!envelope || ![FORMAT, LEGACY_FORMAT].includes(envelope.format) || envelope.version !== VERSION || envelope.kdf !== KDF || envelope.cipher !== CIPHER) throw new Error('That file is not a supported HexiGrid backup.');
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Enter the backup passphrase used when this file was created.');
  try {
    const salt = Buffer.from(envelope.salt, 'base64url');
    const iv = Buffer.from(envelope.iv, 'base64url');
    const tag = Buffer.from(envelope.tag, 'base64url');
    const key = crypto.scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
    const decipher = crypto.createDecipheriv(CIPHER, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(asBuffer(Buffer.from(envelope.data, 'base64url'))), decipher.final()]);
    const payload = JSON.parse(plaintext.toString('utf8'));
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.agents) || !Array.isArray(payload.rooms)) throw new Error('The backup contents are invalid.');
    return payload;
  } catch (error) {
    if (error.message === 'The backup contents are invalid.') throw error;
    throw new Error('The passphrase is incorrect or the backup was damaged.');
  }
}
