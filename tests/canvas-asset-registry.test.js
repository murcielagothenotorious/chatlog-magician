import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanvasAssetRegistry, validateCanvasImageFile } from '../public/js/canvas-asset-registry.ts';

const TEN_MEGABYTES = 10 * 1024 * 1024;

function imageFile(overrides = {}) {
  return {
    name: 'scene.png',
    type: 'image/png',
    size: 100,
    ...overrides,
  };
}

function registryOptions(overrides = {}) {
  return {
    createObjectURL: vi.fn(() => 'blob:runtime-only'),
    revokeObjectURL: vi.fn(),
    decodeImage: vi.fn(async () => ({
      source: { width: 800, height: 600 },
      width: 800,
      height: 600,
    })),
    createId: vi.fn(() => 'asset-1'),
    ...overrides,
  };
}

describe('canvas asset validation', () => {
  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])(
    'accepts %s images up to 10 MB',
    (type) => {
      expect(validateCanvasImageFile(imageFile({ type, size: TEN_MEGABYTES })).valid).toBe(true);
    }
  );

  it.each(['image/svg+xml', 'image/jpg', 'IMAGE/PNG', '', 'text/plain'])(
    'rejects unsupported type %s',
    (type) => {
      expect(validateCanvasImageFile(imageFile({ type })).valid).toBe(false);
    }
  );

  it('rejects images larger than 10 MB', () => {
    expect(validateCanvasImageFile(imageFile({ size: TEN_MEGABYTES + 1 })).valid).toBe(false);
  });
});

