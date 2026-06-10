import { test, expect } from '@playwright/test';

// Đường dẫn API của Supabase Auth Service
const BASE_URL = process.env.API_BASE_URL || 'https://api.20206205.tech/api/prod/supabase-auth-service';

test.describe('Kiểm thử API Auth (Supabase Auth)', () => {
  const uniqueEmail = `playwright_test_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  let accessToken = '';
  let refreshToken = '';

  test('1. Đăng ký tài khoản mới (Sign Up) thành công', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/v1/signup`, {
      data: {
        email: uniqueEmail,
        password: password,
      },
    });

    expect(response.status()).toBeLessThan(300);
    const data = await response.json();
    
    expect(data).toHaveProperty('id');
    expect(data.email).toBe(uniqueEmail);
  });

  test('2. Đăng nhập với thông tin mật khẩu không chính xác (Invalid Credentials)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/v1/token?grant_type=password`, {
      data: {
        email: uniqueEmail,
        password: 'WrongPassword123!',
      },
    });

    // Supabase trả về 400 Bad Request kèm thông tin lỗi khi sai mật khẩu
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('invalid_grant');
  });

  test('3. Đăng nhập bằng Email và Mật khẩu (Sign In)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/v1/token?grant_type=password`, {
      data: {
        email: uniqueEmail,
        password: password,
      },
    });

    // Ghi chú: Nếu hệ thống bật chế độ bắt buộc xác thực email, API này có thể trả về lỗi 400 (Email not confirmed).
    // Nếu tắt xác thực email, API sẽ trả về 200 OK cùng token.
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('access_token');
      expect(data).toHaveProperty('refresh_token');
      
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
    } else {
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error_description || data.msg).toContain('Email not confirmed');
      console.warn('⚠️ Đăng nhập không thành công do tài khoản cần xác nhận Email.');
    }
  });

  test('4. Yêu cầu khôi phục mật khẩu (Recover Password)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/v1/recover`, {
      data: {
        email: uniqueEmail,
      },
    });

    expect(response.status()).toBeLessThan(300);
  });

  test('5. Truy cập thông tin Profiles - Khi không có token (401 Unauthorized)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/rest/v1/profiles?id=eq.00000000-0000-0000-0000-000000000000`);
    expect(response.status()).toBe(401);
  });

  test('6. Truy cập thông tin Profiles - Khi có token hợp lệ', async ({ request }) => {
    if (!accessToken) {
      test.skip(); // Bỏ qua nếu bước đăng nhập không tạo được token (do cần xác thực email)
    }

    const response = await request.get(`${BASE_URL}/rest/v1/profiles`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);
  });

  test('7. Làm mới Access Token (Refresh Token)', async ({ request }) => {
    if (!refreshToken) {
      test.skip();
    }

    const response = await request.post(`${BASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      data: {
        refresh_token: refreshToken,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('access_token');
    expect(data).toHaveProperty('refresh_token');
  });

  test('8. Đăng xuất tài khoản (Logout)', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    const response = await request.post(`${BASE_URL}/auth/v1/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBeLessThan(300);
  });
});