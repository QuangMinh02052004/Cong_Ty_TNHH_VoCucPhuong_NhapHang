// Quản lý dữ liệu hàng hóa với Firebase
import {
    listenToProducts,
    getAllProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getCounter,
    incrementCounter
} from './firebase-db.js';

// Import options data
import { loadAllOptions } from '../data/options.js';

let products = [];
let editingProductId = null;
let unsubscribeProducts = null;

// Khởi tạo khi tải trang
document.addEventListener('DOMContentLoaded', async function () {
    // Kiểm tra authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Cập nhật UI với thông tin user
    updateUIWithUser(currentUser);

    // Load options cho các dropdown
    loadAllOptions();

    // Load dữ liệu từ Firestore với real-time listener
    await loadProducts();

    // Sinh mã hàng tự động
    generateProductId();

    // Lắng nghe sự thay đổi của trạm để sinh mã tự động
    document.getElementById('station').addEventListener('change', async function () {
        const station = this.value;
        if (station && !editingProductId) {
            const nextId = await getNextCounterForStation(station);
            document.getElementById('productId').value = nextId;
        }
    });

    // Xử lý submit form
    document.getElementById('productForm').addEventListener('submit', handleSubmit);

    // Xử lý nút làm mới
    document.getElementById('resetBtn').addEventListener('click', resetForm);

    // Render bảng
    renderTable();
});

// Cập nhật UI với thông tin user
function updateUIWithUser(user) {
    const userElement = document.getElementById('currentUser');
    if (userElement) {
        userElement.textContent = user.fullName;
    }

    // Nếu là admin, hiển thị menu quản lý tài khoản
    if (user.role === 'admin') {
        const navbar = document.querySelector('.navbar');
        if (navbar && !document.querySelector('.nav-item-admin')) {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.className = 'nav-item nav-item-admin';
            adminLink.textContent = 'Quản lý TK';
            navbar.appendChild(adminLink);
        }
    }
}

// Hàm sinh mã hàng tự động theo trạm và ngày
function generateProductId() {
    // Hiển thị placeholder trước
    document.getElementById('productId').value = 'Chọn trạm để sinh mã';
    document.getElementById('productId').placeholder = 'Chọn trạm trước';
}

// Hàm sinh mã cho từng trạm (với Firebase)
async function generateProductIdForStation(station) {
    if (!station) {
        document.getElementById('productId').value = 'Chọn trạm để sinh mã';
        return null;
    }

    // Lấy mã trạm (số đầu tiên) từ giá trị "05 - XUÂN TRƯỜNG" -> "05"
    const stationCode = station.split(' - ')[0];

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateKey = `${year}${month}${day}`;

    // Tăng counter trên Firestore với mã trạm
    const counter = await incrementCounter(stationCode, dateKey);

    if (counter === null) {
        console.error('Failed to increment counter');
        return null;
    }

    // Format: YYMMDD.SSNN (ví dụ: 251119.0501)
    // SS = Station Code (2 digits), NN = Sequence (no padding)
    const stationCodePadded = stationCode.padStart(2, '0');
    const productId = `${dateKey}.${stationCodePadded}${counter}`;

    document.getElementById('productId').value = productId;
    return productId;
}

// Lấy counter hiện tại của trạm (không tăng)
async function getNextCounterForStation(station) {
    if (!station) return null;

    // Lấy mã trạm (số đầu tiên) từ giá trị "05 - XUÂN TRƯỜNG" -> "05"
    const stationCode = station.split(' - ')[0];

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateKey = `${year}${month}${day}`;

    const counter = await getCounter(stationCode, dateKey);
    const nextCounter = counter + 1;

    const stationCodePadded = stationCode.padStart(2, '0');
    return `${dateKey}.${stationCodePadded}${nextCounter}`;
}

