import { test, expect } from '@playwright/test';

test.describe('Kiểm thử Giao diện (UI) - Trang cá nhân & Trò chuyện', () => {

  test('1. Kiểm thử Trang trò chuyện (/chat) - Đã đăng nhập', async ({ page }) => {
    // 1. Điều hướng đến trang chat
    await page.goto('/chat');

    // 2. Xác nhận đã vào trang chat (không bị redirect về /login)
    await expect(page).toHaveURL(/\/chat/);

    // 3. Kiểm tra xem các phần tử giao diện chat có hiển thị không
    const chatTitle = page.locator('h1, h2, div').filter({ hasText: /Trò chuyện|Chat/i }).first();
    await expect(chatTitle).toBeVisible({ timeout: 10_000 });
  });

  test('2. Kiểm thử Trang hồ sơ cá nhân (/profile) - Thay đổi thông tin', async ({ page }) => {
    // 1. Điều hướng đến trang cá nhân
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);

    // 2. Kiểm tra xem các trường thông tin cơ bản có hiển thị đúng không
    const nameInput = page.locator('input').first(); // Ô nhập Họ và tên
    await expect(nameInput).toBeVisible();
    const initialName = await nameInput.inputValue();
    expect(initialName).not.toBe('');

    // 3. Thực hiện thay đổi Họ và tên
    const newName = `Test User ${Date.now()}`;
    await nameInput.fill(newName);

    // 4. Nhấn lưu thay đổi
    const saveButton = page.getByRole('button', { name: /Lưu thay đổi/i });
    await saveButton.click();

    // 5. Kiểm tra thông báo Toast thành công hiển thị
    const toastSuccess = page.getByText(/Thành công|Đã cập nhật/i);
    await expect(toastSuccess).toBeVisible({ timeout: 10_000 });

    // 6. Reload trang để xác minh dữ liệu đã được lưu thành công trên Server
    await page.reload();
    await expect(nameInput).toHaveValue(newName);
  });

  test('3. Kiểm thử Trang hồ sơ cá nhân (/profile) - Nhập URL ảnh đại diện', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);

    // 1. Tìm ô nhập URL ảnh đại diện vừa được thêm vào giao diện
    const avatarUrlInput = page.getByPlaceholder('https://example.com/avatar.png');
    await expect(avatarUrlInput).toBeVisible();

    // 2. Điền URL ảnh đại diện mới
    const testAvatarUrl = 'https://prod-persona.20206205.tech/images/12.jpg';
    await avatarUrlInput.fill(testAvatarUrl);

    // 3. Xác minh xem ảnh preview có thay đổi src tương ứng không
    const avatarImg = page.locator('img[alt="avatar"]');
    await expect(avatarImg).toHaveAttribute('src', testAvatarUrl);

    // 4. Lưu thay đổi
    const saveButton = page.getByRole('button', { name: /Lưu thay đổi/i });
    await saveButton.click();

    // 5. Chờ thông báo thành công
    const toastSuccess = page.getByText(/Thành công|Đã cập nhật/i);
    await expect(toastSuccess).toBeVisible();

    // 6. Tải lại trang để xác nhận URL ảnh vẫn được lưu trữ
    await page.reload();
    await expect(avatarUrlInput).toHaveValue(testAvatarUrl);
    await expect(avatarImg).toHaveAttribute('src', testAvatarUrl);
  });

});
