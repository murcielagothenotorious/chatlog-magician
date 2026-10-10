import { assertOpaqueAssetId } from './canvas-scene.js';

const MAX_CANVAS_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CANVAS_IMAGE_WIDTH = 7680;
const MAX_CANVAS_IMAGE_HEIGHT = 4320;
const MAX_CANVAS_IMAGE_PIXELS = MAX_CANVAS_IMAGE_WIDTH * MAX_CANVAS_IMAGE_HEIGHT;
const SUPPORTED_CANVAS_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

function defaultCreateId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function defaultCreateObjectURL(blob) {
  return globalThis.URL.createObjectURL(blob);
}

function defaultRevokeObjectURL(objectUrl) {
  globalThis.URL.revokeObjectURL(objectUrl);
}

function loadImage(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image();
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error('Image could not be decoded'));
    image.src = objectUrl;
  });
}

async function defaultDecodeImage(blob, objectUrl) {
  if (typeof globalThis.createImageBitmap === 'function') {
    const bitmap = await globalThis.createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }
  return loadImage(objectUrl);
}

function releaseRuntimeRecord(record, revokeObjectURL) {
  let firstError;
  try {
    if (typeof record.source?.close === 'function') record.source.close();
  } catch (error) {
    firstError = error;
  }
  try {
    revokeObjectURL(record.objectUrl);
  } catch (error) {
    firstError ??= error;
  }
  if (firstError) throw firstError;
}

function validateDecodedDimensions(decoded) {
  const width = Number(decoded?.width);
  const height = Number(decoded?.height);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_CANVAS_IMAGE_WIDTH ||
    height > MAX_CANVAS_IMAGE_HEIGHT ||
    width * height > MAX_CANVAS_IMAGE_PIXELS
  ) {
    throw new TypeError('Image dimensions must be within 7680 × 4320 pixels');
  }
  return { width, height };
}

export function validateCanvasImageFile(file) {
  if (!SUPPORTED_CANVAS_IMAGE_TYPES.has(file?.type)) {
    return { valid: false, error: 'File must be a supported image type' };
  }
  if (!Number.isFinite(file?.size) || file.size < 0 || file.size > MAX_CANVAS_IMAGE_BYTES) {
    return { valid: false, error: 'Image must not exceed 10 MB' };
  }
  return { valid: true };
}

export function createCanvasAssetRegistry(options: any = {}) {
  const decodeImage = options.decodeImage ?? defaultDecodeImage;
  const createObjectURL = options.createObjectURL ?? defaultCreateObjectURL;
  const revokeObjectURL = options.revokeObjectURL ?? defaultRevokeObjectURL;
  const createId = options.createId ?? defaultCreateId;
  const assets = new Map();

  async function prepareRecord(blob, suppliedMetadata: any = {}, replaceExisting = false) {
    const id = assertOpaqueAssetId(suppliedMetadata.id);
    const expectedExisting = assets.get(id);
    if (expectedExisting && !replaceExisting) throw new Error(`Canvas asset already exists: ${id}`);
    if (suppliedMetadata.type && blob?.type && suppliedMetadata.type !== blob.type) {
      throw new TypeError('Stored image type does not match the Blob type');
    }

    const input = {
      type: blob?.type || suppliedMetadata.type,
      size: blob?.size,
    };
    const validation = validateCanvasImageFile(input);
    if (!validation.valid) throw new TypeError(validation.error);

    const objectUrl = createObjectURL(blob);
    let decoded;
    try {
      decoded = await decodeImage(blob, objectUrl);
      const dimensions = validateDecodedDimensions(decoded);
      const metadata = {
        id,
        name:
          typeof suppliedMetadata.name === 'string' && suppliedMetadata.name.length > 0
            ? suppliedMetadata.name
            : typeof blob?.name === 'string' && blob.name.length > 0
              ? blob.name
              : 'image',
        type: input.type,
        size: blob.size,
        width: dimensions.width,
        height: dimensions.height,
      };
      const runtimeRecord = Object.freeze({
        ...metadata,
        blob,
        objectUrl,
        source: decoded.source,
      });
      let activated = false;
      let disposed = false;
      let finalized = false;

      return {
        metadata: { ...metadata },
        activate() {
          if (disposed) throw new Error(`Prepared canvas asset was disposed: ${id}`);
          if (activated) return { ...metadata };
          if (assets.get(id) !== expectedExisting) {
            throw new Error(`Canvas asset already exists: ${id}`);
          }
          assets.set(id, runtimeRecord);
          activated = true;
          return { ...metadata };
        },
        dispose() {
          if (activated || disposed) return false;
          disposed = true;
          releaseRuntimeRecord(runtimeRecord, revokeObjectURL);
          return true;
        },
        rollback() {
          if (!activated || finalized || disposed) return false;
          if (assets.get(id) === runtimeRecord) {
            if (expectedExisting) assets.set(id, expectedExisting);
            else assets.delete(id);
          }
          disposed = true;
          releaseRuntimeRecord(runtimeRecord, revokeObjectURL);
          return true;
        },
        finalize() {
          if (!activated || finalized || disposed) return false;
          finalized = true;
          if (expectedExisting) releaseRuntimeRecord(expectedExisting, revokeObjectURL);
          return true;
        },
      };
    } catch (error) {
      try {
        releaseRuntimeRecord({ source: decoded?.source, objectUrl }, revokeObjectURL);
      } catch {
        // Preserve the validation/decode failure while still attempting both cleanup operations.
      }
      throw error;
    }
  }

  function prepareWithId(blob, suppliedMetadata = {}) {
    return prepareRecord(blob, suppliedMetadata, false);
  }

  function prepareReplacementWithId(blob, suppliedMetadata = {}) {
    return prepareRecord(blob, suppliedMetadata, true);
  }

  async function addWithId(blob, metadata) {
    const prepared = await prepareWithId(blob, metadata);
    try {
      return prepared.activate();
    } catch (error) {
      try {
        prepared.dispose();
      } catch {
        // Preserve the activation error.
      }
      throw error;
    }
  }

  function add(file) {
    return addWithId(file, {
      id: createId(),
      name: file?.name,
      type: file?.type,
      size: file?.size,
    });
  }

  function get(assetId) {
    return assets.get(assetId);
  }

  function has(assetId) {
    return assets.has(assetId);
  }

  function metadata(assetId) {
    const record = assets.get(assetId);
    if (!record) return undefined;
    const { id, name, type, size, width, height } = record;
    return { id, name, type, size, width, height };
  }

  function listMetadata() {
    return [...assets.keys()].map((assetId) => metadata(assetId));
  }

  function remove(assetId) {
    const record = assets.get(assetId);
    if (!record) return false;

    assets.delete(assetId);
    releaseRuntimeRecord(record, revokeObjectURL);
    return true;
  }

  function clear() {
    const removedCount = assets.size;
    let firstError;
    for (const assetId of [...assets.keys()]) {
      try {
        remove(assetId);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
    return removedCount;
  }

  return {
    add,
    addWithId,
    prepareWithId,
    prepareReplacementWithId,
    get,
    metadata,
    listMetadata,
    remove,
    clear,
    has,
  };
}