// Lấy thời gian hiện tại
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Xử lý submit form
async function handleSubmit(e) {
    e.preventDefault();

    const station = document.getElementById('station').value;

    // Kiểm tra trạm đã chọn chưa
    if (!station) {
        alert('Vui lòng chọn trạm nhận trước!');
        return;
    }

    const currentUser = getCurrentUser();
    let productId;

    if (editingProductId) {
        // Nếu đang edit, giữ nguyên ID cũ
        productId = editingProductId;
    } else {
        // Sinh mã mới cho trạm này
        productId = await generateProductIdForStation(station);
        if (!productId) {
            alert('Không thể tạo mã hàng. Vui lòng thử lại!');
            return;
        }
    }

    const totalAmount = parseInt(document.getElementById('totalAmount').value) || 0;

    // Xác định trạng thái thanh toán
    // 1-99: Chưa thanh toán
    // >= 10000: Đã thanh toán
    const paymentStatus = totalAmount >= 10000 ? 'paid' : 'unpaid';

    const formData = {
        id: productId,
        senderName: document.getElementById('senderName').value.trim(),
        senderPhone: document.getElementById('senderPhone').value.trim(),
        receiverName: document.getElementById('receiverName').value.trim(),
        receiverPhone: document.getElementById('receiverPhone').value.trim(),
        station: station,
        vehicle: document.getElementById('vehicle').value,
        productType: document.getElementById('productType').value.trim(),
        insurance: parseInt(document.getElementById('insurance').value) || 0,
        totalAmount: totalAmount,
        paymentStatus: paymentStatus,
        employee: currentUser ? currentUser.fullName : 'Unknown',
        sendDate: getCurrentDateTime()
    };

    let result;
    if (editingProductId) {
        // Cập nhật sản phẩm
        result = await updateProduct(editingProductId, formData);
        if (result.success) {
            showNotification('Cập nhật hàng hóa thành công!', 'success');
        } else {
            showNotification('Lỗi cập nhật: ' + result.error, 'error');
        }
        editingProductId = null;
    } else {
        // Thêm sản phẩm mới
        result = await addProduct(formData);
        if (result.success) {
            showNotification('Thêm hàng hóa thành công!', 'success');
        } else {
            showNotification('Lỗi thêm mới: ' + result.error, 'error');
        }
    }

    if (result.success) {
        resetForm();
    }
}

// Reset form
function resetForm() {
    document.getElementById('productForm').reset();
    editingProductId = null;
    generateProductId();

    // Xóa highlight nếu có
    const editRows = document.querySelectorAll('.edit-mode');
    editRows.forEach(row => row.classList.remove('edit-mode'));
}

// Load dữ liệu từ Firestore với real-time listener
async function loadProducts() {
    // Unsubscribe previous listener if exists
    if (unsubscribeProducts) {
        unsubscribeProducts();
    }

    // Set up real-time listener
    unsubscribeProducts = listenToProducts((updatedProducts) => {
        console.log('Products loaded:', updatedProducts.length, 'items');
        products = updatedProducts;
        renderTable();
    });
}

