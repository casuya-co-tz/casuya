import { expect, test } from '@playwright/test';

async function loginAsStudent(page: import('@playwright/test').Page) {
  await page.goto('/login.html');
  await page.fill('#email', 'student@casuya.co.tz');
  await page.fill('#password', 'student123');
  await page.click('#submit-btn');
  await expect(page).toHaveURL(/\/student\/?$/);
  await expect(page.locator('#student-content')).toBeVisible();
}

test('student can open a seeded lesson and see the iframe', async ({ page }) => {
  await loginAsStudent(page);

  await page.locator('#student-nav [data-view="subjects"]').click();
  await page.locator('.subject-card', { hasText: 'Mathematics' }).click();
  await page.locator('.topic-card', { hasText: 'Algebra' }).click();
  await page.locator('.subtopic-card', { hasText: 'Linear Equations' }).click();
  await page.locator('.lesson-card', { hasText: 'Introduction to Linear Equations' }).click();

  await expect(page.locator('.lesson-iframe')).toBeVisible();
  await expect(page.locator('.lesson-iframe iframe')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Introduction to Linear Equations' })).toBeVisible();
});
