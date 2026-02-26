const SESSION_KEY = 'ninja-session';
const DEMO_USERS = [{ username: 'admin', password: 'ninja2026' }];

export function login(username: string, password: string): boolean {
  const user = DEMO_USERS.find(
    (u) => u.username === username.trim() && u.password === password.trim()
  );
  if (user) {
    localStorage.setItem(SESSION_KEY, btoa(username));
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(SESSION_KEY);
}

export function getUsername(): string | null {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;
  try {
    return atob(token);
  } catch {
    return null;
  }
}
