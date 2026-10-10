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
    if (url.pathname.endsWith('/session/init')) {
      return route.fulfill({ json: { session_id: 'browser-session', welcome_message: '欢迎来到灵山胜境。' } });
    }
    if (url.pathname.endsWith('/qa')) {
      return route.fulfill({ json: {
        answer: '灵山大佛高88米', session_id: request.postDataJSON().session_id, used_llm: true, response_time_ms: 12,
        evaluation_trace: { contextIds: ['guide'], retrievedDocuments: [{ id: 'guide', source: '官方指南', text: '大佛通高88米。', score: 0.03 }] },
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
        evidence: [{ name: '灵山大佛', confidence: 'high' }],
      } });
    }
    return route.fulfill({ json: [] });
  });
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
    return route.fulfill({ json: [] });
  });
}

export async function loginAsAdmin(page: Page) {
  await mockAdminApis(page);
  await page.goto('/admin/login');
  await page.getByPlaceholder('用户名').fill('admin');
  await page.getByPlaceholder('密码').fill('lingshan2026');
  await page.getByRole('button', { name: /登.*录/ }).click();
  await expect(page).toHaveURL(/\/admin\/knowledge/);
}
