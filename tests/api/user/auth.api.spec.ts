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

test.describe('Kiểm thử API Auth (Supabase Auth) sử dụng Playwright Auth State', () => {
  let accessToken = '';

  test.beforeAll(() => {
    accessToken = getAccessToken();
    if (accessToken) {
      console.log('[Auth API Test] Đã tìm thấy Access Token từ playwright/.auth/user.json');
    } else {
      console.warn('[Auth API Test] Không tìm thấy Access Token. Một số test case yêu cầu xác thực sẽ bị skip.');
    }
  });

  // --- PUBLIC ENDPOINTS (Không yêu cầu đăng nhập) ---
  
  test('SignUp - Đăng ký tài khoản với email đã tồn tại (nên báo lỗi)', async ({ request }) => {
    // Đọc email của tài khoản đã đăng ký trong setup từ account.json
    let existingEmail = 'already_exists@example.com';
    try {
      const accountFile = path.join(process.cwd(), 'playwright/.auth/account.json');
      if (fs.existsSync(accountFile)) {
        const account = JSON.parse(fs.readFileSync(accountFile, 'utf-8'));
        existingEmail = account.email;
      }
    } catch {}

    const response = await request.post(`${BASE_URL}/auth/v1/signup`, {
      data: {
        email: existingEmail,
        password: 'SomePassword123!',
      },
    });

    // Supabase trả về lỗi 400 Bad Request khi email đã tồn tại, hoặc 429 nếu bị giới hạn rate limit, hoặc 200 nếu bật bảo vệ chống dò quét email
    expect([200, 400, 429]).toContain(response.status());
  });

  test('Login - Đăng nhập thất bại khi sai thông tin', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/v1/token?grant_type=password`, {
      data: {
        email: 'nonexistent_user_12345@example.com',
        password: 'WrongPassword123!',
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error || data.error_code || data.msg || data.message).toBeDefined();
  });

  test('Recover Password - Yêu cầu khôi phục mật khẩu gửi thành công', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/v1/recover`, {
      data: {
        email: 'test_recovery@example.com',
      },
    });

    expect(response.status()).toBeLessThan(300);
  });

  // --- PRIVATE ENDPOINTS (Yêu cầu đăng nhập - sử dụng token từ /playwright/.auth/) ---

  test('Get Profile - Lấy thông tin hồ sơ của chính mình', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    // Lấy userId bằng cách gọi /auth/v1/user trước
    const userResponse = await request.get(`${BASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    expect(userResponse.status()).toBe(200);
    const userData = await userResponse.json();
    const userId = userData.id;

    // Truy vấn profiles từ Supabase Database REST API
    const response = await request.get(`${BASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('Update Profile - Cập nhật thông tin hồ sơ', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    const userResponse = await request.get(`${BASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const userData = await userResponse.json();
    const userId = userData.id;

    const newName = `Playwright User ${Date.now()}`;
    const response = await request.patch(`${BASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation',
      },
      data: {
        full_name: newName,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data[0].full_name).toBe(newName);
  });

  test('Update Profile - Tải lên ảnh đại diện (Upload Avatar) và cập nhật avatar_url vào Profile', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    // 1. Lấy userId từ /auth/v1/user
    const userResponse = await request.get(`${BASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const userData = await userResponse.json();
    const userId = userData.id;

    // 2. Đọc file ảnh từ thư mục data/avatars
    const imgPath = path.join(process.cwd(), 'data/avatars/1.jpg');
    if (!fs.existsSync(imgPath)) {
      console.warn(`[Warning] Không tìm thấy file ảnh test tại ${imgPath}`);
      test.skip();
    }
    const fileBuffer = fs.readFileSync(imgPath);

    // 3. Chuẩn bị thông tin upload
    const fileName = `${userId}_${Math.random().toString(36).substring(2)}.jpg`;
    const uploadUrl = `${BASE_URL}/storage/v1/object/avatars/${fileName}`;

    // 4. Gửi request upload ảnh (binary POST)
    const response = await request.post(uploadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
      },
      data: fileBuffer,
    });

    expect(response.status()).toBe(200);
    const uploadData = await response.json();
    expect(uploadData.Key || uploadData.key).toBeDefined();

    // 5. Kiểm tra xem ảnh có thể truy cập công khai qua link public không
    const publicUrl = `${BASE_URL}/storage/v1/object/public/avatars/${fileName}`;
    const checkResponse = await request.get(publicUrl);
    expect(checkResponse.status()).toBe(200);

    // 6. Cập nhật trường avatar_url trong bảng profiles của Database
    const patchResponse = await request.patch(`${BASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation',
      },
      data: {
        avatar_url: publicUrl,
      },
    });
    expect(patchResponse.status()).toBe(200);
    const patchData = await patchResponse.json();
    expect(patchData[0].avatar_url).toBe(publicUrl);

    // 7. Lấy lại profile một lần nữa (GET) để chắc chắn Database đã cập nhật
    const getProfileResponse = await request.get(`${BASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    expect(getProfileResponse.status()).toBe(200);
    const profileData = await getProfileResponse.json();
    expect(profileData[0].avatar_url).toBe(publicUrl);

    console.log(`[Upload & Save Avatar Test] ✅ Đã upload ảnh, lưu avatar_url và xác thực thành công trong cơ sở dữ liệu: ${publicUrl}`);
  });

  test('Update Profile - Tải lên ảnh đại diện từ URL trong data.json', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    // 1. Lấy userId từ /auth/v1/user
    const userResponse = await request.get(`${BASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const userData = await userResponse.json();
    const userId = userData.id;

    // 2. Đọc file cấu hình data.json và parse danh sách URLs
    const configPath = path.join(process.cwd(), 'data/avatars/data.json');
    if (!fs.existsSync(configPath)) {
      console.warn(`[Warning] Không tìm thấy cấu hình data.json tại ${configPath}`);
      test.skip();
    }
    const urls = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(Array.isArray(urls)).toBeTruthy();
    expect(urls.length).toBeGreaterThan(0);

    const targetUrl = urls[0];

    // 3. Tải xuống ảnh từ URL từ xa (remote URL)
    const downloadResponse = await request.get(targetUrl);
    expect(downloadResponse.status()).toBe(200);
    const fileBuffer = await downloadResponse.body();

    // 4. Chuẩn bị thông tin upload lên Supabase
    const fileExt = targetUrl.split('.').pop() || 'jpg';
    const fileName = `${userId}_remote_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const uploadUrl = `${BASE_URL}/storage/v1/object/avatars/${fileName}`;

    // 5. Upload tệp nhị phân tải được lên Supabase Storage
    const uploadResponse = await request.post(uploadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      },
      data: fileBuffer,
    });

    expect(uploadResponse.status()).toBe(200);
    const uploadData = await uploadResponse.json();
    expect(uploadData.Key || uploadData.key).toBeDefined();

    // 6. Cập nhật trường avatar_url trong cơ sở dữ liệu
    const publicUrl = `${BASE_URL}/storage/v1/object/public/avatars/${fileName}`;
    const patchResponse = await request.patch(`${BASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation',
      },
      data: {
        avatar_url: publicUrl,
      },
    });
    expect(patchResponse.status()).toBe(200);
    const patchData = await patchResponse.json();
    expect(patchData[0].avatar_url).toBe(publicUrl);

    console.log(`[Upload Remote Avatar Test] ✅ Đã tải xuống từ: ${targetUrl}, upload lên Supabase và cập nhật profile thành công: ${publicUrl}`);
  });

  test('Update Password - Thay đổi mật khẩu người dùng', async ({ request }) => {
    if (!accessToken) {
      test.skip();
    }

    const response = await request.put(`${BASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        password: 'NewSecurePassword123!',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('id');
  });

  test('Logout - Đăng xuất tài khoản', async ({ request }) => {
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