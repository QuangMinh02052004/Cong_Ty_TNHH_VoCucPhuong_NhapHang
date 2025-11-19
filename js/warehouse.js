// Warehouse Module - Hiển thị hàng hóa từ các trạm khác
import {
    getAllProducts
} from './firebase-db.js';

let allProducts = [];
let currentUserStation = '';

// Khởi tạo
document.addEventListener('DOMContentLoaded', async function () {
    // Lấy thông tin user hiện tại
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Hiển thị tên user
    document.getElementById('currentUser').textContent = currentUser.fullName;

    // Lấy trạm của user hiện tại
    currentUserStation = currentUser.station || '';

    // Hiển thị tên trạm
    if (currentUserStation) {
        document.getElementById('currentStationName').textContent = currentUserStation;
    }

    // Load tất cả sản phẩm
    await loadAllProducts();

    // Render bảng với filter
    renderWarehouseTable();

    // Render statistics
    renderWarehouseStatistics();
});

// Load tất cả products từ Firestore
async function loadAllProducts() {
    allProducts = await getAllProducts();
}

// Render bảng warehouse - chỉ hiển thị hàng từ trạm khác gửi đến trạm hiện tại
function renderWarehouseTable() {
    const tbody = document.getElementById('warehouseTableBody');

    // Filter: Chỉ hiển thị hàng có trạm nhận = trạm hiện tại
    // và trạm gửi khác trạm hiện tại (tức là từ trạm khác gửi đến)
    const filteredProducts = allProducts.filter(product => {
        // Lấy mã trạm từ station (ví dụ: "05 - XUÂN TRƯỜNG" -> "05")
        const destinationStation = product.station || '';
        const senderStation = getStationFromProductId(product.id);

        // Hiển thị nếu: trạm nhận khác rỗng và bao gồm trạm hiện tại
        return destinationStation.includes(currentUserStation.split(' - ')[0]) &&
               !senderStation.includes(currentUserStation.split(' - ')[0]);
    });

    if (filteredProducts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="15" style="text-align: center; padding: 30px; color: #9ca3af;">
                    Chưa có hàng hóa từ trạm khác.
                </td>
            </tr>
        `;
        return;
    }

    // Sắp xếp theo ngày gởi (mới nhất trước)
    filteredProducts.sort((a, b) => new Date(b.sendDate) - new Date(a.sendDate));

    tbody.innerHTML = filteredProducts.map((product, index) => {
        const sendDate = new Date(product.sendDate).toLocaleDateString('vi-VN');
        const paymentBadge = product.paymentStatus === 'paid'
            ? '<span class="status-badge status-active">Đã thu</span>'
            : '<span class="status-badge status-inactive">Chưa thu</span>';

        // Trích xuất trạm gởi từ product ID
        const senderStation = getStationFromProductId(product.id);

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${product.id}</td>
                <td>${product.senderName || '-'}</td>
                <td>${product.senderPhone || '-'}</td>
                <td>${product.receiverName}</td>
                <td>${product.receiverPhone}</td>
                <td>${senderStation}</td>
                <td>${product.station}</td>
                <td>${sendDate}</td>
                <td>${product.vehicle || '-'}</td>
                <td>${product.productType}</td>
                <td>${formatCurrency(product.insurance)}</td>
                <td>${formatCurrency(product.totalAmount)}</td>
                <td>${paymentBadge}</td>
                <td>${product.createdBy || '-'}</td>
            </tr>
        `;
    }).join('');
}

// Lấy trạm từ product ID (format: YYMMDD.SSNN)
function getStationFromProductId(productId) {
    if (!productId) return '-';

    // Tách phần sau dấu chấm (SSNN)
    const parts = productId.split('.');
    if (parts.length < 2) return '-';

    // Lấy 2 số đầu tiên (SS) - mã trạm
    const stationCode = parts[1].substring(0, 2);

    // Tìm tên trạm từ mã
    // Giả sử OPTIONS.stations có format "05 - XUÂN TRƯỜNG"
    // Ta cần import OPTIONS để tra cứu
    return stationCode;
}

// Render statistics
function renderWarehouseStatistics() {
    const statsElement = document.getElementById('warehouseStatistics');

    // Filter products for current station
    const filteredProducts = allProducts.filter(product => {
        const destinationStation = product.station || '';
        const senderStation = getStationFromProductId(product.id);

        return destinationStation.includes(currentUserStation.split(' - ')[0]) &&
               !senderStation.includes(currentUserStation.split(' - ')[0]);
    });

    const totalShipments = filteredProducts.length;
    const paidProducts = filteredProducts.filter(p => p.paymentStatus === 'paid');
    const unpaidProducts = filteredProducts.filter(p => p.paymentStatus === 'unpaid');

    const totalPaidAmount = paidProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalUnpaidAmount = unpaidProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalAmount = totalPaidAmount + totalUnpaidAmount;

    statsElement.innerHTML = `
        <div class="stats-summary">
            <div class="stats-header">Thống kê kho hàng - Trạm: ${currentUserStation}</div>
            <div class="stats-line">
                <span class="stats-text">${totalShipments} đơn hàng từ trạm khác</span>
            </div>
            <div class="stats-line stats-paid">
                Đã thu: <strong>${formatCurrency(totalPaidAmount)}đ</strong> / ${formatCurrency(totalAmount)}đ
            </div>
            <div class="stats-line stats-total">
                Tổng giá trị hàng: <strong>${formatCurrency(totalAmount)}đ</strong>
            </div>
        </div>
    `;
}

// Format tiền tệ
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount || 0);
}

// Export functions to global scope if needed
window.loadAllProducts = loadAllProducts;
