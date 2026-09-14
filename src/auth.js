import account from "./auth-account.json" with { type: "json" };
export const SESSION_KEY = "qaansheeg-session";
const ACCOUNT_KEY = "qaansheeg-account";
const WEEK = 7 * 24 * 60 * 60 * 1000;
export function safeReturnTo(value) {
  return typeof value === "string" &&
    /^\/(qaansheegyo|macaamiisha|dejinta)(\/|\?|$)/.test(value) &&
    !value.includes("\\")
    ? value
    : "/qaansheegyo";
}
export const authAdapter = {
  async restoreSession() {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    let session;
    try {
      session = JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
      /* invalid session */
    }
    const now = Date.now();
    if (
      !session ||
      session.userId !== account.email ||
      typeof session.sessionId !== "string" ||
      !Number.isFinite(session.loginTime) ||
      !Number.isFinite(session.expiresAt) ||
      session.loginTime > now ||
      session.expiresAt <= now ||
      session.expiresAt - session.loginTime !== WEEK
    ) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { ...session, email: account.email, role: account.role };
  },
  async login(email, password) {
    const [, iterations, salt, expected] = account.passwordHash.split(":");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: new TextEncoder().encode(salt),
        iterations: Number(iterations),
      },
      key,
      256,
    );
    const actual = [...new Uint8Array(bits)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (email.trim().toLowerCase() !== account.email || actual !== expected)
      return null;
    const loginTime = Date.now();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        userId: account.email,
        sessionId: crypto.randomUUID(),
        loginTime,
        expiresAt: loginTime + WEEK,
      }),
    );
    return this.restoreSession();
  },
  async logout() {
    localStorage.removeItem(SESSION_KEY);
  },
};
