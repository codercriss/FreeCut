import { describe, expect, it } from "vitest";
import { assertSafeId, createMediaStore, isOpfsSupported, OpfsUnsupportedError } from "./opfs";

/** Minimal in-memory stand-in for the OPFS handle API. */
function fakeRoot(opts: { writable?: boolean } = {}): FileSystemDirectoryHandle {
  const notFound = () => new DOMException("not found", "NotFoundError");
  const makeDir = (): FileSystemDirectoryHandle => {
    const dirs = new Map<string, FileSystemDirectoryHandle>();
    const files = new Map<string, Blob>();
    return {
      async getDirectoryHandle(name: string, o?: { create?: boolean }) {
        if (!dirs.has(name)) {
          if (!o?.create) throw notFound();
          dirs.set(name, makeDir());
        }
        return dirs.get(name)!;
      },
      async getFileHandle(name: string, o?: { create?: boolean }) {
        if (!files.has(name)) {
          if (!o?.create) throw notFound();
          files.set(name, new Blob([]));
        }
        return {
          async getFile() {
            return new File([files.get(name)!], name);
          },
          ...(opts.writable === false
            ? {}
            : {
                async createWritable() {
                  return {
                    async write(b: Blob) {
                      files.set(name, b);
                    },
                    async close() {},
                  };
                },
              }),
        } as unknown as FileSystemFileHandle;
      },
      async removeEntry(name: string) {
        if (!files.delete(name)) throw notFound();
      },
      async *keys() {
        for (const k of files.keys()) yield k;
      },
    } as unknown as FileSystemDirectoryHandle;
  };
  return makeDir();
}

/** The real OPFS root is one persistent object — build it once, not per call. */
const persistent = (o?: { writable?: boolean }) => {
  const root = fakeRoot(o);
  return async () => root;
};

describe("media store (OPFS contract)", () => {
  it("writes, reads, lists and removes", async () => {
    const m = createMediaStore(persistent());
    await m.write("clip-1.mp4", new Blob(["hello"]));
    await m.write("a.png", new Blob(["x"]));
    expect(await (await m.read("clip-1.mp4"))!.text()).toBe("hello");
    expect(await m.list()).toEqual(["a.png", "clip-1.mp4"]);
    await m.remove("clip-1.mp4");
    expect(await m.read("clip-1.mp4")).toBeNull();
    expect(await m.list()).toEqual(["a.png"]);
  });
  it("read of a missing file is null; removing a missing file is a no-op", async () => {
    const m = createMediaStore(persistent());
    await m.write("exists", new Blob(["1"]));
    expect(await (await m.read("exists"))!.text()).toBe("1");
    expect(await m.read("nope")).toBeNull();
    await expect(m.remove("nope")).resolves.toBeUndefined();
  });
  it("fails clearly where createWritable isn't supported (older Safari)", async () => {
    const m = createMediaStore(persistent({ writable: false }));
    await expect(m.write("x", new Blob(["1"]))).rejects.toBeInstanceOf(OpfsUnsupportedError);
  });
  it("rejects ids that could escape the media directory", () => {
    for (const bad of ["", "..", ".", "a/b", "a\\b", "../x", "x y", "a".repeat(200)])
      expect(() => assertSafeId(bad)).toThrow();
    for (const ok of ["clip-1.mp4", "A_b.9", "x"]) expect(() => assertSafeId(ok)).not.toThrow();
  });
  it("detects missing support", () => {
    expect(isOpfsSupported()).toBe(false); // node: no navigator.storage.getDirectory
  });
});
