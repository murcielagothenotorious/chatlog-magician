import { describe, expect, it } from 'vitest';
import { createProject } from '../public/js/project-model.ts';
import {
  BCMAG_ENVELOPE_VERSION,
  BCMAG_MAGIC,
  BCMAG_MIME_TYPE,
  createBcmagFile,
  readBcmagFile,
} from '../public/js/bcmag-file.ts';

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const WOFF2_SIGNATURE = new globalThis.TextEncoder().encode('wOF2');

function validBundle(overrides = {}) {
  const assetBlob = new globalThis.Blob([PNG_SIGNATURE], { type: 'image/png' });
  const fontBlob = new globalThis.Blob([WOFF2_SIGNATURE], { type: 'font/woff2' });
  const project = createProject({
    metadata: { id: 'project-1', title: 'Gece' },
    canvas: { background: { type: 'image', assetId: 'asset-1' } },
    fonts: [
      {
        id: 'font-1',
        family: 'Gece Font',
        name: 'gece.woff2',
        type: 'font/woff2',
        size: fontBlob.size,
      },
    ],
  });
  return {
    project,
    assets: [
      {
        id: 'asset-1',
        name: 'scene.png',
        type: 'image/png',
        size: assetBlob.size,
        width: 1,
        height: 1,
        blob: assetBlob,
      },
    ],
    fonts: [
      {
        id: 'font-1',
        name: 'gece.woff2',
        family: 'Gece Font',
        type: 'font/woff2',
        size: fontBlob.size,
        blob: fontBlob,
      },
    ],
    savedAt: 1_720_656_000_000,
    ...overrides,
  };
}

async function envelopeFrom(bundle = validBundle()) {
  const file = await createBcmagFile(bundle);
  return JSON.parse(await file.text());
}

function fileFromEnvelope(envelope) {
  return new globalThis.Blob([JSON.stringify(envelope)], { type: BCMAG_MIME_TYPE });
}

