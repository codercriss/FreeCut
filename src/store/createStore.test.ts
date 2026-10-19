import { describe, expect, it } from "vitest";
import { createStore, shallowEqual } from "./createStore";

describe("createStore", () => {
  it("notifies on change, not on identical state", () => {
    const s = createStore({ n: 0 });
    let calls = 0;
    s.subscribe(() => calls++);
    const same = s.getState();
    s.setState(same);
    expect(calls).toBe(0);
    s.setState({ n: 1 });
    s.setState((p) => ({ n: p.n + 1 }));
    expect(s.getState().n).toBe(2);
    expect(calls).toBe(2);
  });
  it("unsubscribes, even during a notification", () => {
    const s = createStore(0);
    const seen: string[] = [];
    const offA = s.subscribe(() => {
      seen.push("a");
      offA();
    });
    s.subscribe(() => seen.push("b"));
    s.setState(1);
    s.setState(2);
    expect(seen).toEqual(["a", "b", "b"]);
  });
  it("shallowEqual", () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: [] }, { a: [] })).toBe(false);
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual(null, {})).toBe(false);
  });
});
