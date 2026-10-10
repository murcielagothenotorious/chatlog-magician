import { canvasCompositionLayout } from './canvas-renderer.js';
import { referencedAssetIds } from './local-asset-service.js';
import { deserializeProject, serializeProject } from './project-model.js';

const MISSING_PROJECT_MESSAGE = 'Bu yığın kaydının proje verileri eksik.';
const INVALID_FILENAME_PATTERN = /[<>:"/\\|?*]/gu;
const MAX_NAME_LENGTH = 80;

function asDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Geçerli bir tarih gerekli.');
  return date;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function defaultName(date) {
  return `Görsel ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}.${pad(date.getMinutes())}`;
}

function normalizeName(value, date) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (
    [...name].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
    })
  ) {
    throw new TypeError('Görsel adı kontrol karakteri içeremez.');
  }
  return (name || defaultName(date)).slice(0, MAX_NAME_LENGTH);
}

function canonicalProject(project) {
  return deserializeProject(serializeProject(project));
}

function fontIds(project) {
  return [...new Set(project.fonts.map(({ id }) => id))];
}

function extensionForType(type) {
  return type === 'image/jpeg' ? 'jpg' : 'png';
}

function filenameStem(name) {
  const stem = String(name)
    .replace(INVALID_FILENAME_PATTERN, '_')
    .trim()
    .replace(/[. ]+$/u, '');
  return stem || 'Görsel';
}

function filenameFor(entry, usedNames) {
  const extension = extensionForType(entry.type || entry.blob?.type);
  const stem = filenameStem(entry.name);
  let suffix = 1;
  let filename = `${stem}.${extension}`;
  while (usedNames.has(filename.toLocaleLowerCase('tr-TR'))) {
    suffix += 1;
    filename = `${stem} (${suffix}).${extension}`;
  }
  usedNames.add(filename.toLocaleLowerCase('tr-TR'));
  return filename;
}

function requireEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error(MISSING_PROJECT_MESSAGE);
  return entry;
}

function dependenciesComplete(ids, records) {
  const recordIds = new Set(records.map(({ id }) => id));
  return ids.every((id) => recordIds.has(id));
}

export function createImageStack({ database, renderer, saveAs, createId, now }: any = {}) {
  if (
    !database?.putStackEntry ||
    !database?.getStackEntry ||
    !database?.listStackEntries ||
    !database?.deleteStackEntries ||
    !database?.getAssets ||
    !database?.getFonts ||
    typeof renderer?.toBlob !== 'function' ||
    typeof saveAs !== 'function' ||
    typeof createId !== 'function' ||
    typeof now !== 'function'
  ) {
    throw new TypeError('Image stack dependencies are required.');
  }

  let selectedIds = new Set();

  async function save(project, name) {
    const created = asDate(now());
    const snapshot = canonicalProject(project);
    const blob = await renderer.toBlob(project);
    if (!(blob instanceof Blob) || !['image/png', 'image/jpeg'].includes(blob.type)) {
      throw new TypeError('Canvas dışa aktarımı geçerli bir PNG veya JPEG üretmedi.');
    }
    const layout = canvasCompositionLayout(snapshot.canvas, snapshot.blocks);
    const entry = {
      id: createId(),
      projectId: snapshot.metadata.id,
      name: normalizeName(name, created),
      type: blob.type,
      size: blob.size,
      width: layout.width,
      height: layout.height,
      createdAt: created.toISOString(),
      blob,
      project: snapshot,
      assetIds: referencedAssetIds(snapshot),
      fontIds: fontIds(snapshot),
    };
    await database.putStackEntry(entry);
    return entry;
  }

  function list() {
    return database.listStackEntries();
  }

  async function rename(id, name) {
    const entry = requireEntry(await database.getStackEntry(id));
    const renamed = { ...entry, name: normalizeName(name, asDate(now())) };
    await database.putStackEntry(renamed);
    return renamed;
  }

  function select(ids = []) {
    if (!Array.isArray(ids)) throw new TypeError('Yığın seçimi bir dizi olmalı.');
    selectedIds = new Set(ids);
    return selected();
  }

  function selected() {
    return new Set(selectedIds);
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length > 0) await database.deleteStackEntries(ids);
    selectedIds.clear();
    return ids;
  }

  async function downloadEntry(entry, usedNames = new Set()) {
    requireEntry(entry);
    if (!(entry.blob instanceof Blob)) throw new Error(MISSING_PROJECT_MESSAGE);
    const filename = filenameFor(entry, usedNames);
    await saveAs(entry.blob, filename);
    return filename;
  }

  async function download(id) {
    const entry = await database.getStackEntry(id);
    return downloadEntry(entry);
  }

  async function downloadSelected() {
    const entries = (await list()).filter(({ id }) => selectedIds.has(id));
    const result = { downloadedIds: [], failedIds: [] };
    const usedNames = new Set();
    for (const entry of entries) {
      try {
        await downloadEntry(entry, usedNames);
        result.downloadedIds.push(entry.id);
      } catch {
        result.failedIds.push(entry.id);
      }
    }
    for (const id of selectedIds) {
      if (!entries.some((entry) => entry.id === id)) result.failedIds.push(id);
    }
    return result;
  }

  async function prepareReopen(id) {
    try {
      const entry = requireEntry(await database.getStackEntry(id));
      const project = canonicalProject(entry.project);
      if (!Array.isArray(entry.assetIds) || !Array.isArray(entry.fontIds)) {
        throw new Error(MISSING_PROJECT_MESSAGE);
      }
      const assetIds = [...new Set([...entry.assetIds, ...referencedAssetIds(project)])];
      const requiredFontIds = [...new Set([...entry.fontIds, ...fontIds(project)])];
      const [assets, fonts] = await Promise.all([
        database.getAssets(assetIds),
        database.getFonts(requiredFontIds),
      ]);
      if (
        !dependenciesComplete(assetIds, assets) ||
        !dependenciesComplete(requiredFontIds, fonts)
      ) {
        throw new Error(MISSING_PROJECT_MESSAGE);
      }
      return { project, assets, fonts };
    } catch {
      throw new Error(MISSING_PROJECT_MESSAGE);
    }
  }

  return {
    save,
    list,
    rename,
    select,
    selected,
    deleteSelected,
    download,
    downloadSelected,
    prepareReopen,
  };
}
