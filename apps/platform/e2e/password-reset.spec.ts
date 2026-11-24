import { expect, test } from '@playwright/test';

test('forgot password → reset → sign in with the new password', async ({ page }) => {
  const email = `e2e-reset-${Date.now()}@casuya.co.tz`;
  const initial = 'Casuya!Reset1234x';
  const updated = 'Casuya!Reset5678x';

  // Seed a throwaway account through the API so the seeded fixtures used by
  // other specs are never touched by the password change.
  const reg = await page.request.post('/auth/register', {
    data: {
      email,
      password: initial,
      full_name: 'E2E Reset Student',
      role: 'student',
      phone: null,
      accessibility_prefs: null,
    },
  });
  expect(reg.ok()).toBe(true);

  // ── client-side validation happens before any request ──
  await page.goto('/forgot-password.html');
  const forgotRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/auth/forgot-password')) forgotRequests.push(req.url());
  });
  await page.click('#submit-btn');
  await expect(page.locator('#email-error')).toBeVisible();
  await expect(page.locator('#email-error')).toContainText(/email is required/i);
  expect(forgotRequests).toHaveLength(0);

  // ── request the reset link ──
  await page.fill('#email', email);
  await page.click('#submit-btn');
  await expect(page.locator('#success-state')).toBeVisible({ timeout: 15000 });

  // Development mode reveals the token so the flow can be completed in CI.
  await expect(page.locator('#token-reveal')).toBeVisible({ timeout: 15000 });
  const token = await page.locator('#reset-token').inputValue();
  expect(token).toBeTruthy();

  // ── follow through to the reset page ──
  await page.click('#proceed-link');
  await expect(page).toHaveURL(/\/reset-password\.html\?token=/);
  await expect(page.locator('#invalid-token')).toBeHidden();

  await page.fill('#new-password', updated);
  await page.fill('#confirm-password', updated);
  await page.click('#submit-btn');
  await expect(page.locator('#success-msg')).toBeVisible({ timeout: 15000 });

  // The new password signs in — proving the reset actually rotated it.
  await page.goto('/login.html');
  await page.fill('#email', email);
  await page.fill('#password', updated);
  await page.click('#submit-btn');
  await expect(page).toHaveURL(/\/student\/?$/, { timeout: 30000 });
  await expect(page.locator('#student-content')).toBeVisible({ timeout: 15000 });
});

test('reset-password.html without a token shows the invalid-token notice', async ({ page }) => {
  await page.goto('/reset-password.html');
  await expect(page.locator('#invalid-token')).toBeVisible();
  await expect(page.locator('#new-password')).toBeHidden();
});
