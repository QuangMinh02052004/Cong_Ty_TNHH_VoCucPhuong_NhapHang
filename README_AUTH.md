# Hệ Thống Quản Lý Hàng Hóa với Authentication

## 🎨 Thiết kế mới

Website đã được cập nhật với tone màu **Sky Blue** (#0EA5E9) để phù hợp với website chính: https://cong-ty-tnhh-vo-cuc-phuong-public-s.vercel.app/

### Palette màu mới:
- **Primary Blue**: #0EA5E9 (sky-500)
- **Dark Blue**: #0284C7 (sky-600)
- **Light Blue**: #0369a1 (sky-700)
- Giao diện hiện đại, sáng sủa, chuyên nghiệp

## 🔐 Tính năng Authentication

### 1. Trang đăng nhập
- **File**: `login.html`
- Giao diện hiện đại với gradient sky-blue
- Hỗ trợ "Ghi nhớ đăng nhập"
- Validation và thông báo lỗi

### 2. Quản lý tài khoản nhân viên (Admin)
- **File**: `admin.html`
- Chỉ admin mới có quyền truy cập
- Chức năng đầy đủ:
  - ➕ Thêm tài khoản mới
  - ✏️ Sửa thông tin tài khoản
  - 🗑️ Xóa tài khoản (trừ admin chính)
  - 🔄 Kích hoạt/Vô hiệu hóa tài khoản

### 3. Phân quyền
- **Admin**: Toàn quyền + Quản lý tài khoản
- **Employee**: Quản lý hàng hóa

## 📋 Tài khoản mặc định

### Tài khoản Admin:
- **Username**: `admin`
- **Password**: `admin123`
- **Quyền**: Quản trị viên

### Tài khoản Nhân viên:
- **Username**: `lethanhtam`
- **Password**: `123456`
- **Quyền**: Nhân viên

## 🚀 Cách sử dụng

### Đăng nhập
1. Truy cập `login.html`
2. Nhập tên đăng nhập và mật khẩu
3. (Tùy chọn) Tích "Ghi nhớ đăng nhập"
4. Click "Đăng nhập"

### Quản lý hàng hóa
1. Sau khi đăng nhập, tự động vào trang chính
2. Thêm/sửa/xóa hàng hóa như bình thường
3. Thông tin nhân viên tự động lấy từ tài khoản đăng nhập

### Quản lý tài khoản (Admin only)
1. Đăng nhập với tài khoản admin
2. Click "Quản lý TK" trên menu
3. Thêm/sửa/xóa tài khoản nhân viên

### Đăng xuất
- Click nút "Thoát" ở góc phải trên

## 📁 Cấu trúc File

```
├── login.html          # Trang đăng nhập
├── login.css           # Style cho trang đăng nhập
├── auth.js             # Module xử lý authentication
├── admin.html          # Trang quản lý tài khoản
├── admin.css           # Style cho trang admin
├── admin.js            # Logic quản lý tài khoản
├── index.html          # Trang chính (đã tích hợp auth)
├── script.js           # Logic quản lý hàng hóa (đã tích hợp auth)
├── styles.css          # Style chính (đã cập nhật màu)
└── README_AUTH.md      # Tài liệu này
```

## 💾 Lưu trữ dữ liệu

### LocalStorage
- `users`: Danh sách tài khoản
- `products`: Danh sách hàng hóa
- `currentUser`: Thông tin user hiện tại (nếu "Ghi nhớ")

### SessionStorage
- `currentUser`: Thông tin user hiện tại (nếu không "Ghi nhớ")

## 🔒 Bảo mật

### Các tính năng bảo mật:
- ✅ Kiểm tra authentication trên mọi trang
- ✅ Phân quyền admin/employee
- ✅ Không thể xóa tài khoản admin chính
- ✅ Validation input
- ✅ Session/Persistent login

### Lưu ý:
⚠️ **Đây là demo dùng localStorage**. Trong production, cần:
- Backend API với mã hóa mật khẩu (bcrypt)
- JWT tokens
- HTTPS
- Session management an toàn

## 🎯 Tính năng nổi bật

1. **Tự động sinh mã hàng** theo thời gian
2. **Nhân viên tự động** lấy từ user đăng nhập
3. **Ngày giờ tự động** khi thêm hàng
4. **Combobox linh hoạt** cho Trạm/Xe/Loại hàng
5. **Responsive design** - Tương thích mọi thiết bị
6. **Tone màu thống nhất** với website chính

## 🆘 Troubleshooting

### Không đăng nhập được?
- Kiểm tra username/password
- Xóa localStorage và thử lại

### Không thấy menu "Quản lý TK"?
- Chỉ admin mới thấy menu này
- Đăng xuất và đăng nhập lại với tài khoản admin

### Bị logout tự động?
- Nếu không tích "Ghi nhớ", session sẽ mất khi đóng tab
- Tích "Ghi nhớ đăng nhập" để lưu lâu dài

## 📞 Hỗ trợ

**CTY DV XE DU LỊCH CỨC PHƯƠNG**

---

© 2025 All rights reserved.
