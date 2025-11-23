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
import { loadAllOptions, populateSelect, OPTIONS } from '../data/options.js';

let products = [];
let editingProductId = null;
let unsubscribeProducts = null;
let searchFilters = {}; // Bộ lọc tìm kiếm

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
    loadSearchOptions();

    // Load dữ liệu từ Firestore với real-time listener
    await loadProducts();

    // Sinh mã hàng tự động
    generateProductId();

    // Xử lý form tìm kiếm
    document.getElementById('searchForm').addEventListener('submit', handleSearch);
    document.getElementById('resetSearchBtn').addEventListener('click', resetSearch);

    // Lắng nghe sự thay đổi của trạm để sinh mã tự động
    document.getElementById('station').addEventListener('change', async function () {
        const station = this.value;
        if (station && !editingProductId) {
            const nextId = await getNextCounterForStation(station);
            document.getElementById('productId').value = nextId;
        }
    });

    // Xử lý submit form - Hiện modal thay vì submit trực tiếp
    document.getElementById('productForm').addEventListener('submit', function(e) {
        e.preventDefault();
        showConfirmModal();
    });

    // Xử lý phím Enter trong form
    document.getElementById('productForm').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Ngăn event lan ra ngoài
            showConfirmModal();
        }
    });

    // Xử lý phím ESC và Enter cho modal
    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('confirmModal');
        const isModalOpen = modal.classList.contains('show');

        if (isModalOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeConfirmModal();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // Nhấn Enter trong modal = Lưu
                document.getElementById('btnSave').click();
            }
        }
    });

    // Xử lý các nút trong modal
    document.getElementById('btnSave').addEventListener('click', function() {
        handleSubmit(false);
    });

    document.getElementById('btnSaveAndPrint').addEventListener('click', function() {
        handleSubmit(true);
    });

    document.getElementById('btnCancel').addEventListener('click', closeConfirmModal);

    // Đóng modal khi click bên ngoài
    document.getElementById('confirmModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeConfirmModal();
        }
    });

    // Xử lý nút làm mới (nếu có)
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetForm);
    }

    // Render bảng
    renderTable();

    // Tự động focus vào ô người nhận khi trang load xong
    setTimeout(() => {
        const receiverNameInput = document.getElementById('receiverName');
        if (receiverNameInput) {
            receiverNameInput.focus();
        }
    }, 200);
});

