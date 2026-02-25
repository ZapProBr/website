// Auth stub — no real authentication logic.
// Login accepts anything, no cookies or localStorage checks.

export function getDynamicUsers(): Array<{ email: string; password: string; name: string }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("zapprobr_dynamic_users");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDynamicUser(user: { email: string; password: string; name: string }) {
  const users = getDynamicUsers();
  users.push(user);
  localStorage.setItem("zapprobr_dynamic_users", JSON.stringify(users));
}
