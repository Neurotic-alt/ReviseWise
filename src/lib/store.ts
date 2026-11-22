import { useSyncExternalStore } from "react";

/**
 * Tiny persistent store backed by localStorage.
 * Every page reads and writes student data through these stores, so they can be
 * swapped for Lovable Cloud tables later without touching the UI.
 * The server snapshot is `undefined`, so pages show a skeleton until the browser hydrates.
 */
export interface PersistentStore<T> {
  get: () => T;
  set: (updater: (prev: T) => T) => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Makes saved data (browser copy or account row) safe to use: a list store always holds a
 * list of records, an object store always has every default field. Empty, null or
 * wrongly-shaped data falls back to the defaults instead of crashing a page.
 */
export function normalizeStored<T>(value: unknown, fallback: () => T): T {
  const base = fallback();
  if (Array.isArray(base)) {
    if (!Array.isArray(value)) return base;
    return value.filter((x) => x !== null && typeof x === "object") as T;
  }
  if (base !== null && typeof base === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return base;
    const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const d = merged[k];
      if (v === null || v === undefined) continue;
      if (d !== undefined && d !== null && typeof d !== typeof v) continue;
      merged[k] = v;
    }
    return merged as T;
  }
  return value === null || value === undefined ? base : (value as T);
}

const STORAGE_PREFIX = "revisewise:v1:";
const registry: PersistentStore<unknown>[] = [];

export function createPersistentStore<T>(key: string, seed: () => T): PersistentStore<T> {
  const storageKey = STORAGE_PREFIX + key;
  let state: T | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const get = () => {
    if (state !== undefined) return state;
    try {
      const raw = window.localStorage.getItem(storageKey);
      state = raw ? normalizeStored<T>(JSON.parse(raw), seed) : seed();
    } catch {
      state = seed();
    }
    return state as T;
  };

  const store: PersistentStore<T> = {
    get,
    set(updater) {
      state = normalizeStored<T>(updater(get()), seed);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* storage full or blocked — keep in memory */
      }
      emit();
    },
    reset() {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      state = undefined;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  registry.push(store as PersistentStore<unknown>);
  return store;
}

const serverSnapshot = () => undefined;

export function useStore<T>(store: PersistentStore<T>): T | undefined {
  return useSyncExternalStore(store.subscribe, store.get, serverSnapshot);
}

export function resetAllStores() {
  registry.forEach((s) => s.reset());
}

let cachedToday: Date | undefined;
let cachedTodayKey = "";
const getToday = () => {
  const now = new Date();
  const key = now.toDateString();
  if (key !== cachedTodayKey) {
    cachedTodayKey = key;
    cachedToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return cachedToday as Date;
};
const noopSubscribe = () => () => {};

/** Today's date in the student's timezone; undefined during server render. */
export function useToday(): Date | undefined {
  return useSyncExternalStore(noopSubscribe, getToday, serverSnapshot);
}
