import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { streamLLM } from '../../src/services/llm-service';
import { saveConversation } from '../../src/db/store';
test('stream provider truncation must reject even after yielding a partial answer', async () => {
    const original = globalThis.fetch;
    process.env.DEEPSEEK_API_KEY = 'test';
    globalThis.fetch = async () => new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'));
            controller.close();
        }
    }), {
        headers: {
            'Content-Type': 'text/event-stream'
        }
    });
    const chunks: string[] = [];
    try {
        await assert.rejects(async () => {
            for await (const token of streamLLM([{
                    role: 'user',
                    content: 'hello'
                }]))
                chunks.push(token);
        }, /incomplete/i);
        assert.deepEqual(chunks, ['partial']);
    }
    finally {
        globalThis.fetch = original;
        delete process.env.DEEPSEEK_API_KEY;
    }
});
test('awaiting conversation audit guarantees persisted data and failures reject', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lingshan-audit-'));
    process.env.DATA_ROOT = directory;
    try {
        const value = {
            id: 'id',
            session_id: 'session',
            timestamp: new Date().toISOString(),
            query: 'q',
            answer: 'a',
            emotion: 'think',
            used_llm: false,
            response_time_ms: 0
        };
        await saveConversation(value);
        assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'conversations.json'), 'utf8'))[0].id, 'id');
        fs.unlinkSync(path.join(directory, 'conversations.json'));
        fs.mkdirSync(path.join(directory, 'conversations.json'));
        await assert.rejects(saveConversation(value));
    }
    finally {
        delete process.env.DATA_ROOT;
        fs.rmSync(directory, {
            recursive: true,
            force: true
        });
    }
});
test('partial RAG stream failure does not save a successful history; fallback stores one turn', async () => {
    const original = globalThis.fetch;
    const { queryRAG, getSessionHistory, streamRAGQuery } = await import('../../src/services/rag-service');
    process.env.DEEPSEEK_API_KEY = 'test';
    globalThis.fetch = async () => new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n', {
        headers: {
            'Content-Type': 'text/event-stream'
        }
    });
    try {
        const session = 'partial-' + Date.now();
        const tokens: string[] = [];
        await assert.rejects(queryRAG('测试', session, {
            enableQueryRewrite: false,
            enableRerank: false,
            enableVectorRetrieval: false,
            enableStructuredRetrieval: false
        }, token => tokens.push(token)), /incomplete/);
        assert.deepEqual(tokens, ['partial']);
        assert.deepEqual(getSessionHistory(session), []);
        delete process.env.DEEPSEEK_API_KEY;
        const fallbackSession = 'fallback-' + Date.now();
        const chunks: string[] = [];
        for await (const chunk of streamRAGQuery('测试', fallbackSession, {
            enableQueryRewrite: false,
            enableRerank: false,
            enableVectorRetrieval: false,
            enableStructuredRetrieval: false
        }))
            chunks.push(chunk);
        assert.equal(chunks.length, 1);
        assert.equal(getSessionHistory(fallbackSession).length, 2);
    }
    finally {
        globalThis.fetch = original;
        delete process.env.DEEPSEEK_API_KEY;
    }
});
