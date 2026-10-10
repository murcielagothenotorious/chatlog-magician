import { describe, expect, it } from 'vitest';
import { PROJECT_SCHEMA_VERSION, migrateProject, normalizeProject } from '../public/js/project-model.ts';

describe('project migrations', () => {
  it('migrates a version 1 project into version 2 font references', () => {
    const source = {
      schemaVersion: 1,
      metadata: { id: 'project-1', title: 'Gece' },
      chat: { input: 'Selam', font: 'Arial' },
      fonts: [
        {
          id: 'font-1',
          family: 'Gece Font',
          name: 'gece.woff2',
          type: 'font/woff2',
          size: 1234,
          runtimeFace: 'discarded',
        },
      ],
    };

    const migrated = migrateProject(source);

    expect(migrated).toEqual({
      schemaVersion: 2,
      metadata: { id: 'project-1', title: 'Gece' },
      chat: { input: 'Selam', font: 'Arial' },
      fonts: [
        {
          id: 'font-1',
          family: 'Gece Font',
          name: 'gece.woff2',
          type: 'font/woff2',
          size: 1234,
        },
      ],
    });
    expect(source.schemaVersion).toBe(1);
    expect(source.fonts[0].runtimeFace).toBe('discarded');
    expect(normalizeProject(migrated).schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
  });

  it('treats a missing schema version as version 1 legacy data', () => {
    expect(migrateProject({ chat: { input: 'eski' } })).toMatchObject({
      schemaVersion: 2,
      chat: { input: 'eski' },
    });
  });

  it('rejects malformed and future versions without mutating input', () => {
    const future = { schemaVersion: 99, chat: { input: 'koru' } };
    expect(() => migrateProject(future)).toThrow(/unsupported project version/i);
    expect(future.chat.input).toBe('koru');

    expect(() => migrateProject({ schemaVersion: 1.5 })).toThrow(/invalid project version/i);
  });
});
