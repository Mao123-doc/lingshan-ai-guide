import { expect, test, loginAsAdmin, mockVisitorApis } from './fixtures';

test('J01 home capability opens QA module', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '智能问答，点击进入' }).click();
  await expect(page).toHaveURL(/\/qa$/);
});

test('J02 text QA renders streamed answer', async ({ page }) => {
  await mockVisitorApis(page);
  await page.goto('/qa');
  await expect(page.getByText('欢迎来到灵山胜境。')).toBeVisible();
  await page.getByPlaceholder(/想问什么/).fill('灵山大佛有多高？');
  await page.getByPlaceholder(/想问什么/).press('Enter');
  await expect(page.getByText('灵山大佛高88米')).toBeVisible();
});

test('J03 follow-up remains in the same QA session', async ({ page }) => {
  await mockVisitorApis(page);
  await page.goto('/qa');
  await expect(page.getByText('欢迎来到灵山胜境。')).toBeVisible();
  const input = page.locator('textarea').first();
  await input.fill('第一个问题');
  await input.press('Enter');
  await expect(page.getByText('灵山大佛高88米')).toBeVisible();
  await input.fill('那它在哪里？');
  await input.press('Enter');
  await expect(page.getByText('那它在哪里？')).toBeVisible();
});

test('J04 voice unsupported path stays usable', async ({ page }) => {
  await mockVisitorApis(page);
  await page.addInitScript(() => { delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition; });
  await page.goto('/qa');
  await page.getByRole('button').filter({ has: page.locator('.anticon-audio') }).click();
  await expect(page.getByPlaceholder(/想问什么|正在聆听/)).toBeVisible();
});

test('J05 feasible scene route shows visitor-friendly outcome', async ({ page }) => {
  const { routePlanRequests } = await mockVisitorApis(page);
  await page.goto('/recommend');
  await page.getByPlaceholder(/我带腿脚不方便的妈妈/).fill('我在景区入口，还有三小时');
  await page.getByRole('button', { name: '帮我规划路线' }).click();
  await expect(page.getByText('可以按这条路线游览')).toBeVisible();
  await expect(page.getByText('灵山大佛').first()).toBeVisible();
  await expect(page.getByText('LS-011')).not.toBeVisible();
  expect(routePlanRequests).toHaveLength(1);
  expect(routePlanRequests[0]).toMatchObject({ query: '我在景区入口，还有三小时' });
});

test('J06 recommendation renders route cards', async ({ page }) => {
  const { routePlanRequests } = await mockVisitorApis(page);
  await page.goto('/recommend');
  await page.getByText('佛教文化').click();
  await page.getByRole('button', { name: '生成推荐路线' }).click();
  await expect(page.getByText('推荐路线').last()).toBeVisible();
  await expect(page.getByText('灵山大佛').first()).toBeVisible();
  expect(routePlanRequests).toHaveLength(1);
  expect(routePlanRequests[0]).toMatchObject({
    scene_state: { currentLocation: 'south_gate', currentTime: '09:00', interests: ['文化'] },
  });
});

test('J07 nearby permission success exposes nearby section', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 31.43205, longitude: 120.09151 });
  await page.goto('/');
  await page.getByRole('button', { name: '查找附近景点' }).click();
  await expect(page.locator('#nearby').getByRole('heading', { name: /附近景点/ })).toBeVisible();
});

test('J08 admin login reaches dashboard', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByText('今日问答')).toBeVisible();
});

test('J09 knowledge page loads documents and supports upload', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/knowledge');
  await expect(page.getByText('guide.txt')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'uploaded.txt', mimeType: 'text/plain', buffer: Buffer.from('测试知识文档') });
  await expect(page.getByText(/上传成功/)).toBeVisible();
});

test('J10 digital-human page loads configured appearance', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/digital-human');
  await expect(page.getByText('数字人形象管理')).toBeVisible();
});

test('J11 reports page loads sentiment period', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/reports');
  await expect(page.getByText('游客感受度报告')).toBeVisible();
});

test('J12 mobile viewport has no horizontal overflow on home', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
