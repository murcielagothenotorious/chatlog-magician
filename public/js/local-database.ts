const DEFAULT_DATABASE_NAME = 'chatlog-magician';
const DEFAULT_DATABASE_VERSION = 1;
const UNAVAILABLE_MESSAGE = 'Yerel depolama bu tarayıcıda kullanılamıyor.';
const BLOCKED_MESSAGE = 'Yerel depolama yükseltmesi başka bir sekme tarafından engellendi.';
const STORE_DEFINITIONS: Record<string, any> = {
  projects: { keyPath: 'id' },
  assets: { keyPath: 'id' },
  fonts: { keyPath: 'id' },
  autosaves: { keyPath: 'projectId' },
  imageStack: {
    keyPath: 'id',
    indexes: [
      ['createdAt', 'createdAt'],
      ['projectId', 'projectId'],
    ],
  },
};
const STORE_NAMES = Object.keys(STORE_DEFINITIONS);

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function createStoreWrapper(store) {
  return {
    get(key) {
      return requestToPromise(store.get(key));
    },
    getAll() {
      return requestToPromise(store.getAll());
    },
    put(value) {
      return requestToPromise(store.put(value));
    },
    delete(key) {
      return requestToPromise(store.delete(key));
    },
    clear() {
      return requestToPromise(store.clear());
    },
  };
}

function normalizeStoreNames(storeNames) {
  const names = typeof storeNames === 'string' ? [storeNames] : [...storeNames];
  if (names.length === 0) throw new TypeError('At least one object store is required.');
  return names;
}

function createSchema(connection, upgradeTransaction) {
  for (const [name, definition] of Object.entries(STORE_DEFINITIONS)) {
    const store = connection.objectStoreNames.contains(name)
      ? upgradeTransaction.objectStore(name)
      : connection.createObjectStore(name, { keyPath: definition.keyPath });

    for (const [indexName, keyPath] of definition.indexes ?? []) {
      if (!store.indexNames.contains(indexName)) {
        store.createIndex(indexName, keyPath, { unique: false });
      }
    }
  }
}

