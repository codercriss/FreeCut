/** Tiny promise wrapper over IndexedDB — just what the project repository needs, no dependencies. */

export const DB_NAME = "freecut";
export const DB_VERSION = 2;
export type StoreName = "projects" | "meta" | "media";

export class StorageUnavailableError extends Error {
  constructor(message = "IndexedDB is not available in this browser context") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Forget the cached connection (tests; also lets the app recover after a blocked/failed open). */
export function resetDbCache(): void {
  const p = dbPromise;
  dbPromise = null;
  void p?.then((db) => db.close()).catch(() => undefined);
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const factory = typeof indexedDB === "undefined" ? undefined : indexedDB;
  if (!factory) return Promise.reject(new StorageUnavailableError());
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(DB_NAME, DB_VERSION);
    } catch (e) {
      // Firefox private mode etc. throw synchronously.
      reject(new StorageUnavailableError(e instanceof Error ? e.message : undefined));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 → v2 (Phase 1a): added the `media` store. Upgrades NEVER delete or rewrite existing data.
      if (!db.objectStoreNames.contains("projects"))
        db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("media")) db.createObjectStore("media", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgraded the DB, or the browser is reclaiming it: drop our handle so the next call reopens.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(new StorageUnavailableError(req.error?.message));
    req.onblocked = () =>
      reject(new StorageUnavailableError("IndexedDB open was blocked by another tab"));
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        let result: T;
        req.onsuccess = () => {
          result = req.result;
        };
        // Resolve on transaction completion, not request success, so a write is durable when we report it.
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      }),
  );
}

export const idbGet = <T>(store: StoreName, key: string) =>
  run<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbPut = (store: StoreName, value: unknown) =>
  run(store, "readwrite", (s) => s.put(value));
export const idbDelete = (store: StoreName, key: string) =>
  run(store, "readwrite", (s) => s.delete(key));
export const idbGetAllKeys = (store: StoreName) =>
  run<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys());
export const idbGetAll = <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll());
