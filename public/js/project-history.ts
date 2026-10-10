import { deserializeProject, serializeProject } from './project-model.js';

const DEFAULT_HISTORY_LIMIT = 50;

function cloneSnapshot(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeLimit(limit) {
  if (!Number.isFinite(limit)) return DEFAULT_HISTORY_LIMIT;
  return Math.max(0, Math.floor(limit));
}

function canonicalSnapshot(value) {
  return deserializeProject(serializeProject(value));
}

export function createProjectHistory(initialState, { limit = DEFAULT_HISTORY_LIMIT } = {}) {
  const historyLimit = normalizeLimit(limit);
  const undoStack = [];
  const redoStack = [];
  const listeners = new Set<any>();
  let state = canonicalSnapshot(initialState);

  function snapshot() {
    return cloneSnapshot(state);
  }

  function trimUndoStack() {
    if (undoStack.length > historyLimit) {
      undoStack.splice(0, undoStack.length - historyLimit);
    }
  }

  function emit(reason) {
    for (const listener of listeners) {
      try {
        listener({ reason, snapshot: snapshot() });
      } catch {
        // State changes must not depend on observer behavior.
      }
    }
  }

  return {
    current() {
      return snapshot();
    },

    commit(mutator) {
      const draft = snapshot();
      mutator(draft);
      const nextState = canonicalSnapshot(draft);

      undoStack.push(state);
      trimUndoStack();
      redoStack.length = 0;
      state = nextState;
      emit('commit');

      return snapshot();
    },

    undo() {
      if (undoStack.length === 0) return snapshot();

      redoStack.push(state);
      state = undoStack.pop();
      emit('undo');
      return snapshot();
    },

    redo() {
      if (redoStack.length === 0) return snapshot();

      undoStack.push(state);
      trimUndoStack();
      state = redoStack.pop();
      emit('redo');
      return snapshot();
    },

    replace(nextState) {
      const replacement = canonicalSnapshot(nextState);
      undoStack.length = 0;
      redoStack.length = 0;
      state = replacement;
      emit('replace');
      return snapshot();
    },

    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError('Project history listener must be a function');
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    canUndo() {
      return undoStack.length > 0;
    },

    canRedo() {
      return redoStack.length > 0;
    },

    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      return snapshot();
    },
  };
}
