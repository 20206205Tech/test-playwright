import { test, expect, Page } from '@playwright/test';
import { generateSafeTOTP } from '../helpers/totp';
import fs from 'fs';
import path from 'path';

const ACCOUNT_FILE = path.join(__dirname, '..', 'data', 'temp', '.account.json');
const MFA_SECRET_FILE = path.join(__dirname, '..', 'data', 'temp', '.mfa-secret.txt');
const COOKIES_FILE = path.join(__dirname, '..', 'data', 'temp', '.cookies.json');
const LOCAL_STORAGE_FILE = path.join(__dirname, '..', 'data', 'temp', '.localStorage.json');

interface Account {
  address: string;
  password: string;
}

/**
 * Điền OTP vào 6 ô input dựa theo prefix ID
 */
async function fillOtpInputs(page: Page, code: string, prefix: string) {
  for (let i = 0; i < 6; i++) {
    const input = page.locator(`#${prefix}-${i}`);
    await input.click();
    await input.fill(code[i]);
    await page.waitForTimeout(100); // nhỏ delay giống người dùng thật
  }
}

test.describe('02 - Đăng Nhập + MFA', () => {
  let account: Account;

  test.beforeAll(() => {
    if (!fs.existsSync(ACCOUNT_FILE)) {
      throw new Error('Chưa có file .test-account.json. Hãy chạy test 01-register trước!');
    }
    account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf-8'));
    console.log(`[MFA] Dùng tài khoản: ${account.address}`);
  });

  test('Đăng nhập và thiết lập MFA lần đầu', async ({ page }) => {
    // 1. Mở trang login
    await page.goto('/login');

    // 2. Điền thông tin
    const isSignupMode = await page.getByRole('button', { name: 'Đăng ký' }).isVisible().catch(() => false);
    if (isSignupMode) {
      console.log('[MFA] Đang ở chế độ Đăng ký, chuyển sang Đăng nhập...');
      await page.getByText('Quay lại Đăng nhập').click();
    }

    console.log(`[MFA] Filling email: ${account.address}`);
    await page.fill('input[type="email"]', account.address);
    await page.fill('input[type="password"]', account.password);
    await page.keyboard.press('Enter');

    // 3. Chờ redirect sang trang MFA hoặc Chat (hoặc báo lỗi)
    try {
      await page.waitForURL(/\/(auth\/mfa|chat)/, { timeout: 60_000 });
    } catch (e) {
      console.log(`[MFA] Timeout! URL hiện tại: ${page.url()}`);
      throw e;
    }
    console.log(`[MFA] Đã redirect sang: ${page.url()}`);

    if (page.url().includes('/chat')) {
      console.log('[MFA] Đã vào thẳng /chat, bỏ qua bước MFA.');
    } else {
      // Chờ hết loading state
      await page.waitForSelector('text=Đang chuẩn bị', { state: 'hidden', timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(2000); // Thêm chút delay cho chắc

    // 4. Chờ trang MFA load xong (có thể là setup hoặc verify)
    const isSetupMode = await page.evaluate(() => {
      const text = document.body.innerText;
      return /Kích hoạt|Thiết lập|setup/i.test(text);
    });

    console.log(`[MFA] isSetupMode: ${isSetupMode}`);
    if (isSetupMode) {
      console.log('[MFA] Mode: Setup (lần đầu thiết lập)');
      await handleMfaSetup(page);
    } else {
      console.log('[MFA] Mode: Verify (đã có factor)');
      // Trường hợp này cần secret đã lưu
      const savedSecret = process.env.MFA_SECRET;
      if (!savedSecret) throw new Error('MFA_SECRET env var required for verify mode');
      await handleMfaVerify(page, savedSecret);
    }

    }

    // 5. Verify đã vào chat
    await expect(page).toHaveURL(/\/chat/, { timeout: 15_000 });
    console.log('[MFA] ✅ Đăng nhập thành công vào /chat');

    // 6. Lưu auth state (cookies + localStorage) riêng biệt
    const storage = await page.context().storageState();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(storage.cookies, null, 2));
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(storage.origins, null, 2));
    console.log(`[MFA] Cookies đã lưu vào ${path.basename(COOKIES_FILE)}`);
    console.log(`[MFA] LocalStorage đã lưu vào ${path.basename(LOCAL_STORAGE_FILE)}`);
  });
});

async function handleMfaSetup(page: Page) {
  // Đọc secret key từ màn hình (thẻ <code> chứa secret)
  const secretLocator = page.locator('code').first();
  await expect(secretLocator).toBeVisible({ timeout: 15_000 });
  const secret = (await secretLocator.textContent())?.trim() || '';
  console.log(`[MFA] Secret key: ${secret.substring(0, 8)}...`);

  if (!secret) throw new Error('Không đọc được secret key từ màn hình MFA setup');

  // Lưu secret để dùng lại sau
  fs.writeFileSync(MFA_SECRET_FILE, secret);
  console.log(`[MFA] Secret đã lưu vào ${path.basename(MFA_SECRET_FILE)}`);

  // Tính TOTP code
  const totpCode = await generateSafeTOTP(secret);
  console.log(`[MFA] TOTP code: ${totpCode}`);

  // Điền 6 ô OTP
  await fillOtpInputs(page, totpCode, 'otp-setup');

  // Click "Kích hoạt & Tiếp tục"
  await page.getByRole('button', { name: /Kích hoạt/i }).click();
}

async function handleMfaVerify(page: Page, secret: string) {
  // Tính TOTP code
  const totpCode = await generateSafeTOTP(secret);
  console.log(`[MFA] TOTP verify code: ${totpCode}`);

  // Điền vào form verify
  await fillOtpInputs(page, totpCode, 'otp-verify');

  // Click "Xác thực & Đăng nhập"
  await page.getByRole('button', { name: /Xác thực/i }).click();
}