async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? new globalThis.TextEncoder().encode(value) : value;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('BCMAG file creation', () => {
  it('creates a deterministic versioned envelope with sorted binary entries', async () => {
    const bundle = validBundle();
    const secondAsset = {
      ...bundle.assets[0],
      id: 'asset-2',
      name: 'second.png',
    };
    bundle.project.layers = [
      {
        id: 'layer-2',
        kind: 'image',
        assetId: 'asset-2',
        transform: { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
      },
    ];
    bundle.assets = [secondAsset, bundle.assets[0]];

    const first = await createBcmagFile(bundle);
    const second = await createBcmagFile(bundle);
    const envelope = JSON.parse(await first.text());

    expect(first.type).toBe(BCMAG_MIME_TYPE);
    expect(await first.text()).toBe(await second.text());
    expect(envelope).toMatchObject({
      magic: BCMAG_MAGIC,
      envelopeVersion: BCMAG_ENVELOPE_VERSION,
      projectSchemaVersion: 2,
      savedAt: bundle.savedAt,
      integrity: { manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(envelope.assets.map(({ id }) => id)).toEqual(['asset-1', 'asset-2']);
    expect(envelope.fonts.map(({ id }) => id)).toEqual(['font-1']);
  });

  it('rejects missing, extra, duplicate, and mismatched referenced records', async () => {
    const bundle = validBundle();
    await expect(createBcmagFile({ ...bundle, assets: [] })).rejects.toThrow(/eksik/i);
    await expect(
      createBcmagFile({
        ...bundle,
        assets: [...bundle.assets, { ...bundle.assets[0], id: 'asset-extra' }],
      })
    ).rejects.toThrow(/geçerli bir BCMAG/i);
    await expect(
      createBcmagFile({ ...bundle, assets: [...bundle.assets, bundle.assets[0]] })
    ).rejects.toThrow(/geçerli bir BCMAG/i);
    await expect(
      createBcmagFile({
        ...bundle,
        assets: [{ ...bundle.assets[0], size: bundle.assets[0].size + 1 }],
      })
    ).rejects.toThrow(/geçerli bir BCMAG/i);
  });

  it('validates MIME and binary signatures before encoding', async () => {
    const bundle = validBundle();
    const forgedPng = new globalThis.Blob(['not-png'], { type: 'image/png' });
    await expect(
      createBcmagFile({
        ...bundle,
        assets: [
          {
            ...bundle.assets[0],
            size: forgedPng.size,
            blob: forgedPng,
          },
        ],
      })
    ).rejects.toThrow(/geçerli bir BCMAG/i);

    const forgedFont = new globalThis.Blob(['nope'], { type: 'font/woff2' });
    bundle.project.fonts[0].size = forgedFont.size;
    await expect(
      createBcmagFile({
        ...bundle,
        fonts: [{ ...bundle.fonts[0], size: forgedFont.size, blob: forgedFont }],
      })
    ).rejects.toThrow(/geçerli bir BCMAG/i);
  });

  it('rejects transient project fields and blob URLs before writing', async () => {
    const transient = validBundle();
    transient.project.layers.push({ generatedHtml: '<div>unsafe</div>' });
    await expect(createBcmagFile(transient)).rejects.toThrow(/geçerli bir BCMAG/i);

    const blobUrl = validBundle();
    blobUrl.project.layers.push({ source: 'blob:https://example.test/runtime' });
    await expect(createBcmagFile(blobUrl)).rejects.toThrow(/geçerli bir BCMAG/i);
  });
});

describe('BCMAG file reading', () => {
  it('round-trips a project with image and font blobs as staged plain data', async () => {
    const bundle = validBundle();
    const opened = await readBcmagFile(await createBcmagFile(bundle));

    expect(opened.project.metadata.title).toBe('Gece');
    expect(opened.savedAt).toBe(bundle.savedAt);
    expect(opened.assets[0]).toMatchObject({
      id: 'asset-1',
      type: 'image/png',
      width: 1,
      height: 1,
    });
    expect(new Uint8Array(await opened.assets[0].blob.arrayBuffer())).toEqual(PNG_SIGNATURE);
    expect(new Uint8Array(await opened.fonts[0].blob.arrayBuffer())).toEqual(WOFF2_SIGNATURE);
    expect(Object.keys(opened)).toEqual(['project', 'assets', 'fonts', 'savedAt']);
  });

  it('rejects changed payload and manifest hashes before returning records', async () => {
    const binaryTamper = await envelopeFrom();
    binaryTamper.assets[0].data = 'dGFtcGVyZWQ=';
    await expect(readBcmagFile(fileFromEnvelope(binaryTamper))).rejects.toThrow(/bozuk/i);

    const manifestTamper = await envelopeFrom();
    manifestTamper.manifest.metadata.title = 'Changed';
    await expect(readBcmagFile(fileFromEnvelope(manifestTamper))).rejects.toThrow(/bozuk/i);
  });

  it('migrates a version 1 manifest and rejects future envelope/project versions', async () => {
    const legacy = await envelopeFrom();
    legacy.projectSchemaVersion = 1;
    legacy.manifest.schemaVersion = 1;
    legacy.integrity.manifestSha256 = await sha256Hex(JSON.stringify(legacy.manifest));
    await expect(readBcmagFile(fileFromEnvelope(legacy))).resolves.toMatchObject({
      project: { schemaVersion: 2 },
    });

    const futureEnvelope = await envelopeFrom();
    futureEnvelope.envelopeVersion = BCMAG_ENVELOPE_VERSION + 1;
    await expect(readBcmagFile(fileFromEnvelope(futureEnvelope))).rejects.toThrow(/daha yeni/i);

    const futureProject = await envelopeFrom();
    futureProject.projectSchemaVersion = 999;
    futureProject.manifest.schemaVersion = 999;
    futureProject.integrity.manifestSha256 = await sha256Hex(
      JSON.stringify(futureProject.manifest)
    );
    await expect(readBcmagFile(fileFromEnvelope(futureProject))).rejects.toThrow(/daha yeni/i);
  });

  it('rejects invalid JSON/base64, duplicate IDs, and missing or extra references', async () => {
    await expect(readBcmagFile(new globalThis.Blob(['not-json']))).rejects.toThrow(
      /geçerli bir BCMAG/i
    );

    const invalidBase64 = await envelopeFrom();
    invalidBase64.assets[0].data = '***=';
    await expect(readBcmagFile(fileFromEnvelope(invalidBase64))).rejects.toThrow(
      /geçerli bir BCMAG/i
    );

    const duplicate = await envelopeFrom();
    duplicate.assets.push({ ...duplicate.assets[0] });
    await expect(readBcmagFile(fileFromEnvelope(duplicate))).rejects.toThrow(/geçerli bir BCMAG/i);

    const missing = await envelopeFrom();
    missing.assets = [];
    await expect(readBcmagFile(fileFromEnvelope(missing))).rejects.toThrow(/eksik/i);

    const extra = await envelopeFrom();
    extra.assets.push({ ...extra.assets[0], id: 'asset-extra' });
    await expect(readBcmagFile(fileFromEnvelope(extra))).rejects.toThrow(/geçerli bir BCMAG/i);
  });

  it('enforces declared entry, decoded-total, and count limits before decoding', async () => {
    const imageTooLarge = await envelopeFrom();
    imageTooLarge.assets[0].size = 10 * 1024 * 1024 + 1;
    await expect(readBcmagFile(fileFromEnvelope(imageTooLarge))).rejects.toThrow(/boyutu aşıyor/i);

    const totalTooLarge = await envelopeFrom();
    totalTooLarge.assets = Array.from({ length: 6 }, (_, index) => ({
      ...totalTooLarge.assets[0],
      id: `asset-${index}`,
      size: 9 * 1024 * 1024,
    }));
    await expect(readBcmagFile(fileFromEnvelope(totalTooLarge))).rejects.toThrow(/boyutu aşıyor/i);

    const tooMany = await envelopeFrom();
    tooMany.assets = Array.from({ length: 129 }, (_, index) => ({
      ...tooMany.assets[0],
      id: `asset-${index}`,
    }));
    await expect(readBcmagFile(fileFromEnvelope(tooMany))).rejects.toThrow(/boyutu aşıyor/i);
  });

  it('rejects MIME/signature disagreement and malformed metadata', async () => {
    const mimeMismatch = await envelopeFrom();
    mimeMismatch.assets[0].type = 'image/jpeg';
    await expect(readBcmagFile(fileFromEnvelope(mimeMismatch))).rejects.toThrow(
      /geçerli bir BCMAG/i
    );

    const invalidDimensions = await envelopeFrom();
    invalidDimensions.assets[0].width = 0;
    await expect(readBcmagFile(fileFromEnvelope(invalidDimensions))).rejects.toThrow(
      /geçerli bir BCMAG/i
    );
  });

  it('rejects a manifest with transient project fields even when its hash is valid', async () => {
    const envelope = await envelopeFrom();
    envelope.manifest.layers.push({ generatedHtml: '<div>unsafe</div>' });
    envelope.integrity.manifestSha256 = await sha256Hex(JSON.stringify(envelope.manifest));

    await expect(readBcmagFile(fileFromEnvelope(envelope))).rejects.toThrow(/geçerli bir BCMAG/i);
  });
});
