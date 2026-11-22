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
      state = raw ? (JSON.parse(raw) as T) : seed();
    } catch {
      state = seed();
    }
    return state as T;
  };

  const store: PersistentStore<T> = {
    get,
    set(updater) {
      state = updater(get());
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
