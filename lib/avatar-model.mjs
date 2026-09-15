const MAX_MODEL_BYTES = 8 * 1024 * 1024;
const JSON_CHUNK = 0x4E4F534A;

function hasExternalUri(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasExternalUri);
  return Object.entries(value).some(([key, child]) => key === 'uri' || hasExternalUri(child));
}

export function validateAvatarModelData(value) {
  const match = /^data:model\/gltf-binary;base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ''));
  if (!match) throw new Error('Choose a self-contained GLB 3D model.');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length < 20 || bytes.length > MAX_MODEL_BYTES) throw new Error('The 3D avatar must be smaller than 8 MB.');
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('The file is not a valid GLB 2.0 model.');
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== JSON_CHUNK || jsonLength < 2 || 20 + jsonLength > bytes.length) throw new Error('The GLB model has an invalid scene description.');
  let document;
  try { document = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).replace(/\u0000+$/g, '').trim()); }
  catch { throw new Error('The GLB scene description could not be read.'); }
  if (hasExternalUri(document)) throw new Error('The 3D avatar must be self-contained and cannot load outside files or URLs.');
  return { bytes, mimeType: 'model/gltf-binary' };
}

export const avatarModelLimits = Object.freeze({ maxBytes: MAX_MODEL_BYTES });
