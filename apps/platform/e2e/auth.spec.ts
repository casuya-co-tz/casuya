import { expect, test } from '@playwright/test';

test('invalid credentials show an inline error and stay on login.html', async ({ page }) => {
  await page.goto('/login.html');
  await page.fill('#email', 'student@casuya.co.tz');
  await page.fill('#password', 'definitely-not-the-password');
  await page.click('#submit-btn');

  await expect(page).toHaveURL(/\/login\.html/);
  await expect(page.locator('#form-error')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#form-error')).toContainText(/invalid email or password/i);
  // No portal was entered and no token was persisted.
  await expect(page.locator('#student-content')).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('casuya_token')))
    .toBeFalsy();
});

test('admin can sign in and the admin dashboard mounts', async ({ page }) => {
  await page.goto('/login.html');
  await page.fill('#email', 'admin@casuya.co.tz');
  await page.fill('#password', 'admin123');
  await page.click('#submit-btn');

  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30000 });
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.classList.contains('guard-passed')),
    )
    .toBe(true);
  // admin.bundle.js renders the whole dashboard into #app.
  await expect
    .poll(
      async () => page.evaluate(() => document.getElementById('app')?.childElementCount ?? 0),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
});

test('teacher can sign in from login.html', async ({ page }) => {
  await page.goto('/login.html');
  await page.fill('#email', 'teacher@casuya.co.tz');
  await page.fill('#password', 'teacher123');
  await page.click('#submit-btn');

  await expect(page).toHaveURL(/\/teacher\/?$/, { timeout: 30000 });
  await expect(page.locator('#teacher-content')).toBeVisible({ timeout: 15000 });
});