export function createLocalDatabase(options: any = {}) {
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  const name = options.name ?? DEFAULT_DATABASE_NAME;
  const configuredVersion = options.version ?? DEFAULT_DATABASE_VERSION;
  let desiredVersion = configuredVersion;
  let connection = null;
  let opening = null;

  function open() {
    if (!indexedDB?.open) return Promise.reject(new Error(UNAVAILABLE_MESSAGE));
    if (connection) return Promise.resolve(connection);
    if (opening) return opening;

    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, desiredVersion);
      let rejected = false;

      request.onupgradeneeded = () => {
        createSchema(request.result, request.transaction);
      };
      request.onblocked = () => {
        rejected = true;
        reject(new Error(BLOCKED_MESSAGE));
      };
      request.onerror = () => {
        if (!rejected) reject(request.error ?? new Error('Yerel depolama açılamadı.'));
      };
      request.onsuccess = () => {
        const openedConnection = request.result;
        if (rejected) {
          openedConnection.close();
          return;
        }

        connection = openedConnection;
        desiredVersion = Math.max(desiredVersion, openedConnection.version);
        openedConnection.onversionchange = (event) => {
          if (typeof event.newVersion === 'number') {
            desiredVersion = Math.max(desiredVersion, event.newVersion);
          }
          openedConnection.close();
          if (connection === openedConnection) connection = null;
          opening = null;
        };
        resolve(openedConnection);
      };
    }).finally(() => {
      opening = null;
    });

    return opening;
  }

  function close() {
    connection?.close();
    connection = null;
  }

  async function transaction(storeNames, mode, callback) {
    if (typeof callback !== 'function') throw new TypeError('Transaction callback is required.');
    const activeConnection = await open();
    const names = normalizeStoreNames(storeNames);

    return new Promise((resolve, reject) => {
      let idbTransaction;
      try {
        idbTransaction = activeConnection.transaction(names, mode);
      } catch (error) {
        reject(error);
        return;
      }

      const stores = Object.fromEntries(
        names.map((storeName) => [
          storeName,
          createStoreWrapper(idbTransaction.objectStore(storeName)),
        ])
      );
      let callbackComplete = false;
      let transactionComplete = false;
      let callbackResult;
      let callbackError;
      let settled = false;

      const finish = () => {
        if (settled) return;
        if (callbackError) {
          settled = true;
          reject(callbackError);
          return;
        }
        if (callbackComplete && transactionComplete) {
          settled = true;
          resolve(callbackResult);
        }
      };

      idbTransaction.oncomplete = () => {
        transactionComplete = true;
        finish();
      };
      idbTransaction.onerror = () => {
        if (settled || callbackError) return;
        settled = true;
        reject(idbTransaction.error ?? new Error('IndexedDB transaction failed.'));
      };
      idbTransaction.onabort = () => {
        if (settled) return;
        settled = true;
        reject(
          callbackError ?? idbTransaction.error ?? new Error('IndexedDB transaction aborted.')
        );
      };

      Promise.resolve()
        .then(() => callback(stores))
        .then((result) => {
          callbackResult = result;
          callbackComplete = true;
          finish();
        })
        .catch((error) => {
          callbackError = error;
          try {
            idbTransaction.abort();
          } catch {
            finish();
          }
        });
    });
  }

  const readOne = (storeName, key) =>
    transaction(storeName, 'readonly', (stores) => stores[storeName].get(key));
  const putOne = (storeName, record) =>
    transaction(storeName, 'readwrite', (stores) => stores[storeName].put(record));
  const deleteOne = (storeName, key) =>
    transaction(storeName, 'readwrite', (stores) => stores[storeName].delete(key));

  async function readMany(storeName, ids) {
    if (ids.length === 0) return [];
    return transaction(storeName, 'readonly', async (stores) => {
      const records = await Promise.all(ids.map((id) => stores[storeName].get(id)));
      return records.filter((record) => record !== undefined);
    });
  }

  return {
    open,
    close,
    transaction,
    putProject: (record) => putOne('projects', record),
    getProject: (id) => readOne('projects', id),
    listProjects: () =>
      transaction('projects', 'readonly', async ({ projects }) => {
        const records = await projects.getAll();
        return records.sort(
          (left, right) =>
            (Number(right.savedAt) || 0) - (Number(left.savedAt) || 0) ||
            String(left.id).localeCompare(String(right.id))
        );
      }),
    putAsset: (record) => putOne('assets', record),
    getAsset: (id) => readOne('assets', id),
    getAssets: (ids) => readMany('assets', ids),
    deleteAsset: (id) => deleteOne('assets', id),
    putFont: (record) => putOne('fonts', record),
    getFont: (id) => readOne('fonts', id),
    getFonts: (ids) => readMany('fonts', ids),
    deleteFont: (id) => deleteOne('fonts', id),
    putAutosave: (record) => putOne('autosaves', record),
    getAutosave: (projectId) => readOne('autosaves', projectId),
    deleteAutosave: (projectId) => deleteOne('autosaves', projectId),
    putStackEntry: (record) => putOne('imageStack', record),
    getStackEntry: (id) => readOne('imageStack', id),
    listStackEntries: () =>
      transaction('imageStack', 'readonly', async ({ imageStack }) => {
        const entries = await imageStack.getAll();
        return entries.sort((left, right) => {
          const byDate = String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''));
          return byDate || String(left.id).localeCompare(String(right.id));
        });
      }),
    deleteStackEntries: (ids) =>
      transaction('imageStack', 'readwrite', async ({ imageStack }) => {
        await Promise.all(ids.map((id) => imageStack.delete(id)));
      }),
    clearAllLocalData: () =>
      transaction(STORE_NAMES, 'readwrite', async (stores) => {
        await Promise.all(STORE_NAMES.map((storeName) => stores[storeName].clear()));
      }),
  };
}
