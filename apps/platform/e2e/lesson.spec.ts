import { expect, test } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { openSubjectsView } from './helpers/student-nav';

test('student can open a seeded lesson and see the iframe', async ({ page }) => {
  await loginAsStudent(page);

  const mathCard = await openSubjectsView(page);
  await mathCard.click();
  await page.locator('.topic-card', { hasText: 'Algebra' }).click();
  await page.locator('.subtopic-card', { hasText: 'Linear Equations' }).click();
  await page.locator('.lesson-card', { hasText: 'Introduction to Linear Equations' }).click();

  await expect(page.locator('.lesson-iframe')).toBeVisible();
  await expect(page.locator('.lesson-iframe iframe')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Introduction to Linear Equations' })).toBeVisible();
});
