// Who the Dashboard greets. Pure so the rule is testable.

/** Name the app shipped with as a placeholder; saved settings may still hold it. */
const LEGACY_PLACEHOLDER_NAME = "Alex";
export const GUEST_NAME = "Student";

/** Name from the sign-in account's profile (Google sends full_name / name). */
export function accountName(meta: Record<string, unknown> | undefined | null): string | null {
  for (const k of ["full_name", "name", "display_name"]) {
    const v = meta?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Signed out: "Student". Signed in: the display name the student set in Settings,
 * else their account name, else the start of their email, else "Student".
 * Only the first word is used so the greeting stays short.
 */
export function greetingName(p: {
  signedIn: boolean;
  settingsName?: string | undefined;
  accountName?: string | null | undefined;
  email?: string | null | undefined;
}): string {
  if (!p.signedIn) return GUEST_NAME;
  const typed = p.settingsName?.trim();
  const fromEmail = p.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  const name =
    (typed && typed !== LEGACY_PLACEHOLDER_NAME ? typed : "") || p.accountName?.trim() || fromEmail || "";
  const first = name.split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : GUEST_NAME;
}
