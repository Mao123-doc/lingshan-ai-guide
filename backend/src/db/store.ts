/** Conversation audit persistence; a resolved write is available to feedback immediately. */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolveDataPath } from '../config/paths';
import { operationsEvents } from '../services/operations-service';

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
const writeLocks = new Map<string, Promise<void>>();

export function saveConversation(record: ConversationRecord): Promise<void> {
  const file = resolveDataPath('conversations.json');
  const previous = writeLocks.get(file) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => {
    fs.mkdirSync(resolveDataPath(''), { recursive: true });
    const records: ConversationRecord[] = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify([...records, record].slice(-10000), null, 2));
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    operationsEvents.emit('change', { type: 'new_query', id: record.id });
  });
  writeLocks.set(file, next);
  void next.finally(() => { if (writeLocks.get(file) === next) writeLocks.delete(file); }).catch(() => {});
  return next;
}
