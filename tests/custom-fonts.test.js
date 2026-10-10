import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomFontService, validateFontFile } from '../public/js/custom-fonts.ts';

const SIGNATURES = {
  'font/woff2': [0x77, 0x4f, 0x46, 0x32],
  'font/woff': [0x77, 0x4f, 0x46, 0x46],
  'font/ttf': [0x00, 0x01, 0x00, 0x00],
  'font/otf': [0x4f, 0x54, 0x54, 0x4f],
};

function fontFile(type = 'font/woff2', options = {}) {
  const canonicalType = options.signatureType ?? type;
  const bytes = options.bytes ?? [...SIGNATURES[canonicalType], 1, 2, 3, 4];
  const blob = new globalThis.Blob([new Uint8Array(bytes)], { type });
  Object.defineProperty(blob, 'name', { value: options.name ?? 'user-font' });
  return blob;
}

function fontRecord(id, options = {}) {
  const type = options.type ?? 'font/woff2';
  const blob = options.blob ?? fontFile(type, { name: `${id}.woff2` });
  return {
    id,
    family: options.family ?? `Family ${id}`,
    name: options.name ?? blob.name,
    type,
    size: blob.size,
    blob,
  };
}

function createFaceHarness(options = {}) {
  const faces = [];
  const FontFace = vi.fn(function FakeFontFace(family, source) {
    const face = {
      family,
      source,
      load: vi.fn(async () => {
        if (options.failFamily === family) throw new Error('font decode failed');
        options.onLoad?.(family);
        return face;
      }),
    };
    faces.push(face);
    return face;
  });
  return { FontFace, faces };
}

function createDatabase(overrides = {}) {
  return {
    putFont: vi.fn(async () => {}),
    getFonts: vi.fn(async () => []),
    deleteFont: vi.fn(async () => {}),
    ...overrides,
  };
}

function createFontSet(calls = []) {
  return {
    add: vi.fn((face) => {
      calls.push(`add:${face.family}`);
      return face;
    }),
    delete: vi.fn((face) => {
      calls.push(`delete:${face.family}`);
      return true;
    }),
  };
}

describe('font file validation', () => {
  it.each([
    ['font/woff2', 'font/woff2'],
    ['font/woff', 'font/woff'],
    ['application/font-woff', 'font/woff'],
    ['font/ttf', 'font/ttf'],
    ['font/otf', 'font/otf'],
    ['application/font-sfnt', 'font/ttf'],
    ['application/font-sfnt', 'font/otf'],
  ])('accepts %s with a real %s signature', async (declaredType, signatureType) => {
    await expect(
      validateFontFile(fontFile(declaredType, { signatureType }))
    ).resolves.toMatchObject({ valid: true, type: signatureType });
  });

  it('rejects a MIME/signature mismatch and unsupported MIME aliases', async () => {
    await expect(
      validateFontFile(fontFile('font/woff2', { signatureType: 'font/ttf' }))
    ).resolves.toMatchObject({ valid: false });
    await expect(
      validateFontFile(fontFile('application/octet-stream', { signatureType: 'font/woff2' }))
    ).resolves.toMatchObject({ valid: false });
  });

  it('rejects empty, truncated, and over-5-MiB files', async () => {
    await expect(validateFontFile(fontFile('font/woff2', { bytes: [] }))).resolves.toMatchObject({
      valid: false,
    });
    await expect(
      validateFontFile(fontFile('font/woff2', { bytes: [0x77, 0x4f, 0x46] }))
    ).resolves.toMatchObject({ valid: false });

    const oversized = new globalThis.Blob([new Uint8Array(5 * 1024 * 1024 + 1)], {
      type: 'font/woff2',
    });
    Object.defineProperty(oversized, 'name', { value: 'large.woff2' });
    await expect(validateFontFile(oversized)).resolves.toMatchObject({ valid: false });
  });
});

