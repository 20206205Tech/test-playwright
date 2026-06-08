import { test, expect } from '@playwright/test';

const BASE_URL = 'https://httpbin.org';

test('Kiểm thử method GET và việc truyền query parameters', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/get`, {
        params: { greeting: 'hello' }
    });
    
    // Kiểm tra HTTP status code
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    // Kiểm tra dữ liệu trả về
    const data = await response.json();
    expect(data.args.greeting).toBe('hello');
    expect(data.url).toBe(`${BASE_URL}/get?greeting=hello`);
});

test('Kiểm thử method POST với JSON payload', async ({ request }) => {
    const payload = { username: 'admin', role: 'tester' };
    
    const response = await request.post(`${BASE_URL}/post`, {
        data: payload
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // httpbin trả lại chính xác những gì ta gửi lên trong trường 'json'
    expect(data.json.username).toBe('admin');
    expect(data.json.role).toBe('tester');
});

test('Kiểm thử xác thực Basic Auth', async ({ request }) => {
    const url = `${BASE_URL}/basic-auth/myuser/mypassword`;
    
    // Gửi request không có auth -> sẽ bị lỗi 401 Unauthorized
    const failedResponse = await request.get(url);
    expect(failedResponse.status()).toBe(401);
    
    // Mã hóa thông tin đăng nhập thành chuỗi base64 chuẩn của Basic Auth
    const credentials = Buffer.from('myuser:mypassword').toString('base64');
    
    // Gửi request kèm thông tin auth -> thành công 200 OK
    const successResponse = await request.get(url, {
        headers: {
            'Authorization': `Basic ${credentials}`
        }
    });
    
    expect(successResponse.status()).toBe(200);
    const successData = await successResponse.json();
    expect(successData.authenticated).toBe(true);
});

test('Kiểm thử việc gửi và nhận Headers tùy chỉnh', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/headers`, {
        headers: {
            'X-Custom-Header': 'Playwright-Test'
        }
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    // API httpbin bảo toàn tên của custom header mà bạn đã gửi
    expect(data.headers['X-Custom-Header']).toBe('Playwright-Test');
});