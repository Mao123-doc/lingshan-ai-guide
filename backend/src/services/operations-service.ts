import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { resolveDataPath } from '../config/paths';
import type { ConversationRecord } from '../db/store';
import { parseDataset } from './structured-knowledge';
import { getKnowledgeStats } from './rag-service';
export const operationsEvents = new EventEmitter();
export function readData<T>(name: string, fallback: T): T {
    const file = resolveDataPath(name);
    if (!fs.existsSync(file))
        return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}
export function writeData(name: string, value: unknown): void {
    fs.mkdirSync(resolveDataPath(''), {
        recursive: true
    });
    const file = resolveDataPath(name), temp = `${file}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temp, JSON.stringify(value, null, 2));
        fs.renameSync(temp, file);
    }
    finally {
        if (fs.existsSync(temp))
            fs.unlinkSync(temp);
    }
}
export interface Feedback {
    id: string;
    session_id: string;
    conversation_id: string;
    rating: number;
    comment: string;
    timestamp: string;
}
export function conversations(): ConversationRecord[] {
    return readData('conversations.json', []);
}
export function feedbacks(): Feedback[] {
    return readData('feedback.json', []);
}
export function submitFeedback(input: {
    session_id: string;
    conversation_id?: string;
    rating: number;
    comment?: string;
}): Feedback {
    const record = conversations().filter(r => r.session_id === input.session_id && (!input.conversation_id || r.id === input.conversation_id)).at(-1);
    if (!record)
        throw Object.assign(new Error('未找到对应会话回答'), {
            status: 404
        });
    const all = feedbacks();
    if (all.some(f => f.conversation_id === record.id && f.session_id === record.session_id))
        throw Object.assign(new Error('该回答已评价'), {
            status: 409
        });
    const feedback = {
        id: randomUUID(),
        session_id: record.session_id,
        conversation_id: record.id,
        rating: input.rating,
        comment: input.comment || '',
        timestamp: new Date().toISOString()
    };
    writeData('feedback.json', [...all, feedback]);
    operationsEvents.emit('change', {
        type: 'feedback',
        id: feedback.id
    });
    return feedback;
}
export function category(query: string): string {
    return /票|价格|优惠/.test(query) ? 'ticket' : /路线|怎么走|导航/.test(query) ? 'route' : /历史|文化|建造/.test(query) ? 'history' : /厕所|卫生间|设施|餐饮/.test(query) ? 'facility' : 'other';
}
export function sentiment(record: ConversationRecord, feedback: Feedback[]): 'positive' | 'neutral' | 'negative' {
    const f = feedback.find(f => f.conversation_id === record.id);
    if (f)
        return f.rating >= 4 ? 'positive' : f.rating <= 2 ? 'negative' : 'neutral';
    return record.emotion === 'happy' ? 'positive' : ['angry', 'sorry'].includes(record.emotion) ? 'negative' : 'neutral';
}
export function spots(): Array<Record<string, any>> {
    const dataset = resolveDataPath('raw/knowledge_dataset.txt');
    const knowledge = fs.existsSync(dataset) ? parseDataset(fs.readFileSync(dataset, 'utf8')) : [];
    return readData<Array<Record<string, any>>>('route/spots.json', []).map(spot => {
        const record = knowledge.find(item => item.id === spot.id);
        return record ? {
            ...spot,
            area: record.area,
            fields: record.fields,
            description: record.fields.description,
            knowledge_source: 'raw/knowledge_dataset.txt'
        } : spot;
    });
}
export function hotQuestions(records: ConversationRecord[]) {
    const counts = new Map<string, number>();
    records.forEach(r => counts.set(r.query, (counts.get(r.query) || 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([question, count]) => ({
        question,
        count
    }));
}
export function summary() {
    const records = conversations(), feedback = feedbacks(), now = Date.now();
    const date = (t: string) => new Date(t).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Shanghai'
    });
    const today = date(new Date().toISOString()), week = records.filter(r => now - Date.parse(r.timestamp) < 7 * 86400000);
    const distribution = {
        positive: 0,
        neutral: 0,
        negative: 0
    };
    records.forEach(r => distribution[sentiment(r, feedback)]++);
    const days = new Map<string, number[]>();
    feedback.forEach(f => {
        const key = date(f.timestamp);
        days.set(key, [...(days.get(key) || []), f.rating]);
    });
    return {
        today_queries: records.filter(r => date(r.timestamp) === today).length,
        week_queries: week.length,
        monthly_queries: records.filter(r => now - Date.parse(r.timestamp) < 30 * 86400000).length,
        total_queries: records.length,
        avg_satisfaction: feedback.length ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length * 20 : null,
        feedback_count: feedback.length,
        total_spots: spots().length,
        total_knowledge_chunks: getKnowledgeStats().chunkCount,
        sentiment_distribution: distribution,
        satisfaction_trend: [...days].sort().map(([date, scores]) => ({
            date,
            score: scores.reduce((a, b) => a + b, 0) / scores.length
        })),
        hourly_distribution: Array.from({
            length: 24
        }, (_, hour) => ({
            hour,
            count: week.filter(r => Number(new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Shanghai',
                hour: '2-digit',
                hourCycle: 'h23'
            }).format(new Date(r.timestamp))) === hour).length
        })),
        top_hot_questions: hotQuestions(records),
        data_source: 'persisted_conversations_and_feedback',
        sentiment_method: 'explicit_feedback_then_recorded_emotion',
        knowledge_count_status: getKnowledgeStats().isIndexed ? 'indexed' : 'not_indexed'
    };
}
export const defaultAppearance = {
    name: '灵小禅',
    style_preset: 'zen_red_gold',
    voice_id: 'browser-default',
    voice_speed: 1,
    voice_pitch: 1
};
export function appearance() {
    return readData('dh_config.json', defaultAppearance);
}
