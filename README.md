# Hệ thống Quản lý Hàng hóa - Võ Cúc Phương

## 📁 Cấu trúc thư mục

```
project/
├── index.html              # Trang chính - Quản lý hàng hóa
├── login.html              # Trang đăng nhập
├── admin.html              # Trang quản lý tài khoản (Admin only)
│
├── css/                    # Thư mục chứa CSS
│   ├── styles.css          # CSS chung
│   ├── login.css           # CSS đăng nhập
│   └── admin.css           # CSS admin
│
├── js/                     # Thư mục chứa JavaScript
│   ├── firebase-config.js  # Cấu hình Firebase
│   ├── firebase-db.js      # Database operations
│   ├── auth.js             # Authentication
│   ├── script.js           # Main logic
│   └── admin.js            # Admin logic
│
└── docs/                   # Tài liệu
    └── FIREBASE_SETUP.md   # Hướng dẫn Firebase
```

---

## ✏️ THÊM DỮ LIỆU CHO DROPDOWN

Mở file: **data/options.js**

### 1. Thêm Trạm nhận

```javascript
stations: [
    "XUÂN ĐÀ",
    "XUÂN LỮ",
    "XUÂN TRƯỜNG",
    "ÔNG DÒN",
    "LONG KHÁNH",
    "BẾN XE NINH BÌNH",
    "AN ĐỒNG",
    "TÊN TRẠM MỚI"  // Thêm dòng này
]
```

### 2. Thêm Loại xe

```javascript
vehicles: [
    "Thùng",
    "Kiền",
    "Gói",
    "Hộp",
    "Bao",
    "Pallet",
    "LOẠI XE MỚI"  // Thêm dòng này
]
```

### 3. Thêm Loại hàng

```javascript
productTypes: [
    "Hàng điện tử",
    "Thực phẩm",
    "Quần áo",
    "Văn phòng phẩm",
    "Đồ gia dụng",
    "Nông sản",
    "Thiết bị y tế",
    "Khác",
    "LOẠI HÀNG MỚI"  // Thêm dòng này
]
```

---

## 🚀 Chạy website

```bash
python3 -m http.server 8000
```

Mở: **http://localhost:8000/login.html**

---

## 🔐 Tài khoản

- Admin: `admin` / `admin123`
- User: `lethanhtam` / `123456`
