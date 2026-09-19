import { expect, test, mockVisitorApis } from './fixtures';

test.use({ viewport: { width: 412, height: 915 } });

test('mobile recommendation controls remain reachable', async ({ page }) => {
  await mockVisitorApis(page);
  await page.goto('/recommend');
  await expect(page.getByText('按你的情况规划路线')).toBeVisible();
  await expect(page.getByRole('button', { name: '帮我规划路线' })).toBeVisible();
});
