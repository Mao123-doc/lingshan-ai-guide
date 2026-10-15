import { expect, test as base, type Page } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, runFixture) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await runFixture(page);
    if (pageErrors.length > 0) {
      throw new Error(`Uncaught page exception(s): ${pageErrors.join(' | ')}`);
    }
  },
});

export { expect };

export async function mockVisitorApis(page: Page) {
  const routePlanRequests: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/visitor/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/route/graph')) return route.fulfill({ json: { spots: [{ id: 'south_gate', name: '景区南门', lat: 31.42, lng: 120.09, visit_minutes: 0, mobility: {wheelchair_accessible: true}, opening_windows: ['00:00-24:00'], source: 'test', confidence: 'estimated' }], edges: [], performances: [], facilities: [] } });
    if (url.pathname.endsWith('/dh-config')) {
      return route.fulfill({ json: { style_preset: 'zen_red_gold', voice_id: 'test-voice' } });
    }
    if (url.pathname.endsWith('/session/init')) {
      return route.fulfill({ json: { session_id: 'browser-session', welcome_message: '欢迎来到灵山胜境。' } });
    }
    if (url.pathname.endsWith('/qa')) {
      return route.fulfill({ json: { answer: '灵山大佛高88米', used_llm: false, response_time_ms: 15,
        evaluation_trace: { retrievedDocuments: [{ id: 'guide-1', text: '灵山大佛高88米。', source: 'knowledge_guide.txt', score: 0.8 }] },
      } });
    }
    if (url.pathname.endsWith('/route/plan')) {
      const body = request.postDataJSON();
      routePlanRequests.push(body as Record<string, unknown>);
      return route.fulfill({ json: {
        outcome: 'feasible',
        feasibility: true,
        route: { steps: [{ spotId: 'LS-011', start: '10:00', end: '11:00', arrive: '10:10', walkMinutes: 10, visitMinutes: 50 }], totalMinutes: 60, walkingMinutes: 10, visitingMinutes: 50 },
        scene_state: { missingCriticalFields: [], hardConstraints: [] },
        evidence: [{ spot_id: 'LS-011', name: '灵山大佛', confidence: 'estimated' }],
      } });
    }
    if (url.pathname.endsWith('/feedback')) return route.fulfill({ json: { status: 'ok' } });
    if (url.pathname.endsWith('/nearby-facilities')) return route.fulfill({ json: { facilities: [{ name: '游客中心', distance: 120, lat: 31.43, lng: 120.09 }] } });
    if (url.pathname.endsWith('/nearby')) return route.fulfill({ json: { nearby_spots: [] } });
    return route.fulfill({ json: [] });
  });
  await page.route('http://127.0.0.1:8001/tts', route => route.fulfill({ json: { audio_base64: '' } }));
  return { routePlanRequests };
}

export async function mockAdminApis(page: Page) {
  await page.route('**/api/v1/auth/**', async route => {
    if (route.request().url().endsWith('/login')) {
      return route.fulfill({ json: { access_token: 'browser-token', role: 'admin', username: 'admin' } });
    }
    return route.fulfill({ json: { access_token: 'browser-token' } });
  });
  await page.route('**/api/v1/admin/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/knowledge/documents') && request.method() === 'GET') {
      return route.fulfill({ json: [{ id: 'guide.txt', name: 'guide.txt', size: 100, date: '2026-09-16', status: 'indexed' }] });
    }
    if (url.pathname.endsWith('/knowledge/documents') && request.method() === 'POST') {
      return route.fulfill({ json: { id: 'uploaded.txt', status: 'indexed', title: 'uploaded.txt' } });
    }
    if (url.pathname.endsWith('/knowledge/refresh-index')) return route.fulfill({ json: { status: 'ok', chunkCount: 2 } });
    if (url.pathname.endsWith('/digital-human/appearance')) {
      return route.fulfill({ json: { style_preset: 'ink_wash', voice_id: 'test-voice' } });
    }
    if (url.pathname.endsWith('/reports/sentiment')) return route.fulfill({ json: {
      period: 'week', total_queries: 0, avg_sentiment: 0,
      sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
      hot_questions: [], top_spots: [], summary: '',
    } });
    if (url.pathname.endsWith('/dashboard/summary')) return route.fulfill({ json: {
      today_queries: 0, week_queries: 0, monthly_queries: 0, avg_satisfaction: 0,
      total_knowledge_chunks: 0, total_spots: 0,
      sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
      satisfaction_trend: [], hourly_distribution: [], top_hot_questions: [],
    } });
    if (url.pathname.endsWith('/conversations/export')) return route.fulfill({ contentType: 'text/csv', body: '\ufeffid,query\n' });
    return route.fulfill({ json: [] });
  });
}

export async function loginAsAdmin(page: Page) {
  await mockAdminApis(page);
  await page.goto('/admin/login');
  await page.getByPlaceholder('用户名').fill('admin');
  await page.getByPlaceholder('密码').fill('public-browser-test-password');
  await page.getByRole('button', { name: /登.*录/ }).click();
  await expect(page).toHaveURL(/\/admin\/knowledge/);
}
