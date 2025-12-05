# Hướng dẫn: Tính năng Số lượng hàng (Quantity Field)

## 📋 Tổng quan

Thêm cột `quantity` vào bảng Products để ghi chi tiết số lượng hàng hóa.

**Ví dụ:**
- Nhập: `2 thùng + 2 bao`
- Booking note: `giao Trần Văn A 2 thùng + 2 bao`

---

## 🔧 Các thay đổi

### 1. Database Schema
**Thêm cột mới:**
```sql
ALTER TABLE Products
ADD quantity NVARCHAR(500) NULL;
```

### 2. Backend API
**Files đã sửa:**
- ✅ `routes/products.js` - Thêm `quantity` vào POST/PUT endpoints
- ✅ `services/booking-transformer.js` - Sử dụng `quantity` cho booking note

### 3. Backward Compatibility
Hệ thống vẫn hỗ trợ định dạng cũ `productType: "03 - Thùng"` nếu không có `quantity`.

---

## 🚀 Cài đặt

### Bước 1: Chạy SQL Migration

**Mở SQL Server Management Studio và chạy script:**
```sql
USE VoCucPhuong_NhapHang;
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'Products')
    AND name = 'quantity'
)
BEGIN
    ALTER TABLE Products
    ADD quantity NVARCHAR(500) NULL;

    PRINT '✅ Đã thêm cột quantity';
END
GO
```

**Hoặc chạy file migration:**
```bash
# Path: backend/migrations/add-quantity-column.sql
```

### Bước 2: Restart Backend Server
```bash
cd Cong_Ty_TNHH_VoCucPhuong_NhapHang-2/backend
npm start
```

---

## 📖 Cách sử dụng

### API Request Example

**Tạo product MỚI (với quantity):**
```json
POST /api/products
{
  "receiverName": "Trần Văn A",
  "receiverPhone": "0901234567",
  "station": "00 - DỌC ĐƯỜNG",
  "productType": "Hàng hóa",
  "quantity": "2 thùng + 2 bao",
  "totalAmount": 50000
}
```

**Kết quả:**
- ✅ Product được tạo với `quantity = "2 thùng + 2 bao"`
- ✅ Booking tự động tạo với note: `"giao Trần Văn A 2 thùng + 2 bao"`

---

### Cách nhập số lượng hàng

**Format linh hoạt - nhập như text tự do:**
```
✅ "2 thùng + 2 bao"
✅ "5 túi"
✅ "3 thùng xốp + 1 túi ni lông"
✅ "10 kiện"
✅ "2 container"
```

**Không cần định dạng cứng nhắc!**

---

## 🔄 Backward Compatibility

### Trường hợp cũ (không có quantity)
```json
{
  "productType": "03 - Thùng",
  "quantity": null
}
```
→ Booking note: `"giao Trần Văn A 3 Thùng"`

### Trường hợp mới (có quantity)
```json
{
  "productType": "Hàng hóa",
  "quantity": "2 thùng + 2 bao"
}
```
→ Booking note: `"giao Trần Văn A 2 thùng + 2 bao"`

---

## 🧪 Testing

### Test Case 1: Tạo product với quantity
```bash
curl -X POST http://localhost:5001/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverName": "Nguyễn Văn B",
    "receiverPhone": "0912345678",
    "station": "00 - DỌC ĐƯỜNG",
    "productType": "Hàng thủy sản",
    "quantity": "3 thùng xốp cá",
    "totalAmount": 80000
  }'
```

**Expected result:**
- Product created ✅
- Booking created với note: `"giao Nguyễn Văn B 3 thùng xốp cá"` ✅
- Hiển thị trên sơ đồ ghế TongHop ✅

### Test Case 2: Update quantity
```bash
curl -X PUT http://localhost:5001/api/products/251205.001 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": "5 túi + 1 thùng"
  }'
```

---

## 📊 Database Schema

```sql
CREATE TABLE Products (
    id NVARCHAR(50) PRIMARY KEY,
    senderName NVARCHAR(255),
    senderPhone NVARCHAR(20),
    senderStation NVARCHAR(255),
    receiverName NVARCHAR(255) NOT NULL,
    receiverPhone NVARCHAR(20) NOT NULL,
    station NVARCHAR(255) NOT NULL,
    productType NVARCHAR(255) NOT NULL,
    quantity NVARCHAR(500) NULL,          -- ⭐ NEW FIELD
    vehicle NVARCHAR(100),
    insurance DECIMAL(18, 2),
    totalAmount DECIMAL(18, 2),
    paymentStatus NVARCHAR(50),
    employee NVARCHAR(255),
    createdBy NVARCHAR(255),
    sendDate DATETIME,
    status NVARCHAR(50),
    notes NVARCHAR(MAX),
    createdAt DATETIME DEFAULT GETDATE(),
    updatedAt DATETIME DEFAULT GETDATE()
);
```

---

## ⚠️ Lưu ý

1. **NULL allowed:** `quantity` có thể để trống (NULL)
2. **Length:** Tối đa 500 ký tự
3. **Free text:** Không validate format, nhập tự do
4. **Optional:** Nếu không nhập quantity, system vẫn hoạt động bình thường

---

## 🎯 Mục đích

**Trước đây:**
- `productType = "03 - Thùng"` → format cứng nhắc
- Chỉ ghi được 1 loại hàng

**Bây giờ:**
- `quantity = "2 thùng + 2 bao + 1 túi"` → linh hoạt
- Ghi được nhiều loại hàng khác nhau
- Note booking chi tiết hơn

---

## 📝 Changelog

**Version:** 1.1.0
**Date:** 2025-12-05
**Changes:**
- ✅ Added `quantity` column to Products table
- ✅ Updated POST /api/products to accept `quantity`
- ✅ Updated PUT /api/products to allow updating `quantity`
- ✅ Modified booking note format to use `quantity` field
- ✅ Maintained backward compatibility with old `productType` format

---

## 👥 Support

Nếu có vấn đề, liên hệ:
- Developer: Claude Code
- Date: 2025-12-05
