# Gửi cậu, một chút thương

Website màu hồng phấn, phong thư chuyển động nhẹ, 5 câu hỏi mở và hiệu ứng mở thư. Tối ưu cho điện thoại, hỗ trợ bàn phím và giảm chuyển động.

## Xem trên máy

Cài Node.js 22 trở lên nếu chưa có, mở terminal tại thư mục này:

```sh
npm start
```

Mở http://localhost:3000. Không cần cài thư viện hay database. Chạy `npm test` để kiểm tra luồng mở khóa thư.

## Đưa lên GitHub

1. Đăng nhập GitHub, nhấn dấu **+ → New repository**.
2. Đặt tên, ví dụ `gui-cau`, chọn **Private**, nhấn **Create repository**. Nội dung thư nằm trong mã nguồn nên repo riêng tư sẽ phù hợp hơn.
3. Chọn **uploading an existing file** (hoặc **Add file → Upload files**).
4. Kéo các file và thư mục dự án vào: `package.json`, `package-lock.json`, `railway.json`, `server.js`, `content.js`, `README.md`, thư mục `public` và `test`. Giữ nguyên cấu trúc thư mục; các file phải nằm ngay ở gốc repo, không nằm trong một thư mục `Trả bài` lồng bên trong. Không cần đưa file ZIP lên repo.
5. Nhấn **Commit changes**.

## Deploy lên Railway

1. Đăng nhập Railway, chọn **New Project → Deploy from GitHub repo**.
2. Kết nối GitHub, cấp quyền truy cập repo `gui-cau`, rồi chọn repo đó.
3. Railway đọc `package.json` và `railway.json`. Lệnh chạy là `npm start`, kiểm tra hoạt động tại `/health`. Ứng dụng tự dùng biến `PORT` do Railway cấp.
4. Sau khi deploy thành công, vào service → **Settings → Networking → Public Networking → Generate Domain**. Nếu hỏi cổng, chọn cổng mà service đang lắng nghe.
5. Mở domain Railway để thử từ đầu, trả lời 5 câu, mở thư. Sau đó gửi link cho cô ấy.

Tài liệu chính thức: https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime và https://docs.railway.com/config-as-code/reference.

## Sửa nội dung

- `content.js`: 5 câu hỏi, gợi ý và toàn bộ bức thư theo bản văn bản bạn gửi lại. Phần thân thư và lưu ý giữ cách diễn đạt của bản gốc; lời chào và chữ ký là phần trình bày bổ sung.
- `public/index.html`: lời mời ở trang đầu, lời chào và chữ ký giao diện.
- `public/style.css`: màu sắc và animation.

## Cách hoạt động

Mỗi câu yêu cầu ít nhất một ký tự không phải khoảng trắng, tối đa 2.000 ký tự, không chấm đúng/sai. Máy chủ chỉ cho tải nội dung thư sau đủ 5 lượt trả lời theo thứ tự. Thư không có sẵn trong HTML hay JavaScript công khai.

Nội dung trả lời không được lưu trên máy chủ, không gửi email và không có trang quản trị. Bản nháp câu hiện tại được giữ trong sessionStorage của tab, rồi xóa khi gửi thành công. Tiến độ được lưu trong RAM máy chủ với cookie 24 giờ; khi máy chủ khởi động lại hoặc deploy lại, cô ấy cần trả lời lại. Dùng một replica trên Railway cho phiên bản này.

Đây là món quà tương tác: bất kỳ người nào có link và trả lời đủ 5 câu đều mở được thư. Không phải hệ thống xác thực danh tính.

Nút **Dừng chuyển động** dừng animation. Website tự tắt animation nếu thiết bị bật chế độ giảm chuyển động.
