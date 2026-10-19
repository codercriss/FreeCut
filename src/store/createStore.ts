import { useCallback, useRef, useSyncExternalStore } from "react";

export interface Store<S> {
  getState(): S;
  setState(next: S | ((prev: S) => S)): void;
  subscribe(listener: () => void): () => void;
}

/** Minimal vanilla store: immutable state, synchronous notifications, no dependencies. */
export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState(next) {
      const value = typeof next === "function" ? (next as (p: S) => S)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      // Copy so a listener that unsubscribes during notification can't skip another.
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** Shallow equality for selectors that return small objects/arrays. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Subscribe a component to a slice of a store. Re-renders only when the selected value changes
 * (by `isEqual`, default Object.is). The selector must be pure.
 */
export function useStore<S, T>(
  store: Store<S>,
  selector: (s: S) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const last = useRef<{ state: S; selector: (s: S) => T; value: T } | null>(null);
  const getSnapshot = useCallback((): T => {
    const state = store.getState();
    const prev = last.current;
    if (prev && prev.state === state && prev.selector === selector) return prev.value;
    const value = selector(state);
    if (prev && isEqual(prev.value, value)) {
      last.current = { state, selector, value: prev.value };
      return prev.value;
    }
    last.current = { state, selector, value };
    return value;
  }, [store, selector, isEqual]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
