import { describe, expect, it } from 'vitest';
import { createProject } from '../public/js/project-model.ts';
import { createProjectHistory } from '../public/js/project-history.ts';

describe('project history', () => {
  it('undoes and redoes immutable snapshots', () => {
    const history = createProjectHistory(createProject(), { limit: 3 });
    history.commit((draft) => {
      draft.chat.input = 'bir';
    });
    const committed = history.commit((draft) => {
      draft.chat.input = 'iki';
    });

    committed.chat.input = 'dışarıdan değişiklik';

    expect(history.undo().chat.input).toBe('bir');
    expect(history.redo().chat.input).toBe('iki');
  });

  it('drops redo state after a divergent commit', () => {
    const history = createProjectHistory(createProject());
    history.commit((draft) => {
      draft.chat.input = 'a';
    });
    history.undo();
    history.commit((draft) => {
      draft.chat.input = 'b';
    });

    expect(history.canRedo()).toBe(false);
  });

  it('keeps only the configured number of undo snapshots', () => {
    const history = createProjectHistory(createProject(), { limit: 2 });
    history.commit((draft) => {
      draft.chat.input = 'bir';
    });
    history.commit((draft) => {
      draft.chat.input = 'iki';
    });
    history.commit((draft) => {
      draft.chat.input = 'üç';
    });

    expect(history.undo().chat.input).toBe('iki');
    expect(history.undo().chat.input).toBe('bir');
    expect(history.canUndo()).toBe(false);
    expect(history.undo().chat.input).toBe('bir');
  });

  it('keeps 50 undo snapshots by default', () => {
    const history = createProjectHistory(createProject());

    for (let index = 1; index <= 51; index += 1) {
      history.commit((draft) => {
        draft.chat.input = String(index);
      });
    }

    for (let index = 50; index >= 1; index -= 1) {
      expect(history.undo().chat.input).toBe(String(index));
    }
    expect(history.canUndo()).toBe(false);
    expect(history.current().chat.input).toBe('1');
  });

  it('isolates stored state from initial, current, and mutator-owned references', () => {
    const initial = createProject();
    const history = createProjectHistory(initial);
    initial.chat.input = 'ilk referans';

    const current = history.current();
    current.chat.input = 'okunan referans';

    let draftReference;
    history.commit((draft) => {
      draft.chat.input = 'kaydedilen';
      draftReference = draft;
    });
    draftReference.chat.input = 'taslak referansı';

    expect(history.undo().chat.input).toBe('');
    expect(history.redo().chat.input).toBe('kaydedilen');
  });

  it('treats undo and redo as no-ops at their boundaries', () => {
    const history = createProjectHistory(createProject({ chat: { input: 'başlangıç' } }));

    expect(history.undo().chat.input).toBe('başlangıç');
    expect(history.redo().chat.input).toBe('başlangıç');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('clears navigation stacks without changing the current snapshot', () => {
    const history = createProjectHistory(createProject());
    history.commit((draft) => {
      draft.chat.input = 'korunacak';
    });
    history.undo();
    history.redo();

    expect(history.clear().chat.input).toBe('korunacak');
    expect(history.current().chat.input).toBe('korunacak');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it.each([
    [
      'cycle',
      (draft) => {
        draft.layers.push(draft);
      },
    ],
    [
      'Blob',
      (draft) => {
        draft.layers.push(new globalThis.Blob(['transient']));
      },
    ],
    [
      'Map',
      (draft) => {
        draft.layers.push(new Map([['source', 'transient']]));
      },
    ],
    [
      'transient HTML field',
      (draft) => {
        draft.layers.push({ generatedHtml: '<div>transient</div>' });
      },
    ],
  ])('rejects a %s commit without changing current, undo, or redo state', (_, mutate) => {
    const history = createProjectHistory(createProject());
    history.commit((draft) => {
      draft.chat.input = 'bir';
    });
    history.commit((draft) => {
      draft.chat.input = 'iki';
    });
    history.undo();

    expect(() => history.commit(mutate)).toThrow();
    expect(history.current().chat.input).toBe('bir');
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(true);
    expect(history.redo().chat.input).toBe('iki');
    expect(history.undo().chat.input).toBe('bir');
    expect(history.undo().chat.input).toBe('');
  });

  it('rejects a non-persistent initial snapshot', () => {
    const project = createProject();
    project.canvas.background.assetId = 'blob:https://example.test/background';

    expect(() => createProjectHistory(project)).toThrow(/blob URL/i);
  });

  it('replaces state, clears navigation, and emits isolated snapshots', () => {
    const history = createProjectHistory(createProject());
    const events = [];
    const unsubscribe = history.subscribe((event) => events.push(event));
    history.commit((draft) => {
      draft.chat.input = 'eski';
    });
    const replacement = createProject({
      metadata: { id: 'open-1' },
      chat: { input: 'açılan' },
    });

    const returned = history.replace(replacement);
    replacement.chat.input = 'dışarıdan';
    returned.chat.input = 'dönen referans';
    events[1].snapshot.chat.input = 'event referansı';
    unsubscribe();

    expect(history.current().chat.input).toBe('açılan');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(events.map(({ reason }) => reason)).toEqual(['commit', 'replace']);
  });

  it('emits successful navigation only and isolates listeners from each other', () => {
    const history = createProjectHistory(createProject());
    const observed = [];
    history.subscribe((event) => {
      event.snapshot.chat.input = 'listener mutation';
      throw new Error('listener failure');
    });
    history.subscribe((event) => observed.push([event.reason, event.snapshot.chat.input]));

    history.undo();
    history.redo();
    history.commit((draft) => {
      draft.chat.input = 'bir';
    });
    history.undo();
    history.redo();

    expect(observed).toEqual([
      ['commit', 'bir'],
      ['undo', ''],
      ['redo', 'bir'],
    ]);
    expect(history.current().chat.input).toBe('bir');
  });

  it('rejects an invalid replacement without changing state or emitting', () => {
    const history = createProjectHistory(createProject({ chat: { input: 'koru' } }));
    const events = [];
    history.subscribe((event) => events.push(event));
    const invalid = createProject();
    invalid.layers.push(new globalThis.Blob(['invalid']));

    expect(() => history.replace(invalid)).toThrow();
    expect(history.current().chat.input).toBe('koru');
    expect(events).toEqual([]);
  });
});
