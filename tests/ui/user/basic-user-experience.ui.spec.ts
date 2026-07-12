import { expect, test } from '@playwright/test';
import path from 'path';

test.describe('Basic registered user - profile, settings, chat', () => {
  test('can upload avatar, switch black/white theme, and see 3 example chat questions', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);

    const nameInput = page.locator('input[placeholder="TÃªn cá»§a báº¡n"]');
    await expect(nameInput).not.toHaveValue('', { timeout: 20_000 });

    const avatarFile = path.join(process.cwd(), 'data', 'avatars', '1.jpg');
    await page.locator('input[type="file"]').setInputFiles(avatarFile);
    await expect(page.getByText('ÄÃ£ cáº­p nháº­t thÃ´ng tin.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('img[alt="avatar"]')).toBeVisible();

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    await page.getByText('Tá»‘i', { exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByText('SÃ¡ng', { exact: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    const exampleQuestionsToggle = page.locator('#example-questions-toggle');
    await expect(exampleQuestionsToggle).toBeVisible();
    if ((await exampleQuestionsToggle.getAttribute('aria-checked')) !== 'true') {
      await exampleQuestionsToggle.click();
    }
    await expect(exampleQuestionsToggle).toHaveAttribute('aria-checked', 'true');

    await page.goto('/chat');
    await expect(page).toHaveURL(/\/chat/);

    const exampleQuestionCards = page
      .locator('main button')
      .filter({ has: page.locator('svg') });
    await expect(exampleQuestionCards).toHaveCount(3, { timeout: 20_000 });

    await expect(page.locator('textarea, input').last()).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: /CÆ¡ báº£n|Suy luáº­n/ })).toBeVisible();
  });
});
