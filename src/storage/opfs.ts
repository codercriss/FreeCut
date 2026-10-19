/**
 * Origin Private File System access for imported media (Phase 1 fills this in).
 *
 * Phase 0 ships the typed skeleton + a unit-tested in-memory contract so Phase 1 can rely on it.
 *
 * Known risk (research note R-002): `createWritable()` is not available in every browser's OPFS
 * implementation (older Safari only offers synchronous access handles inside Workers). `write()` throws a
 * clear OpfsUnsupportedError when it can't write, so callers can fall back to a Worker path or tell the user.
 */

export class OpfsUnsupportedError extends Error {
  constructor(message = "Origin Private File System is not available here") {
    super(message);
    this.name = "OpfsUnsupportedError";
  }
}

export const isOpfsSupported = (): boolean =>
  typeof navigator !== "undefined" &&
  !!navigator.storage &&
  typeof navigator.storage.getDirectory === "function";

const MEDIA_DIR = "media";

export interface MediaStore {
  write(id: string, data: Blob): Promise<void>;
  read(id: string): Promise<File | null>;
  remove(id: string): Promise<void>;
  list(): Promise<string[]>;
}

/** Ids become file names, so allow only a safe character set. */
export function assertSafeId(id: string): void {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id) || id === "." || id === "..")
    throw new Error(`Unsafe media id: ${id}`);
}

export function createMediaStore(
  getRoot: () => Promise<FileSystemDirectoryHandle> = defaultRoot,
): MediaStore {
  const dir = async () => (await getRoot()).getDirectoryHandle(MEDIA_DIR, { create: true });
  return {
    async write(id, data) {
      assertSafeId(id);
      const handle = await (await dir()).getFileHandle(id, { create: true });
      if (typeof handle.createWritable !== "function")
        throw new OpfsUnsupportedError("createWritable() is not supported");
      const w = await handle.createWritable();
      try {
        await w.write(data);
      } finally {
        await w.close();
      }
    },
    async read(id) {
      assertSafeId(id);
      try {
        return await (await (await dir()).getFileHandle(id)).getFile();
      } catch (e) {
        if (e instanceof DOMException && e.name === "NotFoundError") return null;
        throw e;
      }
    },
    async remove(id) {
      assertSafeId(id);
      try {
        await (await dir()).removeEntry(id);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "NotFoundError")) throw e;
      }
    },
    async list() {
      const names: string[] = [];
      // `keys()` is typed in lib.dom for FileSystemDirectoryHandle.
      for await (const name of (await dir()).keys()) names.push(name);
      return names.sort();
    },
  };
}

async function defaultRoot(): Promise<FileSystemDirectoryHandle> {
  if (!isOpfsSupported()) throw new OpfsUnsupportedError();
  return navigator.storage.getDirectory();
}
