import { useSyncExternalStore } from "react";
import { backend } from "./backend";
import type { Json } from "@/integrations/supabase/types";
import { resetAllStores, type PersistentStore } from "../store";
import {
  questionHistoryStore,
  activityStore,
  chatStore,
  customQuizAttemptsStore,
  examsStore,
  missionDaysStore,
  quizAttemptsStore,
  settingsStore,
  tasksStore,
} from "./stores";

// Keeps the browser stores in step with the signed-in student's rows in `student_data`.
// Signed out: data stays in this browser only. Signed in: the account copy wins on load,
// and every later change is saved to the account shortly after it happens.

const SYNCED: Record<string, PersistentStore<unknown>> = {
  "question-history": questionHistoryStore,
  tasks: tasksStore,
  exams: examsStore,
  "quiz-attempts": quizAttemptsStore,
  "custom-quiz-attempts": customQuizAttemptsStore,
  settings: settingsStore,
  activity: activityStore,
  "mission-days": missionDaysStore,
  "companion-chat": chatStore,
} as Record<string, PersistentStore<unknown>>;

const SAVE_DELAY_MS = 800;

export type SyncState = "guest" | "loading" | "saving" | "saved" | "error";
interface SyncStatus {
  state: SyncState;
  email: string | null;
  /** Name from the sign-in account (e.g. Google profile), if any. */
  name: string | null;
}

let status: SyncStatus = { state: "guest", email: null, name: null };
const listeners = new Set<() => void>();
const setStatus = (next: Partial<SyncStatus>) => {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
};

let userId: string | null = null;
let applyingRemote = false;
let unsubscribers: (() => void)[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let pending = 0;

function valueFor(key: string): Json {
  const store = SYNCED[key];
  if (!store) return null;
  // Respect the "Keep chat history" privacy setting.
  if (key === "companion-chat" && !settingsStore.get().saveChatHistory) return [];
  return store.get() as Json;
}

async function save(key: string) {
  const uid = userId;
  const db = backend();
  if (!uid || !db) return;
  pending += 1;
  setStatus({ state: "saving" });
  const { error } = await db
    .from("student_data")
    .upsert({ user_id: uid, key, data: valueFor(key) }, { onConflict: "user_id,key" });
  pending -= 1;
  if (uid !== userId) return;
  if (error) {
    console.error("[sync] save failed", key, error.message);
    setStatus({ state: "error" });
  } else if (pending === 0) {
    setStatus({ state: "saved" });
  }
}

function queueSave(key: string) {
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void save(key);
    }, SAVE_DELAY_MS),
  );
}

function flushAll(): Promise<void[]> {
  const keys = [...timers.keys()];
  for (const key of keys) {
    clearTimeout(timers.get(key));
    timers.delete(key);
  }
  return Promise.all(keys.map((k) => save(k)));
}

/** Saves anything still waiting, then signs out (which clears this browser's copy). */
export async function signOutStudent() {
  await flushAll();
  const db = backend();
  if (db) await db.auth.signOut();
  else stopSync({ clearLocal: true });
}

const onPageHide = () => void flushAll();

/** Loads the student's saved data, or uploads this browser's data on first sign-in. */
export async function startSync(uid: string, email: string | null, name: string | null = null) {
  if (userId === uid) return;
  const db = backend();
  if (!db) return;
  stopSync();
  userId = uid;
  setStatus({ state: "loading", email, name });

  const { data, error } = await db.from("student_data").select("key, data").eq("user_id", uid);
  if (uid !== userId) return;
  if (error) {
    console.error("[sync] load failed", error.message);
    setStatus({ state: "error" });
    return;
  }

  const remote = new Map((data ?? []).map((r) => [r.key, r.data]));
  applyingRemote = true;
  for (const [key, store] of Object.entries(SYNCED)) {
    if (remote.has(key)) store.set(() => remote.get(key));
    else void save(key);
  }
  applyingRemote = false;

  unsubscribers = Object.entries(SYNCED).map(([key, store]) =>
    store.subscribe(() => {
      if (!applyingRemote && userId) queueSave(key);
    }),
  );
  if (typeof window !== "undefined") window.addEventListener("pagehide", onPageHide);
  if (pending === 0) setStatus({ state: "saved" });
}

/** Stops saving. On sign-out the browser copy is cleared so the next person starts fresh. */
export function stopSync(opts: { clearLocal?: boolean } = {}) {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  if (typeof window !== "undefined") window.removeEventListener("pagehide", onPageHide);
  userId = null;
  if (opts.clearLocal) resetAllStores();
  setStatus({ state: "guest", email: null, name: null });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const guest: SyncStatus = { state: "guest", email: null, name: null };

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status, () => guest);
}
