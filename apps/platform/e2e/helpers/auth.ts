import { expect, type Page } from '@playwright/test';

export async function loginAsStudent(page: Page) {
  await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'student@casuya.co.tz');
  await page.fill('#password', 'student123');
  await page.click('#submit-btn');
  await expect(page).toHaveURL(/\/student\/?$/, { timeout: 30000 });
  await expect(page.locator('#student-content')).toBeVisible({ timeout: 15000 });
}

export async function loginAsTeacher(page: Page) {
  await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'teacher@casuya.co.tz');
  await page.fill('#password', 'teacher123');
  await page.click('#submit-btn');
  await expect(page).toHaveURL(/\/teacher\/?$/, { timeout: 30000 });
  await expect(page.locator('#teacher-content')).toBeVisible({ timeout: 15000 });
}
