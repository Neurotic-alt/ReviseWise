import { describe, expect, it } from "vitest";
import { normalizeStored } from "@/lib/store";
import { greetingName } from "@/lib/greeting";

const defaults = () => ({ name: "", dailyGoalMin: 60, reminders: true });

describe("Loading saved account data safely", () => {
  it("uses an empty list when a saved list is null or not a list", () => {
    expect(normalizeStored(null, () => [])).toEqual([]);
    expect(normalizeStored({}, () => [])).toEqual([]);
    expect(normalizeStored([null, { id: "a" }, 3], () => [])).toEqual([{ id: "a" }]);
  });
  it("fills missing or null settings with defaults", () => {
    expect(normalizeStored([], defaults)).toEqual(defaults());
    expect(normalizeStored({ name: null, dailyGoalMin: 30 }, defaults)).toEqual({
      name: "", dailyGoalMin: 30, reminders: true,
    });
    expect(normalizeStored({ name: 5 }, defaults).name).toBe("");
  });
  it("greets Student when a signed-in account has no name or email", () => {
    expect(greetingName({ signedIn: true, settingsName: undefined, accountName: null, email: null })).toBe("Student");
  });
});