// Cập nhật UI với thông tin user
function updateUIWithUser(user) {
    const userElement = document.getElementById('currentUser');
    if (userElement) {
        userElement.textContent = user.fullName;
    }

    // Hiển thị tên trạm của user
    const stationNameElement = document.querySelector('.station-name');
    if (stationNameElement && user.station) {
        stationNameElement.textContent = user.station;
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

// Load options cho search dropdowns
function loadSearchOptions() {
    populateSelect('searchStation', OPTIONS.stations);
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
        station: document.getElementById('searchStation').value,
        vehicle: document.getElementById('searchVehicle').value,
        productType: document.getElementById('searchProductType').value
    };

    renderTable();
}

// Reset tìm kiếm
function resetSearch() {
    document.getElementById('searchForm').reset();
    searchFilters = {};
    renderTable();
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

// Hiện modal xác nhận
function showConfirmModal() {
    // Kiểm tra validation trước khi hiện modal
    const form = document.getElementById('productForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    document.getElementById('confirmModal').classList.add('show');

    // Tự động focus vào nút "Lưu" để user có thể nhấn Enter
    setTimeout(() => {
        document.getElementById('btnSave').focus();
    }, 100);
}

// Đóng modal xác nhận
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

// Xử lý submit form
async function handleSubmit(shouldPrint = false) {

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
        senderStation: currentUser.station || '', // Trạm gửi hàng (trạm của user hiện tại)
        station: station, // Trạm nhận hàng
        vehicle: document.getElementById('vehicle').value,
        productType: document.getElementById('productType').value.trim(),
        insurance: parseInt(document.getElementById('insurance')?.value || 0) || 0,
        totalAmount: totalAmount,
        paymentStatus: paymentStatus,
        employee: currentUser ? currentUser.fullName : 'Unknown',
        createdBy: currentUser ? currentUser.fullName : 'Unknown',
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
        closeConfirmModal();
        resetForm();

        // In biên lai nếu người dùng chọn
        if (shouldPrint) {
            printReceipt(formData);
        }
    }
}

// In biên lai
function printReceipt(productData) {
    const currentUser = getCurrentUser();
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Biên lai - ${productData.id}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Courier New', monospace;
                    padding: 20px;
                    font-size: 14px;
                }
                .receipt {
                    max-width: 400px;
                    margin: 0 auto;
                    border: 2px solid #000;
                    padding: 20px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px dashed #000;
                    padding-bottom: 15px;
                }
                .header h1 {
                    font-size: 18px;
                    margin-bottom: 5px;
                }
                .header p {
                    font-size: 12px;
                    margin: 3px 0;
                }
                .title {
                    text-align: center;
                    font-size: 16px;
                    font-weight: bold;
                    margin: 15px 0;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 8px 0;
                    padding: 5px 0;
                }
                .label {
                    font-weight: bold;
                }
                .divider {
                    border-top: 1px dashed #000;
                    margin: 15px 0;
                }
                .total {
                    font-size: 16px;
                    font-weight: bold;
                    text-align: right;
                    margin-top: 15px;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 2px dashed #000;
                    font-size: 12px;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h1>CTY DV XE DU LỊCH VÕ CÚC PHƯƠNG</h1>
                    <p>Địa chỉ: [Địa chỉ công ty]</p>
                    <p>Hotline: [Số điện thoại]</p>
                </div>

                <div class="title">BIÊN LAI GỬI HÀNG</div>

                <div class="info-row">
                    <span class="label">Mã đơn:</span>
                    <span>${productData.id}</span>
                </div>

                <div class="divider"></div>

                <div class="info-row">
                    <span class="label">Người gửi:</span>
                    <span>${productData.senderName || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="label">SĐT gửi:</span>
                    <span>${productData.senderPhone || '-'}</span>
                </div>

                <div class="divider"></div>

                <div class="info-row">
                    <span class="label">Người nhận:</span>
                    <span>${productData.receiverName}</span>
                </div>
                <div class="info-row">
                    <span class="label">SĐT nhận:</span>
                    <span>${productData.receiverPhone}</span>
                </div>
                <div class="info-row">
                    <span class="label">Trạm nhận:</span>
                    <span>${productData.station}</span>
                </div>

                <div class="divider"></div>

                <div class="info-row">
                    <span class="label">Loại hàng:</span>
                    <span>${productData.productType}</span>
                </div>
                <div class="info-row">
                    <span class="label">Xe:</span>
                    <span>${productData.vehicle || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Bảo hiểm:</span>
                    <span>${formatCurrency(productData.insurance)}đ</span>
                </div>

                <div class="divider"></div>

                <div class="total">
                    Tổng cước: ${formatCurrency(productData.totalAmount)}đ
                </div>

                <div class="footer">
                    <p>Ngày: ${new Date().toLocaleDateString('vi-VN')}</p>
                    <p>Nhân viên: ${currentUser.fullName}</p>
                    <p>---</p>
                    <p>Cảm ơn quý khách!</p>
                </div>
            </div>

            <div class="no-print" style="text-align: center; margin-top: 20px;">
                <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer;">In biên lai</button>
                <button onclick="window.close()" style="padding: 10px 30px; font-size: 16px; cursor: pointer; margin-left: 10px;">Đóng</button>
            </div>

            <script>
                // Tự động in khi load
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 250);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
}

// Reset form
function resetForm() {
    document.getElementById('productForm').reset();
    editingProductId = null;
    generateProductId();

    // Xóa highlight nếu có
    const editRows = document.querySelectorAll('.edit-mode');
    editRows.forEach(row => row.classList.remove('edit-mode'));

    // Tự động focus vào ô người nhận
    setTimeout(() => {
        document.getElementById('receiverName').focus();
    }, 100);
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
    const currentUser = getCurrentUser();

    // Lưu hàng form input (hàng đầu tiên)
    const formInputRow = tbody.querySelector('.form-input-row');
    const formInputRowHTML = formInputRow ? formInputRow.outerHTML : '';

    console.log('=== RENDER TABLE DEBUG ===');
    console.log('Current User:', currentUser);
    console.log('Current Station:', currentUser?.station);
    console.log('Total products before filter:', products.length);

    // Filter: Chỉ hiển thị hàng do trạm hiện tại gửi
    let filteredProducts = products.filter(product => {
        // Nếu user không có station, hiển thị tất cả (cho admin)
        if (!currentUser || !currentUser.station) {
            console.log('No station filter (admin mode)');
            return true;
        }

        // Debug: Log first few products to see their senderStation
        if (products.indexOf(product) < 3) {
            console.log(`Product ${product.id}: senderStation="${product.senderStation}", currentStation="${currentUser.station}", match=${product.senderStation === currentUser.station}`);
        }

        // Chỉ hiển thị hàng có senderStation được set VÀ bằng trạm hiện tại
        // Nếu senderStation không tồn tại hoặc rỗng, không hiển thị
        if (!product.senderStation) {
            return false;
        }

        // Chỉ hiển thị hàng nhập hôm nay
        if (!isToday(product.sendDate) && !isToday(product.createdAt)) {
            return false;
        }

        // So sánh chính xác senderStation với station của user hiện tại
        return product.senderStation === currentUser.station;
    });

    console.log('Products after station filter:', filteredProducts.length);
    console.log('=======================');

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

            // Filter by station
            if (searchFilters.station && product.station !== searchFilters.station) {
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

    // Render data rows
    let dataRowsHTML = '';

    if (filteredProducts.length === 0) {
        dataRowsHTML = `
            <tr>
                <td colspan="15" style="text-align: center; padding: 30px; color: #9ca3af;">
                    Chưa có dữ liệu hàng hóa. Vui lòng thêm hàng hóa mới.
                </td>
            </tr>
        `;
    } else {
        dataRowsHTML = filteredProducts.map((product, index) => {
        const formattedDate = formatDateTime(product.sendDate || new Date().toISOString());
        const formattedAmount = formatCurrency(product.totalAmount || 0);

        // Xác định trạng thái thanh toán (nếu chưa có trong data)
        const paymentStatus = product.paymentStatus || ((product.totalAmount || 0) >= 10000 ? 'paid' : 'unpaid');
        const paymentStatusText = paymentStatus === 'paid' ?
            '<span class="status-paid">Đã thanh toán</span>' :
            '<span class="status-unpaid">Chưa thanh toán</span>';

        return `
            <tr data-id="${product.id || 'unknown'}"
                data-sender-name="${product.senderName || ''}"
                data-sender-phone="${product.senderPhone || ''}"
                data-receiver-name="${product.receiverName || ''}"
                data-receiver-phone="${product.receiverPhone || ''}"
                data-station="${product.station || ''}"
                data-vehicle="${product.vehicle || ''}"
                data-product-type="${product.productType || ''}"
                data-total-amount="${product.totalAmount || 0}"
                onclick="enableInlineEdit(this, event)">
                <td onclick="event.stopPropagation()"><input type="checkbox" class="row-checkbox" value="${product.id}" onchange="handleRowSelection()"></td>
                <td>${index + 1}</td>
                <td class="product-code">${product.id || '-'}</td>
                <td class="editable" data-field="senderName">${product.senderName || '-'}</td>
                <td class="editable" data-field="senderPhone">${product.senderPhone || '-'}</td>
                <td class="editable" data-field="receiverName">${product.receiverName || '-'}</td>
                <td class="editable" data-field="receiverPhone">${product.receiverPhone || '-'}</td>
                <td class="editable" data-field="station">${product.station || '-'}</td>
                <td>${formattedDate}</td>
                <td class="editable" data-field="vehicle">${product.vehicle || '-'}</td>
                <td class="editable" data-field="productType">${product.productType || '-'}</td>
                <td class="editable" data-field="totalAmount">${formattedAmount}</td>
                <td>${paymentStatusText}</td>
                <td>${product.employee || '-'}</td>
                <td class="action-cell" onclick="event.stopPropagation()">
                    <button class="btn btn-danger" onclick="deleteProductHandler('${product.id}')">Xóa</button>
                </td>
            </tr>
        `;
        }).join('');
    }

    // Kết hợp form input row với data rows
    tbody.innerHTML = formInputRowHTML + dataRowsHTML;

    // Cập nhật thống kê
    updateStatistics(filteredProducts);
}

// Cập nhật thống kê
function updateStatistics(filteredProducts = null) {
    // Nếu không truyền vào, lấy products đã filter theo station
    if (!filteredProducts) {
        const currentUser = getCurrentUser();
        filteredProducts = products.filter(product => {
            if (!currentUser || !currentUser.station) {
                return true;
            }
            // Chỉ tính sản phẩm có senderStation được set VÀ bằng trạm hiện tại
            if (!product.senderStation) {
                return false;
            }
            // Chỉ tính hàng nhập hôm nay
            if (!isToday(product.sendDate) && !isToday(product.createdAt)) {
                return false;
            }
            return product.senderStation === currentUser.station;
        });
    }

    // Tính toán các chỉ số
    const totalShipments = filteredProducts.length;

    const paidProducts = filteredProducts.filter(p => {
        const status = p.paymentStatus || (p.totalAmount >= 10000 ? 'paid' : 'unpaid');
        return status === 'paid';
    });

    const unpaidProducts = filteredProducts.filter(p => {
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

// ===== INLINE EDITING FUNCTIONS =====

let currentEditingRow = null;

// Enable inline edit mode for a row
function enableInlineEdit(row, event) {
    // Prevent editing if clicking on action buttons
    if (event.target.closest('.action-cell') || event.target.closest('button')) {
        return;
    }

    // If already editing another row, save it first
    if (currentEditingRow && currentEditingRow !== row) {
        const currentProductId = currentEditingRow.dataset.id;
        saveInlineEdit(currentProductId);
    }

    // If clicking on the same row that's already editing, do nothing
    if (row.classList.contains('editing-row')) {
        return;
    }

    // Mark row as editing
    row.classList.add('editing-row');
    currentEditingRow = row;

    const productId = row.dataset.id;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Convert editable cells to inputs
    const editableCells = row.querySelectorAll('.editable');
    editableCells.forEach(cell => {
        const field = cell.dataset.field;
        let value = product[field] || '';

        // Remove formatting for totalAmount
        if (field === 'totalAmount') {
            value = product[field] || 0;
        }

        // Create appropriate input based on field type
        if (field === 'station' || field === 'vehicle' || field === 'productType') {
            // Create select dropdown
            let options = [];
            if (field === 'station') {
                options = OPTIONS.stations || [];
            } else if (field === 'vehicle') {
                options = OPTIONS.vehicles || [];
            } else if (field === 'productType') {
                options = OPTIONS.productTypes || [];
            }

            const select = document.createElement('select');
            select.className = 'editable-input';
            select.innerHTML = options.map(opt =>
                `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
            ).join('');

            // Auto-save on change
            select.addEventListener('change', () => {
                saveInlineEdit(productId);
            });

            cell.innerHTML = '';
            cell.appendChild(select);
        } else {
            // Create text or number input
            const input = document.createElement('input');
            input.type = field === 'totalAmount' ? 'number' :
                         (field.includes('Phone') ? 'tel' : 'text');
            input.className = 'editable-input';
            input.value = value;

            // Auto-save on Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveInlineEdit(productId);
                } else if (e.key === 'Escape') {
                    cancelInlineEdit();
                }
            });

            cell.innerHTML = '';
            cell.appendChild(input);

            // Auto-focus first input
            if (editableCells[0] === cell) {
                input.focus();
            }
        }
    });

    // Remove row click handler while editing
    row.onclick = null;

    // Add document click handler to save when clicking outside
    setupClickOutsideHandler(row, productId);
}

// Setup click outside handler
function setupClickOutsideHandler(row, productId) {
    // Remove previous handler if exists
    if (window.clickOutsideHandler) {
        document.removeEventListener('click', window.clickOutsideHandler);
    }

    // Create new handler
    window.clickOutsideHandler = function(event) {
        // If clicking outside the editing row
        if (currentEditingRow && !currentEditingRow.contains(event.target)) {
            // Don't save if clicking on another data row (it will trigger its own edit)
            const clickedRow = event.target.closest('tr');
            const isDataRow = clickedRow && clickedRow.dataset.id && !clickedRow.classList.contains('form-input-row');

            if (!isDataRow) {
                // Save the current editing row
                saveInlineEdit(productId);
            }
        }
    };

    // Add the handler
    setTimeout(() => {
        document.addEventListener('click', window.clickOutsideHandler);
    }, 100);
}

// Save inline edit
async function saveInlineEdit(productId) {
    if (!currentEditingRow) return;

    const row = currentEditingRow;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Collect updated values from inputs
    const updates = {};
    const editableCells = row.querySelectorAll('.editable');

    editableCells.forEach(cell => {
        const field = cell.dataset.field;
        const input = cell.querySelector('input, select');
        if (input) {
            let value = input.value;

            // Convert totalAmount to number
            if (field === 'totalAmount') {
                value = parseFloat(value) || 0;
            }

            updates[field] = value;
        }
    });

    try {
        // Update in Firestore
        await updateProduct(productId, updates);

        // Update local product object
        Object.assign(product, updates);

        // Show success notification
        showNotification('Cập nhật thành công!', 'success');

        // Re-render table
        renderTable();

        // Cleanup click handler
        if (window.clickOutsideHandler) {
            document.removeEventListener('click', window.clickOutsideHandler);
            window.clickOutsideHandler = null;
        }

        currentEditingRow = null;
    } catch (error) {
        console.error('Error updating product:', error);
        showNotification('Lỗi khi cập nhật: ' + error.message, 'error');
    }
}

// Cancel inline edit
function cancelInlineEdit() {
    if (!currentEditingRow) return;

    // Re-render table to restore original state
    renderTable();

    // Cleanup click handler
    if (window.clickOutsideHandler) {
        document.removeEventListener('click', window.clickOutsideHandler);
        window.clickOutsideHandler = null;
    }

    currentEditingRow = null;
}

// ===== BULK EDIT FUNCTIONS =====

// Handle row selection
function handleRowSelection() {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    const selectedCount = checkboxes.length;

    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    const allCheckboxes = document.querySelectorAll('.row-checkbox');
    selectAllCheckbox.checked = selectedCount === allCheckboxes.length && selectedCount > 0;

    // Show/hide bulk edit panel
    const bulkPanel = document.getElementById('bulkEditPanel');
    const countSpan = document.getElementById('bulkEditCount');

    if (selectedCount > 0) {
        bulkPanel.style.display = 'block';
        countSpan.textContent = `${selectedCount} đơn hàng được chọn`;

        // Highlight selected rows
        document.querySelectorAll('tr[data-id]').forEach(row => {
            const checkbox = row.querySelector('.row-checkbox');
            if (checkbox && checkbox.checked) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    } else {
        bulkPanel.style.display = 'none';
        document.querySelectorAll('tr.selected').forEach(row => row.classList.remove('selected'));
    }
}

// Select all checkbox handler
document.addEventListener('DOMContentLoaded', () => {
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = this.checked;
            });
            handleRowSelection();
        });
    }

    // Populate bulk edit dropdowns
    populateBulkEditOptions();
});

// Populate bulk edit dropdown options
function populateBulkEditOptions() {
    const bulkVehicle = document.getElementById('bulkVehicle');
    const bulkProductType = document.getElementById('bulkProductType');

    if (bulkVehicle && OPTIONS.vehicles) {
        OPTIONS.vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle;
            option.textContent = vehicle;
            bulkVehicle.appendChild(option);
        });
    }

    if (bulkProductType && OPTIONS.productTypes) {
        OPTIONS.productTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            bulkProductType.appendChild(option);
        });
    }
}

// Apply bulk edit
async function applyBulkEdit() {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedIds.length === 0) {
        showNotification('Vui lòng chọn ít nhất 1 đơn hàng', 'error');
        return;
    }

    const bulkVehicle = document.getElementById('bulkVehicle').value;
    const bulkProductType = document.getElementById('bulkProductType').value;

    const updates = {};
    if (bulkVehicle) updates.vehicle = bulkVehicle;
    if (bulkProductType) updates.productType = bulkProductType;

    if (Object.keys(updates).length === 0) {
        showNotification('Vui lòng chọn ít nhất 1 trường để cập nhật', 'error');
        return;
    }

    try {
        // Update each selected product
        const updatePromises = selectedIds.map(id => updateProduct(id, updates));
        await Promise.all(updatePromises);

        // Update local products array
        selectedIds.forEach(id => {
            const product = products.find(p => p.id === id);
            if (product) {
                Object.assign(product, updates);
            }
        });

        showNotification(`Đã cập nhật ${selectedIds.length} đơn hàng thành công!`, 'success');

        // Close bulk edit and re-render
        closeBulkEdit();
        renderTable();
    } catch (error) {
        console.error('Error bulk updating:', error);
        showNotification('Lỗi khi cập nhật hàng loạt: ' + error.message, 'error');
    }
}

// Close bulk edit panel
function closeBulkEdit() {
    // Uncheck all checkboxes
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('selectAll').checked = false;

    // Reset dropdowns
    document.getElementById('bulkVehicle').value = '';
    document.getElementById('bulkProductType').value = '';

    // Hide panel
    document.getElementById('bulkEditPanel').style.display = 'none';

    // Remove selection highlights
    document.querySelectorAll('tr.selected').forEach(row => row.classList.remove('selected'));
}

// Export functions to global scope
window.editProduct = editProduct;
window.deleteProductHandler = deleteProductHandler;
window.enableInlineEdit = enableInlineEdit;
window.saveInlineEdit = saveInlineEdit;
window.cancelInlineEdit = cancelInlineEdit;
window.handleRowSelection = handleRowSelection;
window.applyBulkEdit = applyBulkEdit;
window.closeBulkEdit = closeBulkEdit;
