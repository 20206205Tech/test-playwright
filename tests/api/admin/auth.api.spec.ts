Viewed auth.service.ts:1-203
Viewed auth-mfa.service.ts:1-182

Dựa trên mã nguồn của hai tệp tin [auth.service.ts](file:///C:/Users/Admin/Documents/GitHub/code-fe-ui/services/auth.service.ts) và [auth-mfa.service.ts](file:///C:/Users/Admin/Documents/GitHub/code-fe-ui/services/auth-mfa.service.ts), hệ thống sử dụng **Supabase** để xử lý các nhóm chức năng chính bao gồm: **Xác thực & Phân quyền (Authentication)**, **Xác thực 2 yếu tố (Multi-Factor Authentication - MFA)**, **Quản lý dữ liệu người dùng (Database REST API)** và **Quản lý tệp tin (Storage)**.

Dưới đây là mô tả chi tiết các chức năng được triển khai:

---

### I. Xác thực & Quản lý tài khoản (Supabase Auth)
Được triển khai trong tệp [auth.service.ts](file:///C:/Users/Admin/Documents/GitHub/code-fe-ui/services/auth.service.ts), hệ thống sử dụng các API Auth của Supabase để xử lý toàn bộ luồng đăng nhập, đăng ký và bảo mật tài khoản:

1. **Đăng nhập bằng Google (Google OAuth2 / SSO)** (`loginWithGoogle`):
   - Tạo URL và chuyển hướng người dùng đến trang ủy quyền của Google thông qua Supabase Auth Provider.
   - *Endpoint sử dụng*: `/auth/v1/authorize?provider=google&redirect_to={redirectUrl}`

2. **Đăng nhập bằng Email và Mật khẩu** (`loginWithEmailPassword`):
   - Cho phép người dùng đăng nhập bằng tài khoản email thông thường. Trả về thông tin Access Token và Refresh Token nếu thành công.
   - *Endpoint sử dụng*: `/auth/v1/token?grant_type=password`

3. **Đăng ký tài khoản mới** (`signUp`):
   - Tạo tài khoản mới bằng Email và Mật khẩu, hỗ trợ gửi email xác nhận tài khoản thông qua đường dẫn chuyển hướng sau khi kích hoạt thành công (`redirect_to`).
   - *Endpoint sử dụng*: `/auth/v1/signup`

4. **Khôi phục mật khẩu** (`recoverPassword`):
   - Gửi yêu cầu khôi phục mật khẩu tới email của người dùng. Hệ thống sẽ gửi một email chứa liên kết để xác thực và chuyển hướng người dùng về trang đổi mật khẩu.
   - *Endpoint sử dụng*: `/auth/v1/recover`

5. **Cập nhật mật khẩu mới** (`updateUserPassword`):
   - Cho phép người dùng đổi mật khẩu mới sau khi đã đăng nhập (hoặc sau khi click vào liên kết khôi phục mật khẩu).
   - *Endpoint sử dụng*: `/auth/v1/user` (HTTP PUT)

6. **Làm mới Access Token** (`refreshAccessToken`):
   - Sử dụng `refresh_token` để lấy một `access_token` mới khi token cũ hết hạn mà không bắt người dùng phải đăng nhập lại.
   - *Endpoint sử dụng*: `/auth/v1/token?grant_type=refresh_token`

7. **Đăng xuất** (`logout`):
   - Hủy phiên làm việc hiện tại của người dùng trên hệ thống Supabase.
   - *Endpoint sử dụng*: `/auth/v1/logout`

---

### II. Xác thực 2 yếu tố (Supabase Multi-Factor Authentication - MFA)
Được triển khai trong tệp [auth-mfa.service.ts](file:///C:/Users/Admin/Documents/GitHub/code-fe-ui/services/auth-mfa.service.ts), hệ thống hỗ trợ phương thức xác thực hai yếu tố **TOTP** (Time-based One-Time Password - như Google Authenticator hay Authy) bằng các API nâng cao của Supabase:

1. **Đăng ký thiết bị xác thực MFA mới** (`enrollMFA`):
   - Khởi tạo quá trình liên kết thiết bị xác thực mới. API trả về mã QR (`qr_code`), mã bí mật (`secret`), và chuỗi URI để người dùng quét trên ứng dụng Authenticator.
   - *Endpoint sử dụng*: `/auth/v1/factors` (HTTP POST)

2. **Tạo thử thách xác thực** (`challengeMFA`):
   - Tạo một thử thách xác thực (challenge) dựa trên ID thiết bị MFA (`factorId`) để chuẩn bị so khớp với mã OTP người dùng nhập.
   - *Endpoint sử dụng*: `/auth/v1/factors/{factorId}/challenge`

3. **Xác thực mã OTP** (`verifyMFA`):
   - Kiểm tra mã OTP gồm 6 chữ số người dùng nhập có khớp với thử thách hiện tại không. Nếu đúng, Supabase sẽ nâng cấp phiên đăng nhập (tăng cấp bảo mật cho Access Token).
   - *Endpoint sử dụng*: `/auth/v1/factors/{factorId}/verify`

4. **Lấy danh sách các yếu tố MFA** (`listFactors`):
   - Lấy thông tin tài khoản người dùng để lọc ra danh sách các thiết bị/yếu tố xác thực đã liên kết, phân loại thành: tất cả thiết bị (`all`) và các thiết bị đã kích hoạt thành công (`active`).
   - *Endpoint sử dụng*: `/auth/v1/user`

5. **Hủy liên kết/Xóa thiết bị MFA** (`unenrollFactor`):
   - Xóa một thiết bị xác thực MFA khỏi tài khoản người dùng.
   - *Endpoint sử dụng*: `/auth/v1/factors/{factorId}` (HTTP DELETE)

6. **Cập nhật tên hiển thị của thiết bị MFA** (`updateFactor`):
   - Đổi tên hiển thị (`friendly_name`) của thiết bị xác thực (ví dụ: "Điện thoại cá nhân").
   - *Endpoint sử dụng*: `/auth/v1/factors/{factorId}` (HTTP PUT)

---

### III. Quản lý Hồ sơ người dùng (Supabase Database - PostgREST API)
Hệ thống sử dụng cơ chế RESTful API tự động sinh từ PostgreSQL của Supabase (PostgREST) để thực hiện các thao tác CRUD trên bảng cơ sở dữ liệu `profiles`:

1. **Lấy thông tin hồ sơ** (`getProfile`):
   - Truy vấn thông tin chi tiết hồ sơ người dùng (như tên đầy đủ, ảnh đại diện) từ bảng `profiles` dựa vào `userId`.
   - *Endpoint sử dụng*: `/rest/v1/profiles?id=eq.{userId}` (HTTP GET)

2. **Cập nhật thông tin hồ sơ** (`updateProfile`):
   - Cập nhật các trường thông tin hồ sơ như tên hiển thị (`full_name`) hoặc đường dẫn ảnh đại diện (`avatar_url`).
   - *Endpoint sử dụng*: `/rest/v1/profiles?id=eq.{userId}` (HTTP PATCH)

---

### IV. Quản lý Ảnh đại diện (Supabase Storage)
Hệ thống sử dụng dịch vụ lưu trữ tệp (Storage) của Supabase để quản lý hình ảnh của người dùng:

1. **Tải lên ảnh đại diện** (`uploadAvatar`):
   - Tải tệp tin ảnh của người dùng lên thư mục `avatars` trên Supabase Storage. Tên tệp được sinh ngẫu nhiên kết hợp với `userId` để tránh trùng lặp.
   - *Endpoint tải lên*: `/storage/v1/object/avatars/{fileName}` (HTTP POST)
   - *Đường dẫn công khai nhận về*: `/storage/v1/object/public/avatars/{fileName}`