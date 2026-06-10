import { test, expect } from '@playwright/test';

// Đường dẫn API của Supabase Auth Service
const BASE_URL = process.env.API_BASE_URL || 'https://api.20206205.tech/api/prod/supabase-auth-service';

test.describe('Kiểm thử API MFA (Supabase Multi-Factor Authentication)', () => {
  let accessToken = '';
  let tempFactorId = '';
  let challengeId = '';

  // Đăng ký một tài khoản mới và đăng nhập để lấy token thực hiện test MFA
  test.beforeAll(async ({ request }) => {
    const uniqueEmail = `mfa_test_${Date.now()}@example.com`;
    const password = 'SecurePassword123!';

    // 1. Đăng ký
    await request.post(`${BASE_URL}/auth/v1/signup`, {
      data: { email: uniqueEmail, password },
    });

    // 2. Đăng nhập
    const response = await request.post(`${BASE_URL}/auth/v1/token?grant_type=password`, {
      data: { email: uniqueEmail, password },
    });

    if (response.status() === 200) {
      const data = await response.json();
      accessToken = data.access_token;
    } else {
      console.warn('⚠️ beforeAll: Đăng nhập không thành công (có thể do yêu cầu xác thực email), các test yêu cầu token sẽ bị skip.');
    }
  });

  test('1. Enroll MFA (Đăng ký yếu tố xác thực mới) - Không có token (401 Unauthorized)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/v1/factors`, {
      data: {
        factor_type: 'totp',
        friendly_name: 'Unauthenticated Device',
        issuer: 'Dev-20206205Tech',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('2. Enroll MFA (Đăng ký yếu tố xác thực mới) - Có token hợp lệ', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    const response = await request.post(`${BASE_URL}/auth/v1/factors`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        factor_type: 'totp',
        friendly_name: 'My Playwright Device',
        issuer: 'Playwright-Test-Suite',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('id');
    expect(data.type).toBe('totp');
    expect(data).toHaveProperty('totp');
    expect(data.totp).toHaveProperty('qr_code');
    expect(data.totp).toHaveProperty('secret');
    expect(data.totp).toHaveProperty('uri');

    tempFactorId = data.id; // Lưu lại factorId cho các test case sau
  });

  test('3. Challenge MFA (Tạo thử thách xác thực) - Có token hợp lệ', async ({ request }) => {
    if (!accessToken || !tempFactorId) {
      test.skip();
    }

    const response = await request.post(`${BASE_URL}/auth/v1/factors/${tempFactorId}/challenge`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('expires_at');

    challengeId = data.id; // Lưu lại challengeId cho các bước sau
  });

  test('4. Verify MFA (Xác thực mã OTP) - Thất bại với code không hợp lệ', async ({ request }) => {
    if (!accessToken || !tempFactorId || !challengeId) {
      test.skip();
    }

    const response = await request.post(`${BASE_URL}/auth/v1/factors/${tempFactorId}/verify`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        challenge_id: challengeId,
        code: '000000', // Sai mã OTP
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('invalid_grant');
  });

  test('5. List Factors (Lấy danh sách MFA factors)', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    // Endpoint get user info
    const response = await request.get(`${BASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('factors');
    expect(Array.isArray(data.factors)).toBeTruthy();
    
    // Tìm factor vừa tạo
    const found = data.factors.find((f: any) => f.id === tempFactorId);
    expect(found).toBeDefined();
    expect(found.friendly_name).toBe('My Playwright Device');
  });

  test('6. Update MFA Factor (Cập nhật tên thiết bị)', async ({ request }) => {
    if (!accessToken || !tempFactorId) {
      test.skip();
    }

    const response = await request.put(`${BASE_URL}/auth/v1/factors/${tempFactorId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        friendly_name: 'Renamed Playwright Device',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.friendly_name).toBe('Renamed Playwright Device');
  });

  test('7. Unenroll MFA Factor (Hủy đăng ký MFA factor)', async ({ request }) => {
    if (!accessToken || !tempFactorId) {
      test.skip();
    }

    const response = await request.delete(`${BASE_URL}/auth/v1/factors/${tempFactorId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);
  });
});