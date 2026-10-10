const MAX_FONT_BYTES = 5 * 1024 * 1024;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SIGNATURES = [
  { type: 'font/woff2', bytes: [0x77, 0x4f, 0x46, 0x32] },
  { type: 'font/woff', bytes: [0x77, 0x4f, 0x46, 0x46] },
  { type: 'font/ttf', bytes: [0x00, 0x01, 0x00, 0x00] },
  { type: 'font/otf', bytes: [0x4f, 0x54, 0x54, 0x4f] },
];
const DECLARED_TYPES = new Map([
  ['font/woff2', new Set(['font/woff2'])],
  ['font/woff', new Set(['font/woff'])],
  ['application/font-woff', new Set(['font/woff'])],
  ['font/ttf', new Set(['font/ttf'])],
  ['font/otf', new Set(['font/otf'])],
  ['application/font-sfnt', new Set(['font/ttf', 'font/otf'])],
]);

function validationError(error) {
  return { valid: false, error };
}

function signatureType(bytes) {
  return SIGNATURES.find(({ bytes: signature }) =>
    signature.every((value, index) => bytes[index] === value)
  )?.type;
}

function containsControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
}

function normalizeFamily(value) {
  if (typeof value !== 'string') throw new TypeError('Geçersiz özel font ailesi.');
  const family = value.trim();
  if (!family || family.length > 64 || containsControlCharacter(family)) {
    throw new TypeError('Geçersiz özel font ailesi.');
  }
  return family;
}

