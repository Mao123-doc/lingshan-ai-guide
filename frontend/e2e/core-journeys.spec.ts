import { expect, test, loginAsAdmin, mockVisitorApis } from './fixtures';

test('J01 home capability opens QA module', async ({ page }) => {
  await mockVisitorApis(page);
  await page.goto('/');
  await page.getByRole('button', { name: '开始提问' }).click();
  await expect(page).toHaveURL(/\/qa$/);
});

test('J02 text QA renders answer and evidence', async ({ page }) => {
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

test('J04 QA evidence is accessible', async ({ page }) => {
  await mockVisitorApis(page);
  await page.goto('/qa');
  await page.getByPlaceholder(/想问什么/).fill('灵山大佛有多高？');
  await page.getByPlaceholder(/想问什么/).press('Enter');
  await page.getByRole('button', { name: '查看依据' }).click();
  await expect(page.getByText('大佛通高88米。')).toBeVisible();
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

test('J07 homepage route entry opens the planner', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '规划路线', exact: true }).click();
  await expect(page).toHaveURL(/\/recommend$/);
});

test('J08 admin login reaches knowledge maintenance', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByText('知识库管理')).toBeVisible();
});

test('J09 knowledge page loads documents and supports upload', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/knowledge');
  await expect(page.getByText('guide.txt')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'uploaded.txt', mimeType: 'text/plain', buffer: Buffer.from('测试知识文档') });
  await expect(page.getByText(/上传成功/)).toBeVisible();
});

test('J10 retired admin pages return to the homepage', async ({ page }) => {
  await page.goto('/admin/digital-human');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '开始提问' })).toBeVisible();
});

test('J12 mobile viewport has no horizontal overflow on home', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
