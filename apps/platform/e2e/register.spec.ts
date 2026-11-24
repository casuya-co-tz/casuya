import { expect, test } from '@playwright/test';

test('new student can register from register.html and reach the portal', async ({ page }) => {
  const email = `e2e-reg-${Date.now()}@casuya.co.tz`;

  await page.goto('/register.html');
  await page.fill('#full_name', 'E2E Registered Student');
  await page.fill('#email', email);
  await page.selectOption('#role', 'student');
  await page.fill('#password', 'Casuya!E2e2026x');
  await page.fill('#confirm_password', 'Casuya!E2e2026x');
  await page.check('#terms');
  await page.click('#submit-btn');

  await expect(page).toHaveURL(/\/student\/?$/, { timeout: 30000 });
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('casuya_token')))
    .toBeTruthy();
  await expect(page.locator('#student-content')).toBeVisible({ timeout: 15000 });
});

test('register form rejects a weak password before any network call', async ({ page }) => {
  await page.goto('/register.html');
  await page.fill('#full_name', 'E2E Weak Password');
  await page.fill('#email', `e2e-weak-${Date.now()}@casuya.co.tz`);
  await page.selectOption('#role', 'student');
  await page.fill('#password', 'abcdef');
  await page.fill('#confirm_password', 'abcdef');
  await page.check('#terms');

  const requests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/auth/register')) requests.push(req.url());
  });

  await page.click('#submit-btn');

  await expect(page.locator('#password-error')).toBeVisible();
  await expect(page.locator('#password-error')).toContainText(/at least 8 characters/i);
  await expect(page).toHaveURL(/\/register\.html/);
  expect(requests).toHaveLength(0);
});
