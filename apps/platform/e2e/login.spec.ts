import { expect, test } from '@playwright/test';

test('student can sign in from login.html', async ({ page }) => {
  await page.goto('/login.html');
  await page.fill('#email', 'student@casuya.co.tz');
  await page.fill('#password', 'student123');
  await page.click('#submit-btn');

  await expect(page).toHaveURL(/\/student\/?$/);
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('casuya_token')))
    .toBeTruthy();
  await expect(page.locator('#student-content')).toBeVisible();
});
