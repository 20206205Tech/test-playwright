import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// API Base URL of Supabase Auth Service
const BASE_URL = process.env.API_BASE_URL || 'https://api.20206205.tech/api/prod/supabase-auth-service';

// Trích xuất Access Token từ file state của Playwright
function getAccessToken(): string {
  try {
    const filePath = path.join(process.cwd(), 'playwright/.auth/user.json');
    if (!fs.existsSync(filePath)) {
      return '';
    }
    const state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const origins = state.origins || [];
    for (const item of origins) {
      const authTokensItem = item.localStorage?.find((x: any) => x.name === 'auth_tokens');
      if (authTokensItem) {
        const parsed = JSON.parse(authTokensItem.value);
        return parsed.access_token || '';
      }
    }
  } catch (error) {
    console.error('Lỗi đọc token từ playwright/.auth/user.json:', error);
  }
  return '';
}

test.describe('Kiểm thử API MFA (Supabase Multi-Factor Authentication) sử dụng Playwright Auth State', () => {
  let accessToken = '';
  let activeFactorId = '';

  test.beforeAll(async ({ request }) => {
    accessToken = getAccessToken();
    if (accessToken) {
      console.log('[MFA API Test] Đã tìm thấy Access Token từ playwright/.auth/user.json');
      
      // Lấy danh sách các factors hiện có của người dùng
      const response = await request.get(`${BASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.status() === 200) {
        const userData = await response.json();
        const factors = userData.factors || [];
        if (factors.length > 0) {
          activeFactorId = factors[0].id;
          console.log(`[MFA API Test] Đã tìm thấy MFA Factor ID đang hoạt động: ${activeFactorId}`);
        }
      }
    } else {
      console.warn('[MFA API Test] Không tìm thấy Access Token. Một số test case yêu cầu xác thực sẽ bị skip.');
    }
  });

  test('1. List Factors - Lấy danh sách MFA factors của người dùng', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    const response = await request.get(`${BASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('factors');
    expect(Array.isArray(data.factors)).toBeTruthy();
  });

  test('2. Enroll MFA - Bắt đầu đăng ký thêm một thiết bị/yếu tố TOTP mới', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    const response = await request.post(`${BASE_URL}/auth/v1/factors`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        factor_type: 'totp',
        friendly_name: 'Secondary Device',
        issuer: 'Playwright-MFA-Suite',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data.type).toBe('totp');
    expect(data.totp).toHaveProperty('secret');
    expect(data.totp).toHaveProperty('qr_code');

    // Dọn dẹp: Hủy đăng ký ngay yếu tố phụ này để tránh tích tụ rác trong DB
    await request.delete(`${BASE_URL}/auth/v1/factors/${data.id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  });

  test('3. Challenge MFA - Tạo thử thách xác thực cho factor đang hoạt động', async ({ request }) => {
    if (!accessToken || !activeFactorId) {
      test.skip();
    }

    const response = await request.post(`${BASE_URL}/auth/v1/factors/${activeFactorId}/challenge`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('type');
    expect(data.type).toBe('totp');
  });

  test('4. Verify MFA - Xác thực thử thách thất bại khi gửi mã OTP sai', async ({ request }) => {
    if (!accessToken || !activeFactorId) {
      test.skip();
    }

    // 1. Tạo challenge
    const challengeRes = await request.post(`${BASE_URL}/auth/v1/factors/${activeFactorId}/challenge`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const challenge = await challengeRes.json();
    const challengeId = challenge.id;

    // 2. Gửi mã OTP sai (ví dụ: '000000')
    const response = await request.post(`${BASE_URL}/auth/v1/factors/${activeFactorId}/verify`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        challenge_id: challengeId,
        code: '000000',
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('invalid_grant');
  });

  test('5. Update MFA Factor - Đổi tên thân thiện của thiết bị xác thực', async ({ request }) => {
    if (!accessToken || !activeFactorId) {
      test.skip();
    }

    const updatedName = `Updated Device ${Date.now()}`;
    const response = await request.put(`${BASE_URL}/auth/v1/factors/${activeFactorId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        friendly_name: updatedName,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.friendly_name).toBe(updatedName);
  });
});