describe('canvas asset registry', () => {
  it('prepares and activates a decoded blob with its stable opaque ID', async () => {
    const options = registryOptions({
      decodeImage: vi.fn(async () => ({
        source: { width: 20, height: 10 },
        width: 20,
        height: 10,
      })),
    });
    const registry = createCanvasAssetRegistry(options);
    const blob = new globalThis.Blob(['png'], { type: 'image/png' });

    const prepared = await registry.prepareWithId(blob, {
      id: 'stable-asset',
      name: 'scene.png',
      type: 'image/png',
      size: 999,
      width: 1,
      height: 1,
    });

    expect(registry.has('stable-asset')).toBe(false);
    expect(prepared.metadata).toEqual({
      id: 'stable-asset',
      name: 'scene.png',
      type: 'image/png',
      size: blob.size,
      width: 20,
      height: 10,
    });
    expect(prepared.activate()).toEqual(prepared.metadata);
    expect(prepared.activate()).toEqual(prepared.metadata);
    expect(registry.metadata('stable-asset')).toEqual(prepared.metadata);
    expect(registry.listMetadata()).toEqual([prepared.metadata]);
  });

  it('disposes an unactivated prepared record exactly once', async () => {
    const source = { width: 20, height: 10, close: vi.fn() };
    const options = registryOptions({
      decodeImage: vi.fn(async () => ({ source, width: 20, height: 10 })),
    });
    const registry = createCanvasAssetRegistry(options);
    const prepared = await registry.prepareWithId(
      new globalThis.Blob(['png'], { type: 'image/png' }),
      { id: 'stable-asset', name: 'scene.png' }
    );

    expect(prepared.dispose()).toBe(true);
    expect(prepared.dispose()).toBe(false);
    expect(() => prepared.activate()).toThrow(/disposed/i);
    expect(source.close).toHaveBeenCalledOnce();
    expect(options.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('rejects existing stable IDs before creating transient resources', async () => {
    const options = registryOptions();
    const registry = createCanvasAssetRegistry(options);
    const blob = new globalThis.Blob(['png'], { type: 'image/png' });
    await registry.addWithId(blob, { id: 'stable-asset', name: 'scene.png' });
    options.createObjectURL.mockClear();
    options.decodeImage.mockClear();

    await expect(
      registry.prepareWithId(blob, { id: 'stable-asset', name: 'duplicate.png' })
    ).rejects.toThrow(/already exists/i);

    expect(options.createObjectURL).not.toHaveBeenCalled();
    expect(options.decodeImage).not.toHaveBeenCalled();
  });

  it('rejects stored MIME metadata that disagrees with the blob before decoding', async () => {
    const options = registryOptions();
    const registry = createCanvasAssetRegistry(options);
    const blob = new globalThis.Blob(['not-an-image'], { type: 'text/plain' });

    await expect(
      registry.prepareWithId(blob, {
        id: 'stable-asset',
        name: 'forged.png',
        type: 'image/png',
      })
    ).rejects.toThrow(/type/i);

    expect(options.createObjectURL).not.toHaveBeenCalled();
    expect(options.decodeImage).not.toHaveBeenCalled();
  });

  it.each([
    [{ width: 0, height: 100 }, /dimensions/i],
    [{ width: Number.NaN, height: 100 }, /dimensions/i],
    [{ width: 7681, height: 100 }, /dimensions/i],
    [{ width: 7680, height: 4321 }, /dimensions/i],
  ])(
    'rejects unsafe decoded image dimensions %o and releases resources',
    async (dimensions, error) => {
      const source = { close: vi.fn() };
      const options = registryOptions({
        decodeImage: vi.fn(async () => ({ source, ...dimensions })),
      });
      const registry = createCanvasAssetRegistry(options);

      await expect(registry.add(imageFile())).rejects.toThrow(error);

      expect(source.close).toHaveBeenCalledOnce();
      expect(options.revokeObjectURL).toHaveBeenCalledWith('blob:runtime-only');
      expect(registry.has('asset-1')).toBe(false);
    }
  );

  it('returns public metadata while retaining a frozen runtime record by opaque ID', async () => {
    const file = imageFile();
    const source = { width: 800, height: 600 };
    const options = registryOptions({
      decodeImage: vi.fn(async () => ({ source, width: 800, height: 600 })),
    });
    const registry = createCanvasAssetRegistry(options);

    const metadata = await registry.add(file);

    expect(metadata).toEqual({
      id: 'asset-1',
      name: 'scene.png',
      type: 'image/png',
      size: 100,
      width: 800,
      height: 600,
    });
    expect(Object.keys(metadata)).toEqual(['id', 'name', 'type', 'size', 'width', 'height']);
    expect(registry.get('asset-1')).toEqual({
      ...metadata,
      blob: file,
      objectUrl: 'blob:runtime-only',
      source,
    });
    expect(Object.isFrozen(registry.get('asset-1'))).toBe(true);
    expect(registry.has('asset-1')).toBe(true);
    expect(options.decodeImage).toHaveBeenCalledWith(file, 'blob:runtime-only');
  });

  it('rejects invalid files before creating runtime resources', async () => {
    const options = registryOptions();
    const registry = createCanvasAssetRegistry(options);

    await expect(registry.add(imageFile({ type: 'image/svg+xml' }))).rejects.toThrow(
      /supported image/i
    );
    expect(options.createObjectURL).not.toHaveBeenCalled();
    expect(options.decodeImage).not.toHaveBeenCalled();
  });

  it('revokes the object URL and closes the source on removal', async () => {
    const source = { width: 800, height: 600, close: vi.fn() };
    const options = registryOptions({
      decodeImage: vi.fn(async () => ({ source, width: 800, height: 600 })),
    });
    const registry = createCanvasAssetRegistry(options);
    await registry.add(imageFile());

    expect(registry.remove('asset-1')).toBe(true);
    expect(options.revokeObjectURL).toHaveBeenCalledWith('blob:runtime-only');
    expect(source.close).toHaveBeenCalledOnce();
    expect(registry.has('asset-1')).toBe(false);
    expect(registry.get('asset-1')).toBeUndefined();
    expect(registry.remove('asset-1')).toBe(false);
    expect(options.revokeObjectURL).toHaveBeenCalledOnce();
    expect(source.close).toHaveBeenCalledOnce();
  });

  it('clears every asset once and returns the removed count', async () => {
    const firstSource = { close: vi.fn() };
    const secondSource = { close: vi.fn() };
    const options = registryOptions({
      createObjectURL: vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second'),
      decodeImage: vi
        .fn()
        .mockResolvedValueOnce({ source: firstSource, width: 10, height: 20 })
        .mockResolvedValueOnce({ source: secondSource, width: 30, height: 40 }),
      createId: vi.fn().mockReturnValueOnce('asset-1').mockReturnValueOnce('asset-2'),
    });
    const registry = createCanvasAssetRegistry(options);
    await registry.add(imageFile());
    await registry.add(imageFile({ name: 'second.webp', type: 'image/webp' }));

    expect(registry.clear()).toBe(2);
    expect(options.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(options.revokeObjectURL).toHaveBeenCalledWith('blob:first');
    expect(options.revokeObjectURL).toHaveBeenCalledWith('blob:second');
    expect(firstSource.close).toHaveBeenCalledOnce();
    expect(secondSource.close).toHaveBeenCalledOnce();
    expect(registry.clear()).toBe(0);
  });

  it('continues clearing remaining assets before rethrowing the first cleanup error', async () => {
    const firstSource = {
      close: vi.fn(() => {
        throw new Error('close failed');
      }),
    };
    const secondSource = { close: vi.fn() };
    const options = registryOptions({
      createObjectURL: vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second'),
      decodeImage: vi
        .fn()
        .mockResolvedValueOnce({ source: firstSource, width: 10, height: 20 })
        .mockResolvedValueOnce({ source: secondSource, width: 30, height: 40 }),
      createId: vi.fn().mockReturnValueOnce('asset-1').mockReturnValueOnce('asset-2'),
    });
    const registry = createCanvasAssetRegistry(options);
    await registry.add(imageFile());
    await registry.add(imageFile({ name: 'second.webp', type: 'image/webp' }));

    expect(() => registry.clear()).toThrow('close failed');
    expect(registry.has('asset-1')).toBe(false);
    expect(registry.has('asset-2')).toBe(false);
    expect(secondSource.close).toHaveBeenCalledOnce();
    expect(options.revokeObjectURL).toHaveBeenCalledWith('blob:second');
  });

  it('cleans up the object URL when decoding fails', async () => {
    const decodeError = new Error('decode failed');
    const options = registryOptions({
      decodeImage: vi.fn(async () => {
        throw decodeError;
      }),
    });
    const registry = createCanvasAssetRegistry(options);

    await expect(registry.add(imageFile())).rejects.toBe(decodeError);
    expect(options.revokeObjectURL).toHaveBeenCalledWith('blob:runtime-only');
    expect(registry.has('asset-1')).toBe(false);
  });

  it('rejects an invalid generated ID before allocating runtime resources', async () => {
    const source = { close: vi.fn() };
    const options = registryOptions({
      decodeImage: vi.fn(async () => ({ source, width: 10, height: 20 })),
      createId: vi.fn(() => 'blob:not-opaque'),
    });
    const registry = createCanvasAssetRegistry(options);

    await expect(registry.add(imageFile())).rejects.toThrow(/opaque token/i);
    expect(options.createObjectURL).not.toHaveBeenCalled();
    expect(options.decodeImage).not.toHaveBeenCalled();
    expect(options.revokeObjectURL).not.toHaveBeenCalled();
    expect(source.close).not.toHaveBeenCalled();
  });

  it('does not decode or overwrite an asset when a generated ID collides', async () => {
    const firstSource = { close: vi.fn() };
    const duplicateSource = { close: vi.fn() };
    const options = registryOptions({
      createObjectURL: vi
        .fn()
        .mockReturnValueOnce('blob:first')
        .mockReturnValueOnce('blob:duplicate'),
      decodeImage: vi
        .fn()
        .mockResolvedValueOnce({ source: firstSource, width: 10, height: 20 })
        .mockResolvedValueOnce({ source: duplicateSource, width: 30, height: 40 }),
    });
    const registry = createCanvasAssetRegistry(options);
    await registry.add(imageFile());

    await expect(registry.add(imageFile({ name: 'duplicate.png' }))).rejects.toThrow(
      /already exists/i
    );
    expect(registry.get('asset-1').source).toBe(firstSource);
    expect(options.createObjectURL).toHaveBeenCalledOnce();
    expect(options.decodeImage).toHaveBeenCalledOnce();
    expect(options.revokeObjectURL).not.toHaveBeenCalled();
    expect(duplicateSource.close).not.toHaveBeenCalled();
    expect(firstSource.close).not.toHaveBeenCalled();
  });
});

describe('default browser image decoder', () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalImage = globalThis.Image;

  afterEach(() => {
    if (originalCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = originalCreateImageBitmap;

    if (originalImage === undefined) delete globalThis.Image;
    else globalThis.Image = originalImage;
  });

  it('prefers createImageBitmap and records its dimensions', async () => {
    const bitmap = { width: 64, height: 32, close: vi.fn() };
    globalThis.createImageBitmap = vi.fn(async () => bitmap);
    const file = imageFile();
    const registry = createCanvasAssetRegistry({
      createObjectURL: vi.fn(() => 'blob:bitmap'),
      revokeObjectURL: vi.fn(),
      createId: vi.fn(() => 'asset-bitmap'),
    });

    await expect(registry.add(file)).resolves.toMatchObject({ width: 64, height: 32 });
    expect(globalThis.createImageBitmap).toHaveBeenCalledWith(file);
    expect(registry.get('asset-bitmap').source).toBe(bitmap);
  });

  it('falls back to loading an Image from the object URL', async () => {
    delete globalThis.createImageBitmap;
    class FakeImage {
      naturalWidth = 320;
      naturalHeight = 180;

      set src(value) {
        this.currentSrc = value;
        Promise.resolve().then(() => this.onload());
      }
    }
    globalThis.Image = FakeImage;
    const registry = createCanvasAssetRegistry({
      createObjectURL: vi.fn(() => 'blob:image'),
      revokeObjectURL: vi.fn(),
      createId: vi.fn(() => 'asset-image'),
    });

    await expect(registry.add(imageFile())).resolves.toMatchObject({ width: 320, height: 180 });
    expect(registry.get('asset-image').source).toBeInstanceOf(FakeImage);
    expect(registry.get('asset-image').source.currentSrc).toBe('blob:image');
  });
});
