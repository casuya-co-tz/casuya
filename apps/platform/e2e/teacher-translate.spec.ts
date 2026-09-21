import { expect, test } from '@playwright/test';

async function loginAsTeacher(page: import('@playwright/test').Page) {
  await page.goto('/login.html');
  await page.fill('#email', 'teacher@casuya.co.tz');
  await page.fill('#password', 'teacher123');
  await page.click('#submit-btn');
  await expect(page).toHaveURL(/\/teacher\/?$/);
}

test('teacher translate streams chunks', async ({ page }) => {
  test.setTimeout(60_000);
  const translated = 'Hii ni jibu la mfano.';
  const streamBody = [
    `data: ${JSON.stringify({ chunk: translated, done: false })}\n\n`,
    `data: ${JSON.stringify({ chunk: '', done: true, source: 'casuya-ai', translatedText: translated })}\n\n`,
  ].join('');

  await page.route('**/ai/content/translate/stream', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: streamBody,
    });
  });
  await page.route('**/ai/content/translate', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ translated, source: 'casuya-ai' }),
    });
  });

  await loginAsTeacher(page);
  await page.locator('[data-view="ai-assistant"]').click();
  await page.waitForResponse((resp) => resp.url().includes('/teachers/me') && resp.ok()).catch(() => {});

  const translateSection = page.locator('.card', {
    has: page.getByRole('heading', { name: 'Translate Text' }),
  });
  await expect(translateSection).toBeVisible();
  const textInput = translateSection.locator('textarea[name="text"]');
  await textInput.scrollIntoViewIfNeeded();
  await expect(textInput).toBeVisible();
  await textInput.evaluate((el, text) => {
    const input = el as HTMLTextAreaElement;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, 'This is a sample answer.');
  await expect(textInput).toHaveValue('This is a sample answer.');
  await translateSection.locator('select[name="target_language"]').selectOption('Swahili');
  await translateSection.getByRole('button', { name: 'Translate' }).click({ force: true });
  await expect(page.locator('#ai-translate-text')).toContainText(translated, { timeout: 20000 });
});
