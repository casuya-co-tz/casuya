import { expect, test } from '@playwright/test';

// Low-end Android / 2G coverage: a small viewport, a mobile UA and CDP network
// throttling standing in for the target devices that cannot be reached from CI.

test.describe('mobile viewport', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 9; SM-A102F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test('landing page renders on a small screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-content h1').first()).toBeVisible();
    // No horizontal overflow at 360px.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('student portal signs in and renders on a small screen', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'student@casuya.co.tz');
    await page.fill('#password', 'student123');
    await page.click('#submit-btn');

    await expect(page).toHaveURL(/\/student\/?$/, { timeout: 30000 });
    await expect(page.locator('#student-content')).toBeVisible({ timeout: 15000 });
  });

  test('student portal still loads under 2G throttling', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400, // ~200ms RTT round-tripped
      downloadThroughput: (50 * 1024) / 8, // 50 kbps
      uploadThroughput: (20 * 1024) / 8, // 20 kbps
    });

    await page.goto('/login.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.fill('#email', 'student@casuya.co.tz');
    await page.fill('#password', 'student123');
    await page.click('#submit-btn');

    await expect(page).toHaveURL(/\/student\/?$/, { timeout: 90000 });
    await expect(page.locator('#student-content')).toBeVisible({ timeout: 90000 });
  });
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('landing page renders in dark mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-content h1').first()).toBeVisible();
    const scheme = await page.evaluate(
      () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    );
    expect(scheme).toBe(true);
  });
});
