import { expect, type Page } from '@playwright/test';

export async function openSubjectsView(page: Page) {
  await expect(page.locator('#student-content')).toBeVisible();
  const sidebarToggle = page.locator('#sidebar-toggle');
  if (await sidebarToggle.isVisible()) {
    await sidebarToggle.click();
    await expect(page.locator('#student-sidebar')).toHaveClass(/open/);
  }

  const subjectsNav = page.locator('#student-nav [data-view="subjects"]');
  const mathCard = page.locator('.subject-card', { hasText: 'Mathematics' });
  await expect(async () => {
    if (!(await mathCard.isVisible())) {
      await subjectsNav.scrollIntoViewIfNeeded();
      try {
        await subjectsNav.click({ timeout: 3000 });
      } catch {
        await subjectsNav.evaluate((el) => {
          (el as HTMLElement).click();
        });
      }
    }
    await expect(mathCard).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
  return mathCard;
}

export async function openLinearEquationsLesson(page: Page) {
  const mathCard = await openSubjectsView(page);
  await mathCard.click();
  await page.locator('.topic-card', { hasText: 'Algebra' }).click();
  await page.locator('.subtopic-card', { hasText: 'Linear Equations' }).click();
  await page.locator('.lesson-card', { hasText: 'Introduction to Linear Equations' }).click();
  await expect(page.locator('.lesson-iframe iframe')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#casuya-ai-chat-fab')).toBeVisible({ timeout: 30000 });
}
