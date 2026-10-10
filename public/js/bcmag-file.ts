import { PROJECT_SCHEMA_VERSION, deserializeProject, serializeProject } from './project-model.js';

export const BCMAG_MAGIC = 'BCMAG';
export const BCMAG_ENVELOPE_VERSION = 1;
export const BCMAG_MIME_TYPE = 'application/x-bcmag';

const MAX_FILE_BYTES = 75 * 1024 * 1024;
const MAX_ENTRY_COUNT = 128;
const MAX_DECODED_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FONT_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 16384;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const IMAGE_SIGNATURES = {
  'image/png': (bytes) => startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10]),
  'image/jpeg': (bytes) => startsWith(bytes, [255, 216, 255]),
  'image/gif': (bytes) => ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a',
  'image/webp': (bytes) => ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP',
};

const FONT_SIGNATURES = {
  'font/woff2': (bytes) => ascii(bytes, 0, 4) === 'wOF2',
  'font/woff': (bytes) => ascii(bytes, 0, 4) === 'wOFF',
  'font/ttf': (bytes) => startsWith(bytes, [0, 1, 0, 0]),
  'font/otf': (bytes) => ascii(bytes, 0, 4) === 'OTTO',
};

const ERRORS = {
  invalid: 'Bu dosya geçerli bir BCMAG projesi değil.',
  future: 'Bu proje daha yeni bir sürümle oluşturulmuş.',
  size: 'Proje dosyası izin verilen boyutu aşıyor.',
  integrity: 'Proje dosyası bozuk veya değiştirilmiş.',
  missing: 'Projede gereken bir görsel ya da font eksik.',
};

function fail(kind) {
  throw new Error(ERRORS[kind]);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBlobLike(value) {
  return (
    value &&
    typeof value === 'object' &&
    Number.isFinite(value.size) &&
    typeof value.arrayBuffer === 'function'
  );
}

function startsWith(bytes, signature) {
  return (
    bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
  );
}

function ascii(bytes, start, end) {
  if (bytes.length < end) return '';
  let result = '';
  for (let index = start; index < end; index += 1) {
    result += String.fromCharCode(bytes[index]);
  }
  return result;
}

function validName(value) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 255 &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  );
}

function validId(value) {
  return typeof value === 'string' && OPAQUE_ID_PATTERN.test(value);
}

function validSize(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validDimension(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_IMAGE_DIMENSION;
}

function assertCrypto(cryptoLike) {
  if (typeof cryptoLike?.subtle?.digest !== 'function') fail('invalid');
  return cryptoLike;
}

function encodeBase64(bytes) {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const combined = (first << 16) | (second << 8) | third;
    result += BASE64_ALPHABET[(combined >>> 18) & 63];
    result += BASE64_ALPHABET[(combined >>> 12) & 63];
    result += index + 1 < bytes.length ? BASE64_ALPHABET[(combined >>> 6) & 63] : '=';
    result += index + 2 < bytes.length ? BASE64_ALPHABET[combined & 63] : '=';
  }
  return result;
}

function decodedBase64Size(value) {
  if (typeof value !== 'string' || value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) {
    fail('invalid');
  }
  if (value.length === 0) return 0;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function decodeBase64(value) {
  const size = decodedBase64Size(value);
  const result = new Uint8Array(size);
  let outputIndex = 0;

  for (let index = 0; index < value.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(value[index]);
    const second = BASE64_ALPHABET.indexOf(value[index + 1]);
    const third = value[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 2]);
    const fourth = value[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 3]);
    const combined = (first << 18) | (second << 12) | (third << 6) | fourth;
    if (outputIndex < size) result[outputIndex++] = (combined >>> 16) & 255;
    if (outputIndex < size) result[outputIndex++] = (combined >>> 8) & 255;
    if (outputIndex < size) result[outputIndex++] = combined & 255;
  }

  return result;
}

