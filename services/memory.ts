import { MemoryEntry, TokenUsage } from '../types';

const MEMORY_KEY = 'ressynth_memory';
const MAX_MEMORY_ENTRIES = 50;
const MAX_MEMORY_SIZE_BYTES = 4 * 1024 * 1024; // 4MB localStorage budget

export function saveSession(entry: MemoryEntry): void {
  try {
    const entries = loadAllSessions();
    entries.push(entry);

    // Trim oldest if over limit
    const trimmed = entries.slice(-MAX_MEMORY_ENTRIES);

    // Check size and trim further if needed
    let serialized = JSON.stringify(trimmed);
    while (serialized.length > MAX_MEMORY_SIZE_BYTES && trimmed.length > 1) {
      trimmed.shift();
      serialized = JSON.stringify(trimmed);
    }

    localStorage.setItem(MEMORY_KEY, serialized);
  } catch (e) {
    console.error('Failed to save session to memory:', e);
  }
}

export function loadAllSessions(): MemoryEntry[] {
  try {
    const stored = localStorage.getItem(MEMORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function loadSession(sessionId: string): MemoryEntry | null {
  const sessions = loadAllSessions();
  return sessions.find(s => s.sessionId === sessionId) || null;
}

export function deleteSession(sessionId: string): void {
  const sessions = loadAllSessions().filter(s => s.sessionId !== sessionId);
  localStorage.setItem(MEMORY_KEY, JSON.stringify(sessions));
}

export function clearAllSessions(): void {
  localStorage.removeItem(MEMORY_KEY);
}

export function getMemoryUsageBytes(): number {
  const stored = localStorage.getItem(MEMORY_KEY);
  return stored ? new Blob([stored]).size : 0;
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
