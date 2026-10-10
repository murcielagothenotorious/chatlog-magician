import { createProject } from './project-model.js';
import { createProjectHistory } from './project-history.js';
import { captureChatState } from './project-state-bridge.js';

declare global {
  interface Window {
    ChatlogProject?: unknown;
  }
}

export function createProjectController({ document, initialProject = createProject() }: any = {}) {
  const history = createProjectHistory(initialProject);
  const explicitSaveTimes = new Map();

  function currentProjectId() {
    return history.current().metadata.id;
  }

  return {
    getSnapshot: () => history.current(),
    captureCurrentChat: () =>
      history.commit((draft) => Object.assign(draft, captureChatState(document, draft))),
    commit: (mutator) => history.commit(mutator),
    undo: () => history.undo(),
    redo: () => history.redo(),
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    replaceSnapshot: (snapshot) => history.replace(snapshot),
    subscribe: (listener) => history.subscribe(listener),
    markExplicitSave: (savedAt) => {
      if (!Number.isFinite(savedAt) || savedAt < 0) {
        throw new TypeError('Explicit save time must be a non-negative timestamp');
      }
      explicitSaveTimes.set(currentProjectId(), savedAt);
      return savedAt;
    },
    getLastExplicitSaveAt: () => explicitSaveTimes.get(currentProjectId()) ?? 0,
    clearHistory: () => history.clear(),
  };
}

if (typeof document !== 'undefined') {
  if (!window.ChatlogProject) window.ChatlogProject = createProjectController({ document });
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.ChatlogProject) window.ChatlogProject = createProjectController({ document });
  });
}
