import { authenticator } from 'otplib';

/**
 * Tính mã TOTP 6 chữ số từ secret key
 * @param secret Base32 secret key (lấy từ màn hình setup MFA)
 */
export function generateTOTP(secret: string): string {
  // Làm sạch secret (bỏ spaces, uppercase)
  const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
  return authenticator.generate(cleanSecret);
}

/**
 * Kiểm tra số giây còn lại trước khi TOTP hết hạn
 * Nếu còn < 5 giây, nên chờ để tránh lỗi timing
 */
export function secondsUntilNextTOTP(): number {
  const period = authenticator.options.step || 30;
  return period - (Math.floor(Date.now() / 1000) % period);
}

/**
 * Sinh TOTP và nếu còn < 5 giây thì chờ để tránh race condition
 */
export async function generateSafeTOTP(secret: string): Promise<string> {
  const remaining = secondsUntilNextTOTP();
  if (remaining < 5) {
    console.log(`[TOTP] Còn ${remaining}s, chờ để tránh hết hạn...`);
    await new Promise((r) => setTimeout(r, (remaining + 1) * 1000));
  }
  const code = generateTOTP(secret);
  console.log(`[TOTP] Generated: ${code} (còn ~${secondsUntilNextTOTP()}s)`);
  return code;
}
