import axios from 'axios';

const BASE = 'https://api.mail.tm';

export interface MailAccount {
  address: string;
  password: string;
  token: string;
}

/**
 * Lấy danh sách domain hợp lệ từ mail.tm
 */
export async function getDomain(): Promise<string> {
  const res = await axios.get(`${BASE}/domains`, {
    headers: { Accept: 'application/json' },
  });
  const data = res.data;
  
  // mail.tm có thể trả về mảng trực tiếp hoặc JSON-LD với key "hydra:member"
  let domains: Array<{ domain: string }>;
  if (Array.isArray(data)) {
    domains = data;
  } else if (data['hydra:member']) {
    domains = data['hydra:member'];
  } else {
    domains = [];
  }
  
  if (!domains || domains.length === 0) {
    console.error('[mail.tm] Cannot find domains in response:', JSON.stringify(data, null, 2));
    throw new Error('No mail.tm domains available');
  }
  
  console.log(`[mail.tm] Using domain: ${domains[0].domain}`);
  return domains[0].domain;
}

/**
 * Tạo tài khoản email với prefix (mặc định testuser_)
 */
export async function createMailAccount(prefix: string = 'testuser_'): Promise<MailAccount> {
  const domain = await getDomain();
  
  // Dùng chuỗi ngẫu nhiên thuần túy như script Python của user
  const randStr = (len: number = 6) => Math.random().toString(36).substring(2, 2 + len);
  const address = `${prefix}${randStr()}@${domain}`;
  const password = `Pass${randStr(8)}!`; // Password mạnh hơn tí

  try {
    await axios.post(
      `${BASE}/accounts`,
      { address, password },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );

    const tokenRes = await axios.post(
      `${BASE}/token`,
      { address, password },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );

    console.log(`[mail.tm] Đăng ký thành công: ${address}`);
    return { address, password, token: tokenRes.data.token };
  } catch (error: any) {
    console.error('[mail.tm] Lỗi tạo tài khoản:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Đăng nhập vào hòm thư đã tạo
 */
export async function getMailToken(address: string, password: string): Promise<string> {
  const res = await axios.post(
    `${BASE}/token`,
    { address, password },
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
  );
  return res.data.token;
}

/**
 * Chờ email mới (poll mỗi 5 giây, timeout 60 giây)
 */
export async function waitForEmail(
  token: string,
  timeoutMs = 120_000
): Promise<string> {
  const start = Date.now();
  console.log(`[mail.tm] Đang chờ tin nhắn mới (timeout: ${timeoutMs / 1000}s)...`);
  
  while (Date.now() - start < timeoutMs) {
    const res = await axios.get(`${BASE}/messages`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    
    // mail.tm trả về JSON-LD với key "hydra:member" hoặc array
    const data = res.data;
    const messages = Array.isArray(data) ? data : data['hydra:member'] || [];
    
    if (messages.length > 0) {
      console.log(`[mail.tm] BẠN CÓ TIN NHẮN MỚI! (${messages.length})`);
      const msgId = messages[0].id;
      const msgRes = await axios.get(`${BASE}/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      
      // Ưu tiên text nếu html trống (như Supabase thường gửi)
      const text = msgRes.data.text || '';
      const html = msgRes.data.html?.[0] || '';
      return html || text;
    }
    
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Timeout waiting for confirmation email');
}

/**
 * Trích xuất link xác nhận từ nội dung email HTML hoặc Text
 */
export function extractConfirmLink(content: string): string {
  // Tìm URL có chứa token xác nhận (Supabase, Firebase, v.v.)
  const patterns = [
    /https?:\/\/[^\s"<>]+auth\/v1\/verify\?token=[^\s"<>]+/i, // Pattern Supabase thực tế
    /href="(https?:\/\/[^"]*verify[^"]*token=[^"]*)"/i,
    /href="(https?:\/\/[^"]*confirmation[^"]*token[^"]*)"/i,
    /https?:\/\/[^\s"<>]*confirm[^\s"<>]+/i,
    /(https?:\/\/localhost:3000\/auth\/[^\s"<]+)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const link = match[0].startsWith('href="') ? match[1] : match[0];
      return link.replace(/&amp;/g, '&').replace(/[\])]+$/, ''); // Làm sạch link
    }
  }

  throw new Error('Cannot find confirmation link in email content');
}