// Render bảng dữ liệu
function renderTable() {
    const tbody = document.getElementById('productTableBody');

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="15" style="text-align: center; padding: 30px; color: #9ca3af;">
                    Chưa có dữ liệu hàng hóa. Vui lòng thêm hàng hóa mới.
                </td>
            </tr>
        `;
        updateStatistics();
        return;
    }

    tbody.innerHTML = products.map((product, index) => {
        const formattedDate = formatDateTime(product.sendDate || new Date().toISOString());
        const formattedAmount = formatCurrency(product.totalAmount || 0);

        // Xác định trạng thái thanh toán (nếu chưa có trong data)
        const paymentStatus = product.paymentStatus || ((product.totalAmount || 0) >= 10000 ? 'paid' : 'unpaid');
        const paymentStatusText = paymentStatus === 'paid' ?
            '<span class="status-paid">Đã thanh toán</span>' :
            '<span class="status-unpaid">Chưa thanh toán</span>';

        return `
            <tr data-id="${product.id || 'unknown'}">
                <td>${index + 1}</td>
                <td class="product-code">${product.id || '-'}</td>
                <td>${product.senderName || '-'}</td>
                <td>${product.senderPhone || '-'}</td>
                <td>${product.receiverName || '-'}</td>
                <td>${product.receiverPhone || '-'}</td>
                <td class="station-cell">${product.station || '-'}</td>
                <td>${formattedDate}</td>
                <td>${product.vehicle || '-'}</td>
                <td>${product.productType || '-'}</td>
                <td>${product.insurance || 0}</td>
                <td class="amount-cell">${formattedAmount}</td>
                <td>${paymentStatusText}</td>
                <td>${product.employee || '-'}</td>
                <td class="action-cell">
                    <button class="btn btn-edit" onclick="editProduct('${product.id}')">Sửa</button>
                    <button class="btn btn-danger" onclick="deleteProductHandler('${product.id}')">Xóa</button>
                </td>
            </tr>
        `;
    }).join('');

    // Cập nhật thống kê
    updateStatistics();
}

// Cập nhật thống kê
function updateStatistics() {
    // Tính toán các chỉ số
    const totalShipments = products.length;

    const paidProducts = products.filter(p => {
        const status = p.paymentStatus || (p.totalAmount >= 10000 ? 'paid' : 'unpaid');
        return status === 'paid';
    });

    const unpaidProducts = products.filter(p => {
        const status = p.paymentStatus || (p.totalAmount >= 10000 ? 'paid' : 'unpaid');
        return status === 'unpaid';
    });

    const totalPaidCustomers = paidProducts.length;
    const totalUnpaidCustomers = unpaidProducts.length;

    const totalPaidAmount = paidProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalUnpaidAmount = unpaidProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalAmount = totalPaidAmount + totalUnpaidAmount;

    // Cập nhật UI - Thiết kế đơn giản, gọn gàng
    const statsElement = document.getElementById('statistics');
    if (statsElement) {
        const currentUser = getCurrentUser();
        const userName = currentUser ? currentUser.fullName : 'Tất cả';

        statsElement.innerHTML = `
            <div class="stats-summary">
                <div class="stats-header">Thống kê theo: ${userName}</div>
                <div class="stats-line">
                    <span class="stats-text">${totalShipments} lượt gởi</span>
                    <span class="stats-separator">/</span>
                    <span class="stats-text">${totalPaidCustomers + totalUnpaidCustomers} khách hàng</span>
                </div>
                <div class="stats-line stats-paid">
                    Đã thu: <strong>${formatCurrency(totalPaidAmount)}đ</strong> / ${formatCurrency(totalAmount)}đ
                </div>
                <div class="stats-line stats-total">
                    Tổng doanh thu: <strong>${formatCurrency(totalAmount)}đ</strong>
                </div>
            </div>
        `;
    }
}

// Sửa sản phẩm
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    // Điền dữ liệu vào form
    document.getElementById('productId').value = product.id;
    document.getElementById('senderName').value = product.senderName || '';
    document.getElementById('senderPhone').value = product.senderPhone || '';
    document.getElementById('receiverName').value = product.receiverName;
    document.getElementById('receiverPhone').value = product.receiverPhone;
    document.getElementById('station').value = product.station;
    document.getElementById('vehicle').value = product.vehicle;
    document.getElementById('productType').value = product.productType;
    document.getElementById('insurance').value = product.insurance;
    document.getElementById('totalAmount').value = product.totalAmount;

    editingProductId = id;

    // Highlight row đang edit
    const allRows = document.querySelectorAll('#productTableBody tr');
    allRows.forEach(row => row.classList.remove('edit-mode'));
    const editRow = document.querySelector(`tr[data-id="${id}"]`);
    if (editRow) {
        editRow.classList.add('edit-mode');
    }

    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Xóa sản phẩm
async function deleteProductHandler(id) {
    if (confirm('Bạn có chắc chắn muốn xóa hàng hóa này?')) {
        const result = await deleteProduct(id);

        if (result.success) {
            showNotification('Xóa hàng hóa thành công!', 'success');

            // Reset form nếu đang edit sản phẩm bị xóa
            if (editingProductId === id) {
                resetForm();
            }
        } else {
            showNotification('Lỗi xóa: ' + result.error, 'error');
        }
    }
}

// Format ngày giờ
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${hours}h${minutes} - ${day}/${month}/${year}`;
}

// Format tiền tệ
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

// Hiển thị thông báo
function showNotification(message, type = 'success') {
    // Tạo element thông báo
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background-color: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        font-weight: 600;
    `;

    document.body.appendChild(notification);

    // Tự động xóa sau 3 giây
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Thêm CSS cho animation thông báo
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Export functions to global scope
window.editProduct = editProduct;
window.deleteProductHandler = deleteProductHandler;
