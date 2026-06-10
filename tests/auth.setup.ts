import { test as setup, expect, Page } from '@playwright/test';
import { createMailAccount, waitForEmail, extractConfirmLink } from '../helpers/mail-tm';
import { generateSafeTOTP } from '../helpers/totp';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = path.join(__dirname, '../playwright/.auth');
const USER_STATE_FILE = path.join(AUTH_DIR, 'user.json');
const ACCOUNT_FILE = path.join(AUTH_DIR, 'account.json');

async function fillOtpInputs(page: Page, code: string, prefix: string) {
  for (let i = 0; i < 6; i++) {
    const input = page.locator(`#${prefix}-${i}`);
    await input.click();
    await input.fill(code[i]);
    await page.waitForTimeout(100);
  }
}

async function handleMfaSetup(page: Page) {
  const secretLocator = page.locator('code').first();
  await expect(secretLocator).toBeVisible({ timeout: 15_000 });
  const secret = (await secretLocator.textContent())?.trim() || '';
  console.log(`[Setup] Đọc được MFA Secret: ${secret.substring(0, 8)}...`);

  if (!secret) throw new Error('Không đọc được secret key từ màn hình MFA setup');

  // Tính TOTP code
  const totpCode = await generateSafeTOTP(secret);
  console.log(`[Setup] Mã TOTP: ${totpCode}`);

  // Điền 6 ô OTP
  await fillOtpInputs(page, totpCode, 'otp-setup');

  // Click "Kích hoạt & Tiếp tục"
  await page.getByRole('button', { name: /Kích hoạt/i }).click();
}

setup('Đăng ký, xác nhận Email, đăng nhập và lưu Auth State', async ({ page }) => {
  // Tạo thư mục lưu trữ auth state nếu chưa có
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // 1. Tạo tài khoản email thực qua mail.tm
  console.log('[Setup] Đang tạo tài khoản mail.tm...');
  const account = await createMailAccount();
  console.log(`[Setup] Email: ${account.address}`);

  // 2. Mở trang login
  await page.goto('/login');
  await expect(page).toHaveURL('/login');

  // 3. Chuyển sang tab Đăng ký
  await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản' })).toBeVisible();

  // 4. Điền thông tin đăng ký
  await page.fill('input[type="email"]', account.address);
  await page.fill('input[type="password"]', account.password);

  // 5. Submit form Đăng ký
  await page.getByRole('button', { name: 'Đăng ký' }).click();

  // 6. Chờ màn hình yêu cầu xác nhận email xuất hiện
  await expect(page.getByText('Xác nhận Email')).toBeVisible({ timeout: 15_000 });
  console.log('[Setup] Đã đăng ký thành công, chờ nhận email...');

  // 7. Nhận email xác nhận
  const emailHtml = await waitForEmail(account.token, 180_000);
  console.log('[Setup] Đã nhận được email xác nhận');

  // 8. Trích xuất link xác nhận
  const confirmLink = extractConfirmLink(emailHtml);
  console.log(`[Setup] URL xác nhận: ${confirmLink}`);

  // 9. Điều hướng tới link xác nhận để hoàn tất đăng ký của Supabase
  await page.goto(confirmLink);

  // 10. Chờ chuyển hướng về trang /chat hoặc /auth/mfa
  await page.waitForURL(/\/(login|chat|auth)/, { timeout: 30_000 });
  console.log(`[Setup] Redirect đến URL: ${page.url()}`);

  // 11. Nếu trang chuyển về /login, tiến hành đăng nhập bằng tài khoản vừa tạo
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"]', account.address);
    await page.fill('input[type="password"]', account.password);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/(auth\/mfa|chat)/, { timeout: 30_000 });
  }

  // 12. Xử lý thiết lập MFA nếu được yêu cầu
  if (page.url().includes('/auth/mfa')) {
    // Chờ loading biến mất
    await page.waitForSelector('text=Đang chuẩn bị', { state: 'hidden', timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const isSetupMode = await page.evaluate(() => {
      const text = document.body.innerText;
      return /Kích hoạt|Thiết lập|setup/i.test(text);
    });

    if (isSetupMode) {
      console.log('[Setup] Yêu cầu thiết lập MFA lần đầu');
      await handleMfaSetup(page);
    }
  }

  // 13. Kiểm tra xem đã đăng nhập thành công vào /chat chưa
  await expect(page).toHaveURL(/\/chat/, { timeout: 30_000 });
  console.log('[Setup] ✅ Đăng nhập thành công vào trang chủ /chat');

  // 14. Lưu trữ state (cookies và localStorage) vào user.json
  await page.context().storageState({ path: USER_STATE_FILE });
  
  // Lưu thông tin account để các test khác tham chiếu nếu cần
  fs.writeFileSync(ACCOUNT_FILE, JSON.stringify({
    email: account.address,
    password: account.password
  }, null, 2));

  console.log('[Setup] ✅ Đã lưu Auth State thành công tại playwright/.auth/user.json');
});
