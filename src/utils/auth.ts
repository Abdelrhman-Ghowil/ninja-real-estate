const SESSION_KEY = 'ninja-session';
const ROLE_KEY = 'ninja-role';

const DEMO_USERS = [
  { username: 'admin', password: 'ninja2026', role: 'reviewer' },
  { username: 'admin2', password: 'admin123', role: 'admin' },
];

export function login(username: string, password: string): boolean {
  const user = DEMO_USERS.find(
    (u) => u.username === username.trim() && u.password === password.trim()
  );
  if (user) {
    localStorage.setItem(SESSION_KEY, btoa(username));
    localStorage.setItem(ROLE_KEY, user.role);
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROLE_KEY);
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

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export function canAccessRecords(): boolean {
  return getRole() === 'admin';
}
