import { expect, test, mockVisitorApis } from './fixtures';

test.use({ viewport: { width: 412, height: 915 } });

test('mobile recommendation controls remain reachable', async ({ page }) => {
  await mockVisitorApis(page);
  await page.goto('/recommend');
  await expect(page.getByText('场景约束路线规划')).toBeVisible();
  await expect(page.getByRole('button', { name: '生成可执行路线' })).toBeVisible();
});
