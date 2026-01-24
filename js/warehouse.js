// Warehouse Module - Hiển thị hàng hóa từ các trạm khác
import {
    getAllProducts,
    updateProduct
} from './api.js';

import { populateSelect, OPTIONS } from '../data/options.js';

let allProducts = [];
let currentUserStation = '';
let searchFilters = {}; // Bộ lọc tìm kiếm

// ✅ FIX: Helper function để parse date không bị convert timezone
function parseLocalDate(dateString) {
    if (!dateString) return new Date();
    // Bỏ Z suffix và timezone offset để giữ nguyên giờ
    const cleanDateStr = String(dateString).replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '');
    return new Date(cleanDateStr);
}

// ✅ FIX: Format date cho hiển thị (không bị convert timezone)
function formatSendDate(dateString) {
    const date = parseLocalDate(dateString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${hours}h${minutes} - ${day}/${month}/${year}`;
}

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

    const productDate = parseLocalDate(dateString);
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
    const currentUser = getCurrentUser();

    console.log('=== WAREHOUSE DEBUG ===');
    console.log('Current Station:', currentUserStation);
    console.log('User Role:', currentUser?.role);
    console.log('Total products:', allProducts.length);

    // Filter: Chỉ hiển thị hàng có trạm nhận = trạm hiện tại
    // và trạm gửi khác trạm hiện tại (tức là từ trạm khác gửi đến)
    let filteredProducts = allProducts.filter(product => {
        // ✅ Chỉ hiển thị hàng trong ngày hôm nay (áp dụng cho TẤT CẢ user, kể cả admin)
        if (!isToday(product.sendDate) && !isToday(product.createdAt)) {
            return false;
        }

        // ✅ Admin có quyền xem TẤT CẢ đơn hàng từ mọi trạm (chỉ trong ngày)
        if (currentUser && currentUser.role === 'admin') {
            return true;
        }

        // Nếu không có station của user, hiển thị tất cả trong ngày
        if (!currentUserStation) {
            return true;
        }

        const destinationStation = product.station || ''; // Trạm nhận
        const senderStation = product.senderStation || ''; // Trạm gửi

        // Chỉ hiển thị hàng có senderStation
        if (!senderStation) {
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
                const productDate = parseLocalDate(product.sendDate);
                const fromDate = new Date(searchFilters.dateFrom);
                if (productDate < fromDate) return false;
            }
            if (searchFilters.dateTo) {
                const productDate = parseLocalDate(product.sendDate);
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
    filteredProducts.sort((a, b) => parseLocalDate(b.sendDate) - parseLocalDate(a.sendDate));

    tbody.innerHTML = filteredProducts.map((product, index) => {
        const sendDate = formatSendDate(product.sendDate);
        const paymentBadge = product.paymentStatus === 'paid'
            ? `<span class="status-badge status-active">Đã thu: ${formatCurrency(product.totalAmount)}đ</span>`
            : '<span class="status-badge status-inactive">Chưa thu</span>';

        const deliveryStatus = product.deliveryStatus || 'pending';
        const deliveryStatusInfo = getDeliveryStatusInfo(deliveryStatus);

        // Nút mở modal chọn trạng thái
        const deliveryActions = `<button class="btn-status-action" onclick="openStatusModal('${product.id}', '${deliveryStatus}')">Cập nhật</button>`;

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
                <td><span class="delivery-status ${deliveryStatusInfo.class}">${deliveryStatusInfo.text}</span></td>
                <td>${deliveryActions}</td>
            </tr>
        `;
    }).join('');
}

