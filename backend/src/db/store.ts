/** Core conversation audit log. No visitor analytics or feedback aggregation. */
import fs from 'fs';
import { resolveDataPath } from '../config/paths';

export interface ConversationRecord {
  id: string;
  session_id: string;
  timestamp: string;
  query: string;
  answer: string;
  emotion: string;
  used_llm: boolean;
  response_time_ms: number;
}

/** Per-file Promise chains to serialize concurrent writes and prevent data loss. */
const writeLocks = new Map<string, Promise<void>>();

function readJSON<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error(`Failed to read ${filePath}:`, e);
  }
  return defaultVal;
}

function writeJSON(filePath: string, data: unknown): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Failed to write ${filePath}:`, e);
  }
}

/**
 * Enqueue an atomic read-modify-write operation on a JSON file.
 * Prevents concurrent writes from overwriting each other.
 */
function enqueueUpdate<T>(filePath: string, mutator: (data: T) => T, defaultVal: T): void {
  const prev = writeLocks.get(filePath) || Promise.resolve();
  const next = prev.then(() => {
    const data = readJSON<T>(filePath, defaultVal);
    const updated = mutator(data);
    writeJSON(filePath, updated);
  }).catch(err => {
    console.error(`[Store] Write failed for ${filePath}:`, err?.message || err);
  });
  writeLocks.set(filePath, next);
}

export function saveConversation(record: ConversationRecord): void {
  const directory = resolveDataPath('');
  fs.mkdirSync(directory, { recursive: true });
  enqueueUpdate<ConversationRecord[]>(resolveDataPath('conversations.json'), records => [...records, record].slice(-10000), []);
}
