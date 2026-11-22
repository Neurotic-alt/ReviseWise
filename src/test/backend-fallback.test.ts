import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: new Proxy(
    {},
    {
      get() {
        throw new Error("Missing Supabase environment variable(s): SUPABASE_URL.");
      },
    },
  ),
}));

import { backend, resetBackendCheck } from "@/lib/data/backend";
import { signOutStudent, startSync } from "@/lib/data/cloud-sync";
import { tasksStore } from "@/lib/data/stores";

describe("When the account connection is missing", () => {
  beforeEach(() => resetBackendCheck());

  it("reports no backend instead of throwing", () => {
    expect(() => backend()).not.toThrow();
    expect(backend()).toBeNull();
  });

  it("starting sync keeps the browser's data and does not throw", async () => {
    const before = tasksStore.get();
    await expect(startSync("user-1", "a@b.c")).resolves.toBeUndefined();
    expect(tasksStore.get()).toEqual(before);
  });

  it("signing out does not throw", async () => {
    await expect(signOutStudent()).resolves.toBeUndefined();
  });
});
