// Warehouse Module - Hiển thị hàng hóa từ các trạm khác
import {
    getAllProducts,
    updateProduct
} from './firebase-db.js';

import { populateSelect, OPTIONS } from '../data/options.js';

let allProducts = [];
let currentUserStation = '';
let searchFilters = {}; // Bộ lọc tìm kiếm

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

    // Hiển thị tên trạm (bỏ số và dấu gạch ngang)
    if (currentUserStation) {
        // Ví dụ: "01 - AN ĐỒNG" -> "AN ĐỒNG"
        const stationName = currentUserStation.includes(' - ')
            ? currentUserStation.split(' - ')[1]
            : currentUserStation;
        document.getElementById('currentStationName').textContent = stationName;
    }

    // Load search options
    loadSearchOptions();

    // Load tất cả sản phẩm
    await loadAllProducts();

    // Render bảng với filter
    renderWarehouseTable();

    // Render statistics
    renderWarehouseStatistics();

    // Xử lý form tìm kiếm
    document.getElementById('searchForm').addEventListener('submit', handleSearch);
    document.getElementById('resetSearchBtn').addEventListener('click', resetSearch);
});

// Load options cho search dropdowns
function loadSearchOptions() {
    populateSelect('searchSenderStation', OPTIONS.stations);
    populateSelect('searchVehicle', OPTIONS.vehicles);
    populateSelect('searchProductType', OPTIONS.productTypes);
}

// Xử lý tìm kiếm
function handleSearch(e) {
    e.preventDefault();

    searchFilters = {
        keyword: document.getElementById('searchKeyword').value.trim().toLowerCase(),
        dateFrom: document.getElementById('searchDateFrom').value,
        dateTo: document.getElementById('searchDateTo').value,
        senderStation: document.getElementById('searchSenderStation').value,
        vehicle: document.getElementById('searchVehicle').value,
        productType: document.getElementById('searchProductType').value
    };

    renderWarehouseTable();
    renderWarehouseStatistics();
}

// Reset tìm kiếm
function resetSearch() {
    document.getElementById('searchForm').reset();
    searchFilters = {};
    renderWarehouseTable();
    renderWarehouseStatistics();
}

// Kiểm tra xem sản phẩm có phải từ hôm nay không
function isToday(dateString) {
    if (!dateString) return false;

    const productDate = new Date(dateString);
    const today = new Date();

    return productDate.getDate() === today.getDate() &&
           productDate.getMonth() === today.getMonth() &&
           productDate.getFullYear() === today.getFullYear();
}

// Load tất cả products từ Firestore
async function loadAllProducts() {
    allProducts = await getAllProducts();
}