function defaultCreateId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `font-${globalThis.crypto.randomUUID()}`;
  }
  return `font-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function defaultIsReferenced(id) {
  const snapshot = (globalThis.window?.ChatlogProject as any)?.getSnapshot?.();
  const font = Array.isArray(snapshot?.fonts) && snapshot.fonts.find((entry) => entry?.id === id);
  return Boolean(
    font &&
    (snapshot?.chat?.font === font.family ||
      snapshot?.blocks?.some((block) => block?.style?.font === font.family))
  );
}

function publicRuntime(record) {
  return { ...record };
}

function persistentRecord(record) {
  const { face: _face, ...persistent } = record;
  return persistent;
}

function sameMetadata(record, metadata) {
  return ['id', 'family', 'name', 'type', 'size'].every(
    (property) => record[property] === metadata[property]
  );
}

async function prepareRuntime(record, FontFaceClass) {
  if (!record || typeof record !== 'object' || !OPAQUE_ID_PATTERN.test(record.id ?? '')) {
    throw new TypeError('Geçersiz özel font kaydı.');
  }
  const family = normalizeFamily(record.family);
  if (typeof record.name !== 'string' || !record.name || containsControlCharacter(record.name)) {
    throw new TypeError('Geçersiz özel font adı.');
  }
  if (!record.blob || record.blob.size !== record.size) {
    throw new TypeError('Geçersiz özel font verisi.');
  }

  const validationBlob = record.blob.slice(0, record.blob.size, record.type);
  const validation = await validateFontFile(validationBlob);
  if (!validation.valid || validation.type !== record.type) {
    throw new TypeError('Geçersiz özel font biçimi.');
  }

  let face;
  try {
    face = new FontFaceClass(family, await record.blob.arrayBuffer());
    face = await face.load();
  } catch (error) {
    throw new Error('Özel font yüklenemedi.', { cause: error });
  }

  return {
    id: record.id,
    family,
    name: record.name,
    type: validation.type,
    size: record.size,
    blob: record.blob,
    face,
  };
}

export async function validateFontFile(file): Promise<any> {
  if (!file || typeof file.slice !== 'function' || !Number.isFinite(file.size)) {
    return validationError('Geçersiz font dosyası.');
  }
  if (file.size < 4 || file.size > MAX_FONT_BYTES) {
    return validationError('Font dosyası boş, eksik veya 5 MiB sınırını aşıyor.');
  }

  const allowedSignatures = DECLARED_TYPES.get(String(file.type ?? '').toLowerCase());
  if (!allowedSignatures) return validationError('Desteklenmeyen font MIME türü.');

  try {
    const prefix = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const type = signatureType(prefix);
    if (!type || !allowedSignatures.has(type)) {
      return validationError('Font MIME türü ile dosya imzası eşleşmiyor.');
    }
    return { valid: true, type, size: file.size };
  } catch {
    return validationError('Font dosyası okunamadı.');
  }
}

export function createCustomFontService(options: any = {}) {
  const {
    database,
    fontSet = globalThis.document?.fonts,
    FontFace: FontFaceClass = globalThis.FontFace,
    createId = defaultCreateId,
    isReferenced = defaultIsReferenced,
  } = options;
  if (!database?.putFont || !database?.getFonts || !database?.deleteFont) {
    throw new TypeError('Özel font servisi yerel veritabanı gerektirir.');
  }
  if (!fontSet?.add || !fontSet?.delete || typeof FontFaceClass !== 'function') {
    throw new TypeError('Bu tarayıcı özel fontları etkinleştiremiyor.');
  }

  const runtimeRecords = new Map();

  async function add(file, familyValue) {
    const family = normalizeFamily(familyValue);
    const validation = await validateFontFile(file);
    if (!validation.valid) throw new TypeError(validation.error);

    const id = createId();
    if (!OPAQUE_ID_PATTERN.test(id ?? '') || runtimeRecords.has(id)) {
      throw new TypeError('Geçersiz veya yinelenen özel font kimliği.');
    }
    const record = {
      id,
      family,
      name: typeof file.name === 'string' && file.name ? file.name : 'custom-font',
      type: validation.type,
      size: file.size,
      blob: file,
    };
    const runtime = await prepareRuntime(record, FontFaceClass);

    try {
      fontSet.add(runtime.face);
      await database.putFont(persistentRecord(runtime));
    } catch (error) {
      try {
        fontSet.delete(runtime.face);
      } catch {
        // A failed activation must not hide the persistence error.
      }
      throw error;
    }

    runtimeRecords.set(id, runtime);
    return publicRuntime(runtime);
  }

  async function stage(records) {
    if (!Array.isArray(records)) throw new TypeError('Özel font kayıtları bir dizi olmalıdır.');
    const seen = new Set();
    const entries = [];

    for (const record of records) {
      if (seen.has(record?.id)) throw new TypeError('Yinelenen özel font kimliği.');
      seen.add(record?.id);
      entries.push({
        runtime: await prepareRuntime(record, FontFaceClass),
        previous: runtimeRecords.get(record?.id),
      });
    }

    let committed = false;
    let rolledBack = false;
    const activated = [];

    async function rollback() {
      for (const entry of activated.splice(0).reverse()) {
        try {
          fontSet.delete(entry.runtime.face);
        } finally {
          if (runtimeRecords.get(entry.runtime.id) === entry.runtime) {
            if (entry.previous) runtimeRecords.set(entry.previous.id, entry.previous);
            else runtimeRecords.delete(entry.runtime.id);
          }
        }
      }
      rolledBack = true;
      committed = false;
    }

    async function commit() {
      if (rolledBack) throw new Error('Özel font hazırlığı geri alındı.');
      if (committed) return entries.map(({ runtime }) => publicRuntime(runtime));
      try {
        for (const entry of entries) {
          activated.push(entry);
          fontSet.add(entry.runtime.face);
          runtimeRecords.set(entry.runtime.id, entry.runtime);
        }
        committed = true;
        return entries.map(({ runtime }) => publicRuntime(runtime));
      } catch (error) {
        await rollback();
        throw error;
      }
    }

    async function finalize() {
      if (!committed || rolledBack) return false;
      for (const { previous } of entries) {
        if (previous) fontSet.delete(previous.face);
      }
      activated.length = 0;
      return true;
    }

    return { commit, rollback, finalize };
  }

  async function hydrate(fontMetadata) {
    if (!Array.isArray(fontMetadata)) throw new TypeError('Özel font metadata dizisi gerekli.');
    const ids = [...new Set(fontMetadata.map((metadata) => metadata?.id))];
    if (ids.some((id) => !OPAQUE_ID_PATTERN.test(id ?? ''))) {
      throw new TypeError('Geçersiz özel font metadata kaydı.');
    }
    if (ids.length === 0) return [];

    const records = await database.getFonts(ids);
    const byId = new Map(records.map((record) => [record.id, record]));
    const orderedRecords = fontMetadata.map((metadata) => {
      const record = byId.get(metadata.id);
      if (!record || !sameMetadata(record, metadata)) {
        throw new Error('Özel font kaydı bulunamadı veya metadata eşleşmiyor.');
      }
      return record;
    });
    const staged = await stage(orderedRecords);
    return staged.commit();
  }

  async function remove(id) {
    const runtime = runtimeRecords.get(id);
    if (await isReferenced(id)) throw new Error('Bu özel font etkin projede kullanılıyor.');
    await database.deleteFont(id);
    if (runtime) {
      try {
        fontSet.delete(runtime.face);
      } catch (error) {
        try {
          await database.putFont(persistentRecord(runtime));
        } catch {
          // Preserve the runtime cleanup failure after attempting persistence compensation.
        }
        throw error;
      }
    }
    runtimeRecords.delete(id);
  }

  function clear() {
    for (const runtime of runtimeRecords.values()) {
      try {
        fontSet.delete(runtime.face);
      } catch {
        // Continue releasing the rest of the runtime font registry.
      }
    }
    runtimeRecords.clear();
  }

  function pruneRuntime(referencedIds = []) {
    const referenced = new Set(referencedIds);
    for (const [id, runtime] of runtimeRecords) {
      if (referenced.has(id)) continue;
      try {
        fontSet.delete(runtime.face);
      } finally {
        runtimeRecords.delete(id);
      }
    }
  }

  return {
    add,
    hydrate,
    stage,
    remove,
    clear,
    pruneRuntime,
    get: (id) => {
      const record = runtimeRecords.get(id);
      return record ? publicRuntime(record) : undefined;
    },
    list: () => [...runtimeRecords.values()].map(publicRuntime),
  };
}
