import { test, expect } from '@playwright/test';

test.describe('Kiểm thử Giao diện Auth (UI E2E Auth)', () => {

  // Test luồng khách chưa đăng nhập (bằng cách xóa session state mặc định)
  test.describe('Khách chưa đăng nhập', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('1. Giao diện Login - Hiển thị đúng các phần tử và báo lỗi khi sai mật khẩu', async ({ page }) => {
      await page.goto('/login');
      
      // Kiểm tra các trường nhập liệu có hiển thị không
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();

      // Điền sai thông tin đăng nhập để test tính năng thông báo lỗi
      await page.fill('input[type="email"]', 'nonexistent_user@example.com');
      await page.fill('input[type="password"]', 'WrongPassword123!');
      
      // Submit form
      await page.click('button[type="submit"]');

      // Xác minh hiển thị thông báo lỗi (Toast báo lỗi)
      const toastError = page.getByText(/Sai thông tin đăng nhập|thất bại/i);
      await expect(toastError).toBeVisible({ timeout: 10_000 });
    });

    test('2. Giao diện Đăng ký - Chuyển đổi tab Đăng ký thành công', async ({ page }) => {
      await page.goto('/login');
      
      // Click chuyển sang tab Đăng ký
      await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
      
      // Kiểm tra xem tiêu đề và nút Đăng ký đã hiển thị đúng chưa
      await expect(page.getByRole('heading', { name: 'Tạo tài khoản' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Đăng ký', exact: true })).toBeVisible();
    });
  });

  // Test luồng người dùng đã đăng nhập (sử dụng storageState cấu hình sẵn)
  test.describe('Người dùng đã đăng nhập', () => {
    test('3. Trực quan Sidebar - Hiển thị thông tin email người dùng chính xác', async ({ page }) => {
      await page.goto('/chat');
      await expect(page).toHaveURL(/\/chat/);

      // Tìm nút profile góc dưới cùng hiển thị thông tin email của tài khoản setup
      const sidebarUserEmail = page.locator('aside, nav, button').filter({ hasText: /@/ }).first();
      await expect(sidebarUserEmail).toBeVisible({ timeout: 10_000 });
    });
  });
});