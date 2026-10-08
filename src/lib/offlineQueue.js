// =============================================================================
// Offline IndexedDB Outbox Queue for Universal Expense Tracker Pro
// Ensures zero data loss and idempotent sync upon reconnection
// =============================================================================

const DB_NAME = 'UniversalExpenseOutboxDB';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[OfflineQueue] IndexedDB open error:', request.error);
      resolve(null);
    };
  });
}

export async function enqueueOfflineTransaction(transactionPayload) {
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        ...transactionPayload,
        queuedAt: new Date().toISOString(),
      });

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.warn('[OfflineQueue] Failed to enqueue:', request.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[OfflineQueue] Exception enqueuing:', err);
    return false;
  }
}

export async function getPendingOfflineTransactions() {
  try {
    const db = await openDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('[OfflineQueue] Exception reading outbox:', err);
    return [];
  }
}

export async function removeOfflineTransaction(idempotencyKey) {
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(idempotencyKey);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[OfflineQueue] Exception deleting from outbox:', err);
    return false;
  }
}

export async function countOfflineTransactions() {
  try {
    const db = await openDB();
    if (!db) return 0;

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => resolve(0);
    });
  } catch (err) {
    return 0;
  }
}
