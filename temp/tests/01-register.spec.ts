import { test, expect, Page } from '@playwright/test';
import { createMailAccount, waitForEmail, extractConfirmLink } from '../helpers/mail-tm';
import fs from 'fs';
import path from 'path';

// File để lưu thông tin tài khoản giữa các test suite
const ACCOUNT_FILE = path.join(__dirname, '..', 'data', 'temp', '.account.json');
const TOKEN_FILE = path.join(__dirname, '..', 'data', 'temp', '.token.json');

test.describe('01 - Đăng Ký Tài Khoản', () => {
  test('Đăng ký tài khoản mới qua mail.tm + xác nhận email', async ({ page }) => {
    // 1. Tạo tài khoản email thực
    console.log('[Register] Đang tạo tài khoản mail.tm...');
    const account = await createMailAccount();
    console.log(`[Register] Email: ${account.address}`);

    // 2. Mở trang login
    await page.goto('/login');
    await expect(page).toHaveURL('/login');

    // 3. Chuyển sang tab Đăng ký
    await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
    await expect(page.getByRole('heading', { name: 'Tạo tài khoản' })).toBeVisible();

    // 4. Điền thông tin đăng ký
    await page.fill('input[type="email"]', account.address);
    await page.fill('input[type="password"]', account.password);

    // 5. Submit form
    await page.getByRole('button', { name: 'Đăng ký' }).click();

    // 6. Chờ màn hình xác nhận email
    await expect(page.getByText('Xác nhận Email')).toBeVisible({ timeout: 10_000 });
    console.log('[Register] Đã submit đăng ký, chờ email xác nhận...');

    // 7. Poll mail.tm để lấy email xác nhận
    const emailHtml = await waitForEmail(account.token, 240_000);
    console.log('[Register] Đã nhận email xác nhận');

    // 8. Trích xuất link xác nhận
    let confirmLink: string;
    try {
      confirmLink = extractConfirmLink(emailHtml);
      console.log(`[Register] Confirm link: ${confirmLink.substring(0, 80)}...`);
    } catch (e) {
      // Ghi email để debug nếu không tìm được link
      fs.writeFileSync(path.join(__dirname, '..', 'debug-email.html'), emailHtml);
      throw new Error(`Cannot extract confirm link. Email saved to debug-email.html. Error: ${e}`);
    }

    // 9. Navigate đến link xác nhận (link của Supabase/Auth server)
    await page.goto(confirmLink);

    // 10. Chờ redirect về login hoặc chat
    await page.waitForURL(/\/(login|chat|auth)/, { timeout: 15_000 });
    console.log(`[Register] Redirect đến: ${page.url()}`);

    // 11. Lưu thông tin tài khoản cho các test tiếp theo
    const { token, ...credentials } = account;
    fs.writeFileSync(ACCOUNT_FILE, JSON.stringify(credentials, null, 2));
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }, null, 2));
    console.log(`[Register] ✅ Đăng ký thành công: ${account.address}`);
  });
});
