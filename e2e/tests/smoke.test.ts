import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Smoke tests', () => {
  test('welcome page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /good finds/i })).toBeVisible();
  });

  test('switches between Buy and Sell while preserving the Buy search and keyboard access', async ({
    page,
  }) => {
    const session = {
      user: {
        _id: '64b000000000000000000001',
        name: 'Samarth Patil',
        email: 'samarth.patil24@pccoepune.org',
        role: 'STUDENT',
        emailVerifiedAt: '2026-10-07T00:00:00.000Z',
        lastActiveMode: 'BUY',
        sellerOnboardedAt: null as string | null,
        campusLocation: null,
        pickupPreference: null,
        phone: null,
        isSuspended: false,
        createdAt: '2026-10-07T00:00:00.000Z',
        updatedAt: '2026-10-07T00:00:00.000Z',
      },
      badgeCounts: { buy: 0, sell: 0 },
    };
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      }),
    );
    await page.route('**/api/me/mode', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lastActiveMode: 'SELL' }),
      }),
    );
    await page.route('**/api/me/seller-onboarding', (route) => {
      session.user.sellerOnboardedAt = '2026-10-07T00:00:00.000Z';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sellerOnboardedAt: session.user.sellerOnboardedAt }),
      });
    });

    await page.goto('/buy');
    await expect(page.getByRole('tab', { name: 'Buy' })).toHaveAttribute('aria-selected', 'true');
    const buyAccessibility = await new AxeBuilder({ page }).analyze();
    expect(
      buyAccessibility.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
    await page.getByRole('textbox', { name: 'Search items' }).fill('Calculus');
    await page.evaluate(() => window.scrollTo(0, 160));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(160);
    await page.getByRole('tab', { name: 'Sell' }).click();
    await expect(page).toHaveURL(/\/sell\/onboarding$/);
    await expect(page.getByRole('heading', { name: 'Start selling on Resello' })).toBeVisible();
    await page.getByLabel('Latitude').fill('18.65');
    await page.getByLabel('Longitude').fill('73.76');
    await page.getByLabel('Pickup preference').selectOption('HOSTEL_GATE');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start selling' }).click();
    await expect(page).toHaveURL(/\/sell$/);
    await expect(page.getByRole('heading', { name: /good things deserve/i })).toBeVisible();
    const sellAccessibility = await new AxeBuilder({ page }).analyze();
    expect(
      sellAccessibility.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
    await page.getByRole('tab', { name: 'Buy' }).click();
    await expect(page).toHaveURL(/\/buy$/);
    await expect(page.getByRole('textbox', { name: 'Search items' })).toHaveValue('Calculus');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(160);

    const buyTab = page.getByRole('tab', { name: 'Buy' });
    const sellTab = page.getByRole('tab', { name: 'Sell' });
    await buyTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(sellTab).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/sell$/);
  });

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://localhost:5000/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
