"use client";

const KEY = "promptiq.session";

export function signIn(email: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email, at: Date.now() }));
  } catch {}
}

export function signOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function getSession(): { email: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
