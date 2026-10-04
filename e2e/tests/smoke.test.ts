import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('welcome page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Resello')).toBeVisible();
  });

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://localhost:5000/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
