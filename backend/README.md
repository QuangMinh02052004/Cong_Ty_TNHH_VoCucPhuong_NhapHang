# 🚀 Backend API - Hệ Thống Quản Lý Hàng Hóa

Backend API cho hệ thống quản lý hàng hóa Võ Cúc Phương, sử dụng Node.js + Express + SQL Server.

---

## 📦 **CÀI ĐẶT**

### 1. Cài đặt dependencies

```bash
cd backend
npm install
```

### 2. Cấu hình .env

File `.env` đã được tạo sẵn với thông tin SQL Server của bạn.

---

## 🚀 **CHẠY SERVER**

### Development mode (với nodemon):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

Server sẽ chạy tại: **http://localhost:5001**

---

## 📋 **API ENDPOINTS**

### **🔐 Authentication**

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "success": true,
  "message": "Đăng nhập thành công!",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "1",
    "username": "admin",
    "fullName": "Quản trị viên",
    "role": "admin",
    "station": "01 - AN ĐÔNG"
  }
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>

Response:
{
  "success": true,
  "user": { ... }
}
```

### **📦 Products**

#### Get All Products
```http
GET /api/products
Authorization: Bearer <token>

Query Parameters (optional):
- station: Filter by receiver station
- senderStation: Filter by sender station
- paymentStatus: paid | unpaid
- status: pending | in_transit | delivered | cancelled
- dateFrom: YYYY-MM-DD
- dateTo: YYYY-MM-DD
- search: Search by name, phone, or ID

Response:
{
  "success": true,
  "count": 9,
  "products": [ ... ]
}
```

#### Get Product by ID
```http
GET /api/products/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "product": { ... }
}
```

#### Create Product
```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "SG-01-041225-999",
  "senderName": "Nguyễn Văn A",
  "senderPhone": "0901234567",
  "senderStation": "01 - AN ĐÔNG",
  "receiverName": "Trần Thị B",
  "receiverPhone": "0912345678",
  "station": "03 - LONG KHÁNH",
  "productType": "03 - Thùng",
  "vehicle": "01031",
  "insurance": 10000,
  "totalAmount": 50000,
  "paymentStatus": "paid",
  "notes": "Ghi chú"
}

Response:
{
  "success": true,
  "message": "Tạo đơn hàng thành công!",
  "product": { ... }
}
```

#### Update Product
```http
PUT /api/products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentStatus": "paid",
  "status": "delivered"
}

Response:
{
  "success": true,
  "message": "Cập nhật đơn hàng thành công!",
  "product": { ... }
}
```

#### Delete Product
```http
DELETE /api/products/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Xóa đơn hàng thành công!"
}
```

#### Get Statistics
```http
GET /api/products/stats/summary
Authorization: Bearer <token>

Response:
{
  "success": true,
  "stats": {
    "totalProducts": 9,
    "totalRevenue": 2970000,
    "paidCount": 7,
    "unpaidCount": 2,
    "pendingCount": 6,
    "deliveredCount": 3
  }
}
```

### **👥 Users** (Admin only)

#### Get All Users
```http
GET /api/users
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "count": 6,
  "users": [ ... ]
}
```

#### Create User
```http
POST /api/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "id": "7",
  "username": "newuser",
  "password": "123456",
  "fullName": "User Mới",
  "role": "employee",
  "station": "01 - AN ĐÔNG"
}
```

### **🚉 Stations**

#### Get All Stations
```http
GET /api/stations
Authorization: Bearer <token>

Response:
{
  "success": true,
  "count": 13,
  "stations": [
    {
      "id": 1,
      "code": "00",
      "name": "DỌC ĐƯỜNG",
      "fullName": "00 - DỌC ĐƯỜNG",
      "isActive": 1
    },
    ...
  ]
}
```

---

## 🔑 **AUTHENTICATION**

API sử dụng JWT (JSON Web Token) để xác thực.

1. **Login** để nhận token
2. **Thêm token vào header** cho các request tiếp theo:
   ```
   Authorization: Bearer <your_token_here>
   ```

---

## 🧪 **TEST API**

### Sử dụng Thunder Client (VS Code Extension):

1. Install Thunder Client extension
2. Import collection từ `thunder-client-collection.json`
3. Test các endpoints

### Hoặc dùng curl:

```bash
# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get products (thay <TOKEN> bằng token nhận được)
curl http://localhost:5001/api/products \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 📁 **CẤU TRÚC PROJECT**

```
backend/
├── config/
│   └── database.js          # SQL Server connection
├── middleware/
│   ├── auth.js              # JWT authentication
│   └── errorHandler.js      # Error handling
├── routes/
│   ├── auth.js              # Auth endpoints
│   ├── products.js          # Products CRUD
│   ├── users.js             # Users management
│   └── stations.js          # Stations list
├── .env                     # Environment variables
├── server.js                # Main server file
├── package.json
└── README.md
```

---

## 🔒 **BẢO MẬT**

- ✅ JWT authentication
- ✅ Role-based access control (admin/employee)
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configuration
- ⚠️ TODO: Implement bcrypt password hashing

---

## 🐛 **TROUBLESHOOTING**

### Lỗi: "Cannot connect to SQL Server"
- Kiểm tra SQL Server đang chạy
- Verify thông tin trong `.env`
- Check firewall port 1433

### Lỗi: "Token không hợp lệ"
- Token đã hết hạn (24h)
- Login lại để nhận token mới

---

## 📞 **SUPPORT**

- 📧 Email: support@vocucphuong.com
- 📱 Phone: 0900000000

---

**Version:** 1.0.0
**Last Updated:** 04-12-2025
