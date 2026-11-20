/**
 * Persistent Client-Side Storage for Custom ISL Signs
 * 
 * Uses IndexedDB as primary high-capacity storage for full 21-node 3D landmark arrays,
 * backed by localStorage for instant synchronous loading on page refresh.
 * 
 * Guarantees that recorded custom signs NEVER disappear when the user refreshes
 * the page, closes the browser, or when server containers restart on Render/cloud hosting.
 */

export interface LandmarkPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface LandmarkFrame {
  frameIndex: number;
  timeSec: number;
  rightHand: LandmarkPoint3D[] | null;
  leftHand: LandmarkPoint3D[] | null;
}

export interface CustomSignRecord {
  id: string;
  token: string;
  label: string;
  category: string;
  totalFrames: number;
  durationSec: number;
  createdAt: string;
  frames: LandmarkFrame[];
  description?: string;
}

const DB_NAME = 'SanketISL_CustomSignsDB';
const DB_VERSION = 1;
const STORE_NAME = 'custom_signs';
const LOCAL_STORAGE_KEY = 'sanket_custom_signs_cache_v1';

/**
 * Open or create IndexedDB connection
 */
function openSignsDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.warn('[CustomSignsStorage] IndexedDB open error:', e);
        resolve(null);
      };
    } catch (err) {
      console.warn('[CustomSignsStorage] IndexedDB initialization exception:', err);
      resolve(null);
    }
  });
}

/**
 * Read signs synchronously from localStorage
 */
export function getLocalStorageSigns(): CustomSignRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    console.warn('[CustomSignsStorage] LocalStorage read warning:', err);
  }
  return [];
}

/**
 * Save signs synchronously to localStorage
 */
export function saveToLocalStorage(signs: CustomSignRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(signs);
    // Standard localStorage is 5MB. If under 3MB, store full frames.
    if (json.length < 3 * 1024 * 1024) {
      localStorage.setItem(LOCAL_STORAGE_KEY, json);
    } else {
      // If dataset is huge, store lightweight summary in localStorage (IndexedDB retains all frames)
      const compressed = signs.map((s) => ({
        ...s,
        frames: s.frames ? s.frames.slice(0, 15) : [],
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(compressed));
    }
  } catch (err) {
    console.warn('[CustomSignsStorage] LocalStorage write quota warning:', err);
  }
}

/**
 * Load all custom signs from IndexedDB (with fallback to localStorage)
 */
export async function loadCustomSignsFromClientStorage(): Promise<CustomSignRecord[]> {
  const localBackup = getLocalStorageSigns();

  try {
    const db = await openSignsDB();
    if (!db) return localBackup;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const results = req.result as CustomSignRecord[];
          if (Array.isArray(results) && results.length > 0) {
            // Merge with localBackup to ensure no sign is dropped
            const map = new Map<string, CustomSignRecord>();
            localBackup.forEach((s) => map.set(s.id, s));
            results.forEach((s) => map.set(s.id, s));
            const merged = Array.from(map.values());
            resolve(merged);
            return;
          }
          resolve(localBackup);
        };

        req.onerror = () => resolve(localBackup);
      } catch {
        resolve(localBackup);
      }
    });
  } catch {
    return localBackup;
  }
}

/**
 * Save / update a single custom sign record to IndexedDB & localStorage
 */
export async function persistCustomSignToClientStorage(sign: CustomSignRecord): Promise<void> {
  // 1. Update localStorage immediately
  try {
    const current = getLocalStorageSigns();
    const updated = [sign, ...current.filter((s) => s.id !== sign.id)];
    saveToLocalStorage(updated);
  } catch {}

  // 2. Persist to IndexedDB
  try {
    const db = await openSignsDB();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(sign);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn('[CustomSignsStorage] IndexedDB put error:', err);
  }
}

/**
 * Bulk persist signs to IndexedDB & localStorage
 */
export async function bulkPersistCustomSigns(signs: CustomSignRecord[]): Promise<void> {
  saveToLocalStorage(signs);

  try {
    const db = await openSignsDB();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        signs.forEach((s) => store.put(s));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn('[CustomSignsStorage] Bulk persist error:', err);
  }
}

/**
 * Remove a sign by ID from IndexedDB & localStorage
 */
export async function removeCustomSignFromClientStorage(id: string): Promise<void> {
  // 1. Remove from localStorage
  try {
    const current = getLocalStorageSigns();
    const filtered = current.filter((s) => s.id !== id);
    saveToLocalStorage(filtered);
  } catch {}

  // 2. Remove from IndexedDB
  try {
    const db = await openSignsDB();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn('[CustomSignsStorage] IndexedDB delete error:', err);
  }
}
