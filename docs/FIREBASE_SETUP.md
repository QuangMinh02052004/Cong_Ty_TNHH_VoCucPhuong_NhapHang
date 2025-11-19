# Hướng dẫn sử dụng hệ thống với Firebase

## ✅ Đã hoàn thành

Hệ thống quản lý hàng hóa đã được tích hợp **Firebase Firestore** thành công!

### Những gì đã thay đổi:

- ✅ Dữ liệu hàng hóa lưu trên **Firebase Cloud** (thay vì localStorage)
- ✅ Dữ liệu người dùng lưu trên **Firebase Cloud**
- ✅ Bộ đếm mã hàng (counters) lưu trên **Firebase Cloud**
- ✅ **Real-time sync**: Dữ liệu tự động cập nhật giữa nhiều thiết bị
- ✅ Dữ liệu an toàn, không mất khi xóa cache

---

## 🚀 Cách sử dụng

### 1. Mở ứng dụng

Mở file `login.html` bằng trình duyệt (Safari, Chrome...)

**Tài khoản mặc định:**
- Username: `admin`
- Password: `admin123`

Hoặc:
- Username: `lethanhtam`
- Password: `123456`

### 2. Chức năng chính

#### ✨ Quản lý hàng hóa (index.html)
- Thêm hàng hóa mới với mã tự động theo trạm
- Sửa/Xóa hàng hóa
- Xem danh sách hàng hóa real-time

#### 👥 Quản lý tài khoản (admin.html - Chỉ admin)
- Thêm/Sửa/Xóa tài khoản nhân viên
- Phân quyền: Admin hoặc Nhân viên
- Kích hoạt/Vô hiệu hóa tài khoản

---

## 🔧 Cấu trúc Firebase

### Collections trong Firestore:

1. **products** - Lưu thông tin hàng hóa
   ```javascript
   {
     id: "251119.01",
     senderName: "Nguyễn Văn A",
     receiverName: "Trần Thị B",
     station: "XUÂN ĐÀ",
     totalAmount: 50000,
     sendDate: "2025-11-19T10:30",
     ...
   }
   ```

2. **users** - Lưu thông tin người dùng
   ```javascript
   {
     id: "1",
     username: "admin",
     password: "admin123",
     fullName: "Quản trị viên",
     role: "admin",
     active: true
   }
   ```

3. **counters** - Bộ đếm mã hàng theo trạm
   ```javascript
   {
     value: 5,
     station: "XUÂN ĐÀ",
     date: "251119"
   }
   ```

---

## 📝 Lưu ý quan trọng

### ⚠️ Firestore Rules (Bảo mật)

Hiện tại Firebase đang ở **test mode** (ai cũng có thể đọc/ghi).

**SAU 30 NGÀY, bạn cần cập nhật Firestore Rules:**

1. Vào Firebase Console: https://console.firebase.google.com/
2. Chọn project: **database-kho-vocucphuong**
3. Vào **Firestore Database** → Tab **Rules**
4. Thay đổi rules thành:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Products collection
    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Counters collection
    match /counters/{counterId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

**Lưu ý:** Sau khi thay đổi rules, bạn sẽ cần implement Firebase Authentication để bảo mật hơn.

---

## 🌐 Hosting (Triển khai lên internet)

Để website có thể truy cập từ bất kỳ đâu:

### Option 1: Firebase Hosting (Khuyến nghị)

```bash
# Cài Firebase CLI
npm install -g firebase-tools

# Đăng nhập
firebase login

# Khởi tạo hosting
firebase init hosting

# Deploy
firebase deploy
```

### Option 2: Netlify/Vercel
- Kéo thả folder vào Netlify.com hoặc Vercel.com
- Website sẽ online sau 1 phút

---

## ❓ Troubleshooting

### Vấn đề: "Failed to load module"
**Giải pháp:** Chạy website qua HTTP server, không mở trực tiếp file HTML.

```bash
# Dùng Python
python3 -m http.server 8000

# Hoặc dùng Live Server extension trong VS Code
```

### Vấn đề: "Permission denied" khi lưu dữ liệu
**Giải pháp:** Kiểm tra Firestore Rules (xem phần ⚠️ ở trên)

### Vấn đề: Dữ liệu không real-time
**Giải pháp:** Làm mới trang (Cmd+R). Firestore có thể mất vài giây để đồng bộ.

---

## 📞 Liên hệ hỗ trợ

Nếu có vấn đề, kiểm tra:
1. Firebase Console: https://console.firebase.google.com/
2. Browser Console (F12) để xem lỗi
3. Firestore Database để xem dữ liệu thực tế

---

**Phiên bản:** 3.0 - Firebase Integration
**Ngày cập nhật:** 19/11/2025
