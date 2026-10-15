// Tiny per-user/per-workspace read cache so accounts & categories work offline.
const PREFIX = 'expense_cache_v1';
const k = (kind, userId, wsId) => `${PREFIX}:${kind}:${userId}:${wsId}`;

export function readCache(kind, userId, wsId) {
  try {
    const raw = localStorage.getItem(k(kind, userId, wsId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeCache(kind, userId, wsId, data) {
  try {
    localStorage.setItem(k(kind, userId, wsId), JSON.stringify(data));
  } catch {
    /* quota or private mode: ignore */
  }
}

export function clearAllCaches() {
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(PREFIX)).forEach((key) => localStorage.removeItem(key));
  } catch { /* ignore */ }
}