// Render statistics
function renderWarehouseStatistics() {
    const statsElement = document.getElementById('warehouseStatistics');
    const currentUser = getCurrentUser();

    // Filter products for current station (same logic as table)
    const filteredProducts = allProducts.filter(product => {
        // ✅ Chỉ tính hàng trong ngày hôm nay
        if (!isToday(product.sendDate) && !isToday(product.createdAt)) {
            return false;
        }

        // ✅ Admin thấy tất cả đơn hàng trong ngày
        if (currentUser && currentUser.role === 'admin') {
            return true;
        }

        if (!currentUserStation) return true;

        const destinationStation = product.station || '';
        const senderStation = product.senderStation || '';

        // Chỉ tính sản phẩm có senderStation
        if (!senderStation) {
            return false;
        }

        return destinationStation === currentUserStation &&
               senderStation !== currentUserStation;
    });

    const totalShipments = filteredProducts.length;

    // Chỉ tính "Đã thu" khi: deliveryStatus = 'delivered' VÀ paymentStatus = 'paid'
    const deliveredAndPaid = filteredProducts.filter(p =>
        p.deliveryStatus === 'delivered' && p.paymentStatus === 'paid'
    );
    const totalCollectedAmount = deliveredAndPaid.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // Tổng giá trị tất cả đơn hàng
    const totalAmount = filteredProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // Số đơn chưa giao/chưa thu
    const pendingCount = filteredProducts.filter(p => p.deliveryStatus !== 'delivered').length;

    const isAdmin = currentUser && currentUser.role === 'admin';
    const stationLabel = isAdmin ? 'Tất cả trạm' : currentUserStation;
    const shipmentLabel = isAdmin ? `${totalShipments} đơn hàng hôm nay` : `${totalShipments} đơn hàng từ trạm khác`;

    statsElement.innerHTML = `
        <div class="stats-summary">
            <div class="stats-header">Thống kê kho hàng - ${stationLabel}</div>
            <div class="stats-line">
                <span class="stats-text">${shipmentLabel}</span>
            </div>
            <div class="stats-line stats-paid">
                Đã thu (đã giao): <strong>${formatCurrency(totalCollectedAmount)}đ</strong> (${deliveredAndPaid.length} đơn)
            </div>
            <div class="stats-line" style="color: #F59E0B;">
                Chưa giao: <strong>${pendingCount} đơn</strong>
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

// Lấy thông tin trạng thái giao hàng
function getDeliveryStatusInfo(status) {
    const statusMap = {
        'pending': { text: 'Chờ xử lý', class: 'status-pending' },
        'waiting_send': { text: 'Chờ gởi', class: 'status-waiting-send' },
        'waiting_receive': { text: 'Chờ nhận', class: 'status-waiting-receive' },
        'lost': { text: 'Thất lạc', class: 'status-lost' },
        'no_contact': { text: 'Không liên lạc', class: 'status-no-contact' },
        'delivered': { text: 'Đã giao', class: 'status-delivered' }
    };
    return statusMap[status] || statusMap['pending'];
}

// Biến lưu productId và thông tin sản phẩm hiện tại đang chọn
let currentEditingProductId = null;
let currentEditingProduct = null;

// Mở modal chọn trạng thái
function openStatusModal(productId, currentStatus) {
    currentEditingProductId = productId;
    // Tìm sản phẩm trong danh sách
    currentEditingProduct = allProducts.find(p => p.id === productId);

    const statusOptions = [
        { value: 'pending', label: 'Chờ xử lý' },
        { value: 'waiting_send', label: 'Chờ gởi' },
        { value: 'waiting_receive', label: 'Chờ nhận' },
        { value: 'lost', label: 'Thất lạc' },
        { value: 'no_contact', label: 'Không liên lạc' },
        { value: 'delivered', label: 'Đã giao' }
    ];

    const grid = document.getElementById('statusGrid');
    grid.innerHTML = statusOptions.map(option => `
        <div class="status-grid-item ${currentStatus === option.value ? 'active' : ''}"
             onclick="selectStatus('${option.value}')">
            ${option.label}
        </div>
    `).join('');

    // Ẩn phần nhập tiền
    document.getElementById('deliveredAmountSection').style.display = 'none';
    document.getElementById('statusGrid').style.display = 'flex';

    document.getElementById('statusModalOverlay').classList.add('show');
}

// Đóng modal
function closeStatusModal() {
    document.getElementById('statusModalOverlay').classList.remove('show');
    document.getElementById('deliveredAmountSection').style.display = 'none';
    document.getElementById('statusGrid').style.display = 'flex';
    currentEditingProductId = null;
    currentEditingProduct = null;
}

// Chọn trạng thái và cập nhật
async function selectStatus(status) {
    if (!currentEditingProductId) return;

    // Nếu chọn "Đã giao" -> luôn hiện form nhập tiền để có thể xem/sửa
    if (status === 'delivered' && currentEditingProduct) {
        document.getElementById('statusGrid').style.display = 'none';
        document.getElementById('deliveredAmountSection').style.display = 'block';

        // Hiển thị thông tin đơn hàng để đối chiếu
        document.getElementById('infoProductId').textContent = currentEditingProduct.id || '-';
        document.getElementById('infoReceiverName').textContent = currentEditingProduct.receiverName || '-';
        document.getElementById('infoReceiverPhone').textContent = currentEditingProduct.receiverPhone || '-';
        document.getElementById('infoCurrentAmount').textContent = formatCurrency(currentEditingProduct.totalAmount || 0) + 'đ';

        // Đặt giá trị mặc định là tổng tiền của đơn hàng (hoặc 0)
        const amountInput = document.getElementById('deliveredAmount');
        amountInput.value = currentEditingProduct.totalAmount || 0;
        document.getElementById('deliveredNote').value = currentEditingProduct.notes || '';
        // Focus và select all để có thể nhập ngay
        setTimeout(() => {
            amountInput.focus();
            amountInput.select();
        }, 100);
        return;
    }

    await updateDeliveryStatus(currentEditingProductId, status);
    closeStatusModal();
}

// Xác nhận đã giao (với số tiền thu)
async function confirmDelivered() {
    if (!currentEditingProductId) return;

    const amount = document.getElementById('deliveredAmount').value;
    const note = document.getElementById('deliveredNote').value;

    // Không cho phép số tiền = 0
    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) {
        showToast('Vui lòng nhập số tiền đã thu (phải lớn hơn 0đ)', 'error');
        document.getElementById('deliveredAmount').focus();
        document.getElementById('deliveredAmount').select();
        return;
    }

    // Cập nhật trạng thái + thanh toán + số tiền thu + ghi chú
    try {
        const updateData = {
            deliveryStatus: 'delivered',
            paymentStatus: 'paid',
            totalAmount: parsedAmount
        };

        if (note) {
            updateData.notes = note;
        }

        const result = await updateProduct(currentEditingProductId, updateData);

        if (result && result.success) {
            await loadAllProducts();
            renderWarehouseTable();
            renderWarehouseStatistics();
            showToast(`Đã giao & thu ${formatCurrency(amount)}đ`);
            closeStatusModal();
        } else if (result?.code === 'EDIT_TIME_EXPIRED') {
            // Hết thời gian sửa giá - hiển thị thông báo đặc biệt
            showToast('Đã quá 1 phút! Vui lòng hủy đơn và tạo lại nếu cần sửa giá.', 'error');
            closeStatusModal();
        } else {
            showToast('Lỗi: ' + (result?.message || result?.error || 'Không xác định'), 'error');
        }
    } catch (error) {
        console.error('Error confirming delivery:', error);
        showToast('Có lỗi khi xác nhận giao hàng', 'error');
        closeStatusModal();
    }
}

// Đóng modal khi click ra ngoài
document.addEventListener('click', function(e) {
    const overlay = document.getElementById('statusModalOverlay');
    if (e.target === overlay) {
        closeStatusModal();
    }
});

// Khi bấm vào ô số tiền, tự động select all để nhập ngay
// Và xử lý phím Enter để xác nhận, ESC để đóng
document.addEventListener('DOMContentLoaded', function() {
    const amountInput = document.getElementById('deliveredAmount');
    const noteInput = document.getElementById('deliveredNote');

    if (amountInput) {
        amountInput.addEventListener('focus', function() {
            this.select();
        });

        // Nhấn Enter để xác nhận
        amountInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmDelivered();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeStatusModal();
            }
        });
    }

    // Xử lý Enter và ESC trên ô ghi chú
    if (noteInput) {
        noteInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmDelivered();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeStatusModal();
            }
        });
    }
});

// Đóng modal khi nhấn ESC ở bất kỳ đâu
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('statusModalOverlay');
        if (overlay && overlay.classList.contains('show')) {
            e.preventDefault();
            closeStatusModal();
        }
    }
});

// Hiển thị toast notification
function showToast(message, type = 'success') {
    // Tạo container nếu chưa có
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Tạo toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Tự động xóa sau 2 giây
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// Update delivery status
async function updateDeliveryStatus(productId, status) {
    try {
        console.log('Updating delivery status:', productId, status);
        const result = await updateProduct(productId, { deliveryStatus: status });
        console.log('Update result:', result);

        if (result && result.success) {
            // Reload products and re-render
            await loadAllProducts();
            renderWarehouseTable();
            renderWarehouseStatistics();

            // Lấy tên trạng thái để hiển thị
            const statusInfo = getDeliveryStatusInfo(status);
            showToast(`Đã cập nhật: "${statusInfo.text}"`);
        } else {
            showToast('Lỗi: ' + (result?.error || 'Không xác định'), 'error');
        }
    } catch (error) {
        console.error('Error updating delivery status:', error);
        showToast('Có lỗi khi cập nhật trạng thái', 'error');
    }
}

// Export functions to global scope if needed
window.loadAllProducts = loadAllProducts;
window.updateDeliveryStatus = updateDeliveryStatus;
window.openStatusModal = openStatusModal;
window.closeStatusModal = closeStatusModal;
window.selectStatus = selectStatus;
window.confirmDelivered = confirmDelivered;