describe('custom font service', () => {
  let database;
  let fontSet;
  let FontFace;
  let faces;

  beforeEach(() => {
    database = createDatabase();
    fontSet = createFontSet();
    ({ FontFace, faces } = createFaceHarness());
  });

  it.each(['', '   ', 'bad\nfamily', 'x'.repeat(65)])(
    'rejects an unsafe family name %j',
    async (family) => {
      const service = createCustomFontService({ database, fontSet, FontFace });
      await expect(service.add(fontFile(), family)).rejects.toThrow(/font/i);
      expect(FontFace).not.toHaveBeenCalled();
      expect(database.putFont).not.toHaveBeenCalled();
    }
  );

  it('loads and activates before persistence while keeping a stable opaque ID', async () => {
    const calls = [];
    fontSet = createFontSet(calls);
    database.putFont.mockImplementation(async (record) => {
      calls.push('persist');
      expect(record).not.toHaveProperty('face');
    });
    ({ FontFace, faces } = createFaceHarness({
      onLoad: (family) => calls.push(`load:${family}`),
    }));
    const service = createCustomFontService({
      database,
      fontSet,
      FontFace,
      createId: () => 'font-stable-1',
    });

    const runtime = await service.add(fontFile(), ' Rol Fontu ');

    expect(calls).toEqual(['load:Rol Fontu', 'add:Rol Fontu', 'persist']);
    expect(runtime).toMatchObject({
      id: 'font-stable-1',
      family: 'Rol Fontu',
      name: 'user-font',
      type: 'font/woff2',
    });
    expect(database.putFont.mock.calls[0][0]).toMatchObject({ id: 'font-stable-1' });
    expect(service.get('font-stable-1')).toMatchObject({ id: 'font-stable-1' });
    expect(service.list()).toHaveLength(1);
  });

  it('does not persist or activate a face that fails to decode', async () => {
    ({ FontFace } = createFaceHarness({ failFamily: 'Bozuk Font' }));
    const service = createCustomFontService({ database, fontSet, FontFace });

    await expect(service.add(fontFile(), 'Bozuk Font')).rejects.toThrow(/font/i);
    expect(database.putFont).not.toHaveBeenCalled();
    expect(fontSet.add).not.toHaveBeenCalled();
    expect(service.list()).toEqual([]);
  });

  it('removes an activated face when persistence fails', async () => {
    database.putFont.mockRejectedValue(new Error('database failed'));
    const service = createCustomFontService({ database, fontSet, FontFace });

    await expect(service.add(fontFile(), 'Rol Fontu')).rejects.toThrow('database failed');
    expect(fontSet.add).toHaveBeenCalledOnce();
    expect(fontSet.delete).toHaveBeenCalledWith(faces[0]);
    expect(service.list()).toEqual([]);
  });

  it('stages loaded faces without activation, then commits and rolls back as a unit', async () => {
    const service = createCustomFontService({ database, fontSet, FontFace });
    const records = [fontRecord('font-1'), fontRecord('font-2')];

    const staged = await service.stage(records);
    expect(faces.every((face) => face.load.mock.calls.length === 1)).toBe(true);
    expect(fontSet.add).not.toHaveBeenCalled();

    const committed = await staged.commit();
    expect(committed.map(({ id }) => id)).toEqual(['font-1', 'font-2']);
    expect(service.list().map(({ id }) => id)).toEqual(['font-1', 'font-2']);

    await staged.rollback();
    expect(fontSet.delete).toHaveBeenCalledTimes(2);
    expect(service.list()).toEqual([]);
  });

  it('replaces a same-id runtime font and restores it on rollback', async () => {
    const service = createCustomFontService({ database, fontSet, FontFace });
    const original = fontRecord('font-1');
    const replacement = fontRecord('font-1', {
      blob: fontFile('font/woff2', { bytes: [...SIGNATURES['font/woff2'], 9, 9, 9, 9] }),
    });
    const first = await service.stage([original]);
    await first.commit();
    await first.finalize();

    const staged = await service.stage([replacement]);
    await staged.commit();
    expect(service.get('font-1').blob).toBe(replacement.blob);
    await staged.rollback();
    expect(service.get('font-1').blob).toBe(original.blob);
  });

  it('leaves no partial activation when one hydrated face fails', async () => {
    const records = [fontRecord('font-1'), fontRecord('font-2')];
    database.getFonts.mockResolvedValue(records);
    ({ FontFace } = createFaceHarness({ failFamily: 'Family font-2' }));
    const service = createCustomFontService({ database, fontSet, FontFace });

    await expect(
      service.hydrate(
        records.map(({ id, family, name, type, size }) => ({
          id,
          family,
          name,
          type,
          size,
        }))
      )
    ).rejects.toThrow(/font/i);
    expect(fontSet.add).not.toHaveBeenCalled();
    expect(service.list()).toEqual([]);
  });

  it('rolls back every staged face when activation fails partway through commit', async () => {
    fontSet.add
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('activation failed');
      });
    const service = createCustomFontService({ database, fontSet, FontFace });
    const staged = await service.stage([fontRecord('font-1'), fontRecord('font-2')]);

    await expect(staged.commit()).rejects.toThrow('activation failed');
    expect(fontSet.delete).toHaveBeenCalledTimes(2);
    expect(service.list()).toEqual([]);
  });

  it('hydrates referenced IDs without changing their persisted identity', async () => {
    const records = [fontRecord('font-2'), fontRecord('font-1')];
    database.getFonts.mockImplementation(async (ids) =>
      ids.map((id) => records.find((record) => record.id === id)).filter(Boolean)
    );
    const service = createCustomFontService({ database, fontSet, FontFace });
    const metadata = records.map(({ id, family, name, type, size }) => ({
      id,
      family,
      name,
      type,
      size,
    }));

    const hydrated = await service.hydrate(metadata);

    expect(database.getFonts).toHaveBeenCalledWith(['font-2', 'font-1']);
    expect(hydrated.map(({ id }) => id)).toEqual(['font-2', 'font-1']);
    expect(database.putFont).not.toHaveBeenCalled();
  });

  it('rejects hydration when a referenced record is missing or metadata changed', async () => {
    const record = fontRecord('font-1');
    database.getFonts.mockResolvedValue([record]);
    const service = createCustomFontService({ database, fontSet, FontFace });

    await expect(
      service.hydrate([
        {
          id: 'font-1',
          family: record.family,
          name: record.name,
          type: record.type,
          size: record.size,
        },
        { id: 'missing', family: 'Missing', name: 'm', type: 'font/woff2', size: 8 },
      ])
    ).rejects.toThrow(/font/i);
    await expect(
      service.hydrate([
        {
          id: 'font-1',
          family: 'Changed',
          name: record.name,
          type: record.type,
          size: record.size,
        },
      ])
    ).rejects.toThrow(/font/i);
    expect(fontSet.add).not.toHaveBeenCalled();
  });

  it('prevents removal while referenced and preserves runtime state on database failure', async () => {
    const referenced = new Set(['font-1']);
    const service = createCustomFontService({
      database,
      fontSet,
      FontFace,
      isReferenced: (id) => referenced.has(id),
      createId: () => 'font-1',
    });
    await service.add(fontFile(), 'Rol Fontu');

    await expect(service.remove('font-1')).rejects.toThrow(/kullanılıyor/i);
    expect(database.deleteFont).not.toHaveBeenCalled();
    referenced.clear();
    database.deleteFont.mockRejectedValueOnce(new Error('delete failed'));
    await expect(service.remove('font-1')).rejects.toThrow('delete failed');
    expect(service.get('font-1')).toBeDefined();
    expect(fontSet.delete).not.toHaveBeenCalled();
  });

  it('uses the active browser project as the default removal guard', async () => {
    vi.stubGlobal('window', {
      ChatlogProject: {
        getSnapshot: () => ({
          chat: { font: 'Rol Fontu' },
          fonts: [{ id: 'font-1', family: 'Rol Fontu' }],
        }),
      },
    });
    try {
      const service = createCustomFontService({
        database,
        fontSet,
        FontFace,
        createId: () => 'font-1',
      });
      await service.add(fontFile(), 'Rol Fontu');

      await expect(service.remove('font-1')).rejects.toThrow(/kullanılıyor/i);
      expect(database.deleteFont).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('deletes persistence before removing a face and clears runtime faces locally', async () => {
    const calls = [];
    fontSet = createFontSet(calls);
    database.deleteFont.mockImplementation(async () => calls.push('delete-record'));
    const service = createCustomFontService({
      database,
      fontSet,
      FontFace,
      createId: () => 'font-1',
    });
    await service.add(fontFile(), 'Rol Fontu');
    calls.length = 0;

    await service.remove('font-1');
    expect(calls).toEqual(['delete-record', 'delete:Rol Fontu']);
    expect(service.get('font-1')).toBeUndefined();

    const second = createCustomFontService({
      database,
      fontSet,
      FontFace,
      createId: () => 'font-2',
    });
    await second.add(fontFile(), 'İkinci Font');
    database.deleteFont.mockClear();
    second.clear();
    expect(database.deleteFont).not.toHaveBeenCalled();
    expect(second.list()).toEqual([]);
  });
});