// Render bảng warehouse - chỉ hiển thị hàng từ trạm khác gửi đến trạm hiện tại
function renderWarehouseTable() {
    const tbody = document.getElementById('warehouseTableBody');

    console.log('=== WAREHOUSE DEBUG ===');
    console.log('Current Station:', currentUserStation);
    console.log('Total products:', allProducts.length);

    // Filter: Chỉ hiển thị hàng có trạm nhận = trạm hiện tại
    // và trạm gửi khác trạm hiện tại (tức là từ trạm khác gửi đến)
    let filteredProducts = allProducts.filter(product => {
        // Nếu không có station của user, hiển thị tất cả
        if (!currentUserStation) {
            console.log('No current station - showing all');
            return true;
        }

        const destinationStation = product.station || ''; // Trạm nhận
        const senderStation = product.senderStation || ''; // Trạm gửi

        // Debug first few products
        if (allProducts.indexOf(product) < 3) {
            console.log(`Product ${product.id}: destination="${destinationStation}", sender="${senderStation}", current="${currentUserStation}"`);
            console.log(`  Match: dest==current? ${destinationStation === currentUserStation}, sender!=current? ${senderStation !== currentUserStation}`);
        }

        // Chỉ hiển thị hàng có senderStation VÀ destination = trạm hiện tại VÀ sender khác trạm hiện tại
        if (!senderStation) {
            return false; // Không hiển thị hàng không có senderStation
        }

        // Chỉ hiển thị hàng nhập hôm nay
        if (!isToday(product.sendDate) && !isToday(product.createdAt)) {
            return false;
        }

        // Hiển thị nếu: trạm nhận = trạm hiện tại VÀ trạm gửi khác trạm hiện tại
        return destinationStation === currentUserStation &&
               senderStation !== currentUserStation;
    });

    console.log('Products after filter:', filteredProducts.length);
    console.log('=====================');

    // Apply search filters
    if (Object.keys(searchFilters).length > 0) {
        filteredProducts = filteredProducts.filter(product => {
            // Filter by keyword (mã, tên người gửi, tên người nhận, sđt)
            if (searchFilters.keyword) {
                const keyword = searchFilters.keyword;
                const matchId = (product.id || '').toLowerCase().includes(keyword);
                const matchSender = (product.senderName || '').toLowerCase().includes(keyword);
                const matchReceiver = (product.receiverName || '').toLowerCase().includes(keyword);
                const matchSenderPhone = (product.senderPhone || '').toLowerCase().includes(keyword);
                const matchReceiverPhone = (product.receiverPhone || '').toLowerCase().includes(keyword);

                if (!matchId && !matchSender && !matchReceiver && !matchSenderPhone && !matchReceiverPhone) {
                    return false;
                }
            }

            // Filter by date range
            if (searchFilters.dateFrom) {
                const productDate = new Date(product.sendDate);
                const fromDate = new Date(searchFilters.dateFrom);
                if (productDate < fromDate) return false;
            }
            if (searchFilters.dateTo) {
                const productDate = new Date(product.sendDate);
                const toDate = new Date(searchFilters.dateTo);
                if (productDate > toDate) return false;
            }

            // Filter by sender station
            if (searchFilters.senderStation && product.senderStation !== searchFilters.senderStation) {
                return false;
            }

            // Filter by vehicle
            if (searchFilters.vehicle && product.vehicle !== searchFilters.vehicle) {
                return false;
            }

            // Filter by product type
            if (searchFilters.productType && product.productType !== searchFilters.productType) {
                return false;
            }

            return true;
        });
    }

    if (filteredProducts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="16" style="text-align: center; padding: 30px; color: #9ca3af;">
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

        const deliveryStatus = product.deliveryStatus || 'pending';
        const deliveryStatusText = deliveryStatus === 'delivered' ? 'Đã giao' : 'Chưa giao';
        const deliveryStatusClass = deliveryStatus === 'delivered' ? 'status-delivered' : 'status-pending';

        const deliveryActions = deliveryStatus === 'delivered'
            ? `<button class="btn-deliver btn-mark-pending" onclick="updateDeliveryStatus('${product.id}', 'pending')">Chưa giao</button>`
            : `<button class="btn-deliver btn-mark-delivered" onclick="updateDeliveryStatus('${product.id}', 'delivered')">Đã giao</button>`;

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${product.id}</td>
                <td>${product.senderName || '-'}</td>
                <td>${product.senderPhone || '-'}</td>
                <td>${product.receiverName}</td>
                <td>${product.receiverPhone}</td>
                <td>${formatStationName(product.senderStation || '-')}</td>
                <td>${formatStationName(product.station)}</td>
                <td>${sendDate}</td>
                <td>${product.vehicle || '-'}</td>
                <td>${product.productType}</td>
                <td>${formatCurrency(product.totalAmount)}</td>
                <td>${paymentBadge}</td>
                <td>${product.createdBy || '-'}</td>
                <td><span class="delivery-status ${deliveryStatusClass}">${deliveryStatusText}</span></td>
                <td>${deliveryActions}</td>
            </tr>
        `;
    }).join('');
}

// Render statistics
function renderWarehouseStatistics() {
    const statsElement = document.getElementById('warehouseStatistics');

    // Filter products for current station (same logic as table)
    const filteredProducts = allProducts.filter(product => {
        if (!currentUserStation) return true;

        const destinationStation = product.station || '';
        const senderStation = product.senderStation || '';

        // Chỉ tính sản phẩm có senderStation
        if (!senderStation) {
            return false;
        }

        // Chỉ tính hàng nhập hôm nay
        if (!isToday(product.sendDate) && !isToday(product.createdAt)) {
            return false;
        }

        return destinationStation === currentUserStation &&
               senderStation !== currentUserStation;
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

// Format station name - remove number prefix
function formatStationName(station) {
    if (!station || station === '-') return station;
    return station.includes(' - ') ? station.split(' - ')[1] : station;
}

// Update delivery status
async function updateDeliveryStatus(productId, status) {
    try {
        await updateProduct(productId, { deliveryStatus: status });

        // Reload products and re-render
        await loadAllProducts();
        renderWarehouseTable();
        renderWarehouseStatistics();

        const statusText = status === 'delivered' ? 'đã giao' : 'chưa giao';
        alert(`Đã cập nhật trạng thái thành "${statusText}"`);
    } catch (error) {
        console.error('Error updating delivery status:', error);
        alert('Có lỗi khi cập nhật trạng thái. Vui lòng thử lại.');
    }
}

// Export functions to global scope if needed
window.loadAllProducts = loadAllProducts;
window.updateDeliveryStatus = updateDeliveryStatus;
