import { test, expect } from '@playwright/test';

test.describe('Kiểm thử Giao diện MFA (UI E2E MFA)', () => {

  test('1. Kiểm tra trạng thái MFA hiển thị trong trang Profile', async ({ page }) => {
    // 1. Vào trang cá nhân
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);

    // 2. Kiểm tra phần MFA đã kích hoạt
    const mfaHeading = page.getByRole('heading', { name: /Bảo mật 2 bước|MFA/i });
    await expect(mfaHeading).toBeVisible();

    const activeStatus = page.getByText(/Đang hoạt động \(TOTP\)/i);
    await expect(activeStatus).toBeVisible({ timeout: 10_000 });
  });

  test('2. Kiểm tra Dialog cảnh báo Hủy liên kết MFA', async ({ page }) => {
    await page.goto('/profile');

    // 1. Tìm container chứa thiết bị MFA đang hoạt động và nút xóa bên trong nó
    const mfaSection = page.locator('div').filter({ has: page.getByRole('heading', { name: /Bảo mật 2 bước|MFA/i }) }).first();
    const deleteButton = mfaSection.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // 2. Đảm bảo Dialog cảnh báo mở ra
    const dialogTitle = page.getByText('Hủy liên kết MFA?');
    await expect(dialogTitle).toBeVisible();

    const dialogDescription = page.getByText(/Hành động này sẽ tắt bảo mật 2 bước/i);
    await expect(dialogDescription).toBeVisible();

    // 3. Nhấn "Quay lại" để hủy bỏ hành động (không thực sự delete để tránh hỏng auth state cho test khác)
    const cancelButton = page.getByRole('button', { name: 'Quay lại' });
    await cancelButton.click();

    // 4. Xác nhận dialog đã đóng
    await expect(dialogTitle).toBeHidden();
  });
});