async function sha256Hex(bytes, cryptoLike) {
  const digest = await cryptoLike.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function manifestBytes(manifest) {
  return new TextEncoder().encode(JSON.stringify(manifest));
}

function referencedAssetIds(project) {
  const ids = [];
  if (project.canvas.background.type === 'image' && project.canvas.background.assetId) {
    ids.push(project.canvas.background.assetId);
  }
  for (const layer of project.layers) {
    if (layer?.kind === 'image' && layer.assetId) ids.push(layer.assetId);
  }
  return new Set(ids);
}

function referencedFontIds(project) {
  return new Set(project.fonts.map(({ id }) => id));
}

function sameIds(expected, actual) {
  return expected.size === actual.size && [...expected].every((id) => actual.has(id));
}

function assertUniqueEntries(entries) {
  const ids = new Set();
  for (const entry of entries) {
    if (!isPlainObject(entry) || !validId(entry.id) || ids.has(entry.id)) fail('invalid');
    ids.add(entry.id);
  }
  return ids;
}

function assertEnvelopeLimits(assets, fonts) {
  if (assets.length + fonts.length > MAX_ENTRY_COUNT) fail('size');
  let totalBytes = 0;
  for (const entry of assets) {
    if (!isPlainObject(entry) || !validSize(entry.size)) fail('invalid');
    if (entry.size > MAX_IMAGE_BYTES) fail('size');
    totalBytes += entry.size;
  }
  for (const entry of fonts) {
    if (!isPlainObject(entry) || !validSize(entry.size)) fail('invalid');
    if (entry.size > MAX_FONT_BYTES) fail('size');
    totalBytes += entry.size;
  }
  if (totalBytes > MAX_DECODED_BYTES) fail('size');
}

function assertSignature(type, bytes, signatures) {
  const verify = signatures[type];
  if (!verify || !verify(bytes)) fail('invalid');
}

function assertImageMetadata(entry) {
  if (
    !validName(entry.name) ||
    typeof entry.type !== 'string' ||
    !validDimension(entry.width) ||
    !validDimension(entry.height)
  ) {
    fail('invalid');
  }
}

function assertFontMetadata(entry) {
  if (!validName(entry.name) || !validName(entry.family) || typeof entry.type !== 'string') {
    fail('invalid');
  }
}

function assertReferenceSets(project, assets, fonts) {
  const assetIds = assertUniqueEntries(assets);
  const fontIds = assertUniqueEntries(fonts);
  const referencedAssets = referencedAssetIds(project);
  const referencedFonts = referencedFontIds(project);

  if ([...referencedAssets].some((id) => !assetIds.has(id))) fail('missing');
  if ([...referencedFonts].some((id) => !fontIds.has(id))) fail('missing');
  if (!sameIds(referencedAssets, assetIds) || !sameIds(referencedFonts, fontIds)) fail('invalid');
}

function normalizeForImport(manifest, declaredVersion) {
  if (!Number.isInteger(declaredVersion) || declaredVersion < 1) fail('invalid');
  if (declaredVersion > PROJECT_SCHEMA_VERSION) fail('future');
  if (!isPlainObject(manifest)) fail('invalid');
  const manifestVersion = Object.prototype.hasOwnProperty.call(manifest, 'schemaVersion')
    ? manifest.schemaVersion
    : 1;
  if (!Number.isInteger(manifestVersion) || manifestVersion < 1) fail('invalid');
  if (manifestVersion > PROJECT_SCHEMA_VERSION) fail('future');
  if (manifestVersion !== declaredVersion) fail('invalid');

  try {
    return deserializeProject(JSON.stringify(manifest));
  } catch (error) {
    if (/unsupported project version/i.test(error?.message ?? '')) fail('future');
    fail('invalid');
  }
}

async function prepareEntry(entry, kind, cryptoLike) {
  if (!isBlobLike(entry.blob) || entry.blob.size !== entry.size) fail('invalid');
  if (entry.blob.type !== entry.type) fail('invalid');
  if (kind === 'asset') assertImageMetadata(entry);
  else assertFontMetadata(entry);

  const bytes = new Uint8Array(await entry.blob.arrayBuffer());
  if (bytes.byteLength !== entry.size) fail('invalid');
  assertSignature(entry.type, bytes, kind === 'asset' ? IMAGE_SIGNATURES : FONT_SIGNATURES);
  const common = {
    id: entry.id,
    name: entry.name.trim(),
    type: entry.type,
    size: entry.size,
  };
  return {
    ...(kind === 'asset'
      ? { ...common, width: entry.width, height: entry.height }
      : { ...common, family: entry.family.trim() }),
    sha256: await sha256Hex(bytes, cryptoLike),
    data: encodeBase64(bytes),
  };
}

function assertFontManifestMatches(project, fonts) {
  const metadataById: any = new Map(project.fonts.map((font) => [font.id, font]));
  for (const font of fonts) {
    const metadata = metadataById.get(font.id);
    if (
      !metadata ||
      metadata.name !== font.name.trim() ||
      metadata.family !== font.family.trim() ||
      metadata.type !== font.type ||
      metadata.size !== font.size
    ) {
      fail('invalid');
    }
  }
}

export async function createBcmagFile({
  project,
  assets = [],
  fonts = [],
  savedAt = Date.now(),
  crypto = globalThis.crypto,
}: any = {}) {
  const cryptoLike = assertCrypto(crypto);
  if (!Array.isArray(assets) || !Array.isArray(fonts)) fail('invalid');
  if (!Number.isSafeInteger(savedAt) || savedAt < 0) fail('invalid');

  let manifest;
  try {
    manifest = deserializeProject(serializeProject(project));
  } catch (error) {
    if (/unsupported project version/i.test(error?.message ?? '')) fail('future');
    fail('invalid');
  }

  assertEnvelopeLimits(assets, fonts);
  assertReferenceSets(manifest, assets, fonts);
  assertFontManifestMatches(manifest, fonts);

  const sortedAssets = [...assets].sort((left, right) => left.id.localeCompare(right.id));
  const sortedFonts = [...fonts].sort((left, right) => left.id.localeCompare(right.id));
  const encodedAssets = [];
  const encodedFonts = [];
  for (const asset of sortedAssets) {
    encodedAssets.push(await prepareEntry(asset, 'asset', cryptoLike));
  }
  for (const font of sortedFonts) {
    encodedFonts.push(await prepareEntry(font, 'font', cryptoLike));
  }

  const envelope = {
    magic: BCMAG_MAGIC,
    envelopeVersion: BCMAG_ENVELOPE_VERSION,
    projectSchemaVersion: manifest.schemaVersion,
    savedAt,
    manifest,
    assets: encodedAssets,
    fonts: encodedFonts,
    integrity: {
      manifestSha256: await sha256Hex(manifestBytes(manifest), cryptoLike),
    },
  };
  const file = new Blob([JSON.stringify(envelope)], { type: BCMAG_MIME_TYPE });
  if (file.size > MAX_FILE_BYTES) fail('size');
  return file;
}

async function decodeEntry(entry, kind, cryptoLike) {
  if (kind === 'asset') assertImageMetadata(entry);
  else assertFontMetadata(entry);
  if (!SHA256_PATTERN.test(entry.sha256 ?? '')) fail('invalid');
  const decodedSize = decodedBase64Size(entry.data);
  if (decodedSize !== entry.size) fail('integrity');
  const bytes = decodeBase64(entry.data);
  if ((await sha256Hex(bytes, cryptoLike)) !== entry.sha256) fail('integrity');
  assertSignature(entry.type, bytes, kind === 'asset' ? IMAGE_SIGNATURES : FONT_SIGNATURES);

  return {
    id: entry.id,
    name: entry.name.trim(),
    ...(kind === 'asset'
      ? { type: entry.type, size: entry.size, width: entry.width, height: entry.height }
      : { family: entry.family.trim(), type: entry.type, size: entry.size }),
    blob: new Blob([bytes], { type: entry.type }),
  };
}

export async function readBcmagFile(file, { crypto = globalThis.crypto } = {}) {
  const cryptoLike = assertCrypto(crypto);
  if (!file || !Number.isFinite(file.size) || file.size < 0 || typeof file.text !== 'function') {
    fail('invalid');
  }
  if (file.size > MAX_FILE_BYTES) fail('size');

  let envelope;
  try {
    envelope = JSON.parse(await file.text());
  } catch {
    fail('invalid');
  }
  if (!isPlainObject(envelope) || envelope.magic !== BCMAG_MAGIC) fail('invalid');
  if (!Number.isInteger(envelope.envelopeVersion) || envelope.envelopeVersion < 1) fail('invalid');
  if (envelope.envelopeVersion > BCMAG_ENVELOPE_VERSION) fail('future');
  if (!Number.isSafeInteger(envelope.savedAt) || envelope.savedAt < 0) fail('invalid');
  if (!Array.isArray(envelope.assets) || !Array.isArray(envelope.fonts)) fail('invalid');
  if (!isPlainObject(envelope.integrity)) fail('invalid');

  assertEnvelopeLimits(envelope.assets, envelope.fonts);
  const project = normalizeForImport(envelope.manifest, envelope.projectSchemaVersion);
  assertReferenceSets(project, envelope.assets, envelope.fonts);
  assertFontManifestMatches(project, envelope.fonts);
  if (!SHA256_PATTERN.test(envelope.integrity.manifestSha256 ?? '')) fail('invalid');
  if (
    (await sha256Hex(manifestBytes(envelope.manifest), cryptoLike)) !==
    envelope.integrity.manifestSha256
  ) {
    fail('integrity');
  }

  const assets = [];
  const fonts = [];
  for (const entry of envelope.assets) {
    assets.push(await decodeEntry(entry, 'asset', cryptoLike));
  }
  for (const entry of envelope.fonts) {
    fonts.push(await decodeEntry(entry, 'font', cryptoLike));
  }

  return { project, assets, fonts, savedAt: envelope.savedAt };
}
