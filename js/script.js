// Quản lý dữ liệu hàng hóa với Backend API
import {
    listenToProducts,
    getAllProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getCounter,
    incrementCounter
} from './api.js';

// Import options data
import { loadAllOptions, populateSelect, OPTIONS } from '../data/options.js';

let products = [];
let editingProductId = null;
let unsubscribeProducts = null;
let searchFilters = {}; // Bộ lọc tìm kiếm
let isSubmitting = false; // Ngăn chặn submit nhiều lần liên tục

// ✅ FIX: Helper function để parse date không bị convert timezone
function parseLocalDate(dateString) {
    if (!dateString) return new Date();
    // Bỏ Z suffix và timezone offset để giữ nguyên giờ
    const cleanDateStr = String(dateString).replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '');
    return new Date(cleanDateStr);
}

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
    document.getElementById('productForm').addEventListener('submit', function (e) {
        e.preventDefault();
        showConfirmModal();
    });

    // Xử lý phím Enter trong form - Hiện modal
    document.getElementById('productForm').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Ngăn event lan ra ngoài
            showConfirmModal();
        }
    });

    // Xử lý phím ESC cho modal
    // Enter sẽ click nút đang focus (mặc định của browser)
    document.addEventListener('keydown', function (e) {
        const modal = document.getElementById('confirmModal');
        const isModalOpen = modal.classList.contains('show');

        if (isModalOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeConfirmModal();
            }
            // KHÔNG chặn Enter - để browser tự click nút đang focus
            // Khi Tab đến nút "Lưu" và nhấn Enter -> click "Lưu"
            // Khi Tab đến nút "Lưu & In" và nhấn Enter -> click "Lưu & In"
        }
    });

    // Xử lý các nút trong modal
    // Nút "Lưu" - Chỉ lưu vào database, KHÔNG in
    document.getElementById('btnSave').addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔵 [DEBUG] Clicked btnSave - shouldPrint = FALSE');
        handleSubmit(false);
    });

    // Nút "Lưu & In" - Lưu vào database VÀ in biên lai
    document.getElementById('btnSaveAndPrint').addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🟢 [DEBUG] Clicked btnSaveAndPrint - shouldPrint = TRUE');
        handleSubmit(true);
    });

    document.getElementById('btnCancel').addEventListener('click', closeConfirmModal);

    // Đóng modal khi click bên ngoài
    document.getElementById('confirmModal').addEventListener('click', function (e) {
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

    // Tự động focus vào nút "Lưu & In" để user có thể nhấn Enter
    setTimeout(() => {
        document.getElementById('btnSaveAndPrint').focus();
    }, 100);
}

// Đóng modal xác nhận
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

// Xử lý submit form
async function handleSubmit(shouldPrint = false) {
    console.log('📝 [DEBUG] handleSubmit called with shouldPrint =', shouldPrint);

    // ✅ NGĂN CHẶN SUBMIT NHIỀU LẦN LIÊN TỤC
    if (isSubmitting) {
        console.log('⚠️ Đang xử lý đơn hàng, vui lòng đợi...');
        return;
    }

    const station = document.getElementById('station').value;

    // Kiểm tra trạm đã chọn chưa
    if (!station) {
        alert('Vui lòng chọn trạm nhận trước!');
        return;
    }

    // Set flag để ngăn submit tiếp
    isSubmitting = true;

    // Disable các nút submit
    const btnSave = document.getElementById('btnSave');
    const btnSaveAndPrint = document.getElementById('btnSaveAndPrint');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Đang lưu...';
    }
    if (btnSaveAndPrint) {
        btnSaveAndPrint.disabled = true;
        btnSaveAndPrint.textContent = 'Đang lưu...';
    }

    try {
        const currentUser = getCurrentUser();

        const totalAmount = parseInt(document.getElementById('totalAmount').value) || 0;

        // Xác định trạng thái thanh toán
        // 1-99: Chưa thanh toán
        // >= 10000: Đã thanh toán
        const paymentStatus = totalAmount >= 10000 ? 'paid' : 'unpaid';

        const formData = {
            // Không gửi id khi thêm mới - để backend tự động generate
            // Chỉ gửi id khi edit
            ...(editingProductId && { id: editingProductId }),
            senderName: document.getElementById('senderName').value.trim(),
            senderPhone: document.getElementById('senderPhone').value.trim(),
            receiverName: document.getElementById('receiverName').value.trim(),
            receiverPhone: document.getElementById('receiverPhone').value.trim(),
            senderStation: currentUser.station || '', // Trạm gửi hàng (trạm của user hiện tại)
            station: station, // Trạm nhận hàng
            vehicle: document.getElementById('vehicle').value,
            productType: document.getElementById('productType').value.trim(),
            quantity: document.getElementById('quantity').value.trim(),
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
            } else if (result.code === 'EDIT_TIME_EXPIRED') {
                // Hết thời gian sửa giá (1 phút kể từ khi tạo đơn)
                showNotification('Đã quá 1 phút! Không thể sửa giá sau khi tạo đơn. Liên hệ quản trị viên.', 'error');
                closeConfirmModal();
                editingProductId = null;
                return; // Dừng lại, không tiếp tục xử lý
            } else {
                showNotification('Lỗi cập nhật: ' + (result.message || result.error), 'error');
            }
            editingProductId = null;
        } else {
            // Thêm sản phẩm mới
            result = await addProduct(formData);
            if (result.success) {
                showNotification('Thêm hàng hóa thành công!', 'success');
            } else {
                showNotification('Lỗi thêm mới: ' + (result.message || result.error), 'error');
            }
        }

        if (result.success) {
            closeConfirmModal();

            // Lưu thông tin product để in (sử dụng data từ result hoặc formData)
            const productIdFromForm = document.getElementById('productId').value;
            const productToPrint = result.product || {
                id: formData.id || productIdFromForm,
                senderName: formData.senderName,
                senderPhone: formData.senderPhone,
                senderStation: formData.senderStation,
                receiverName: formData.receiverName,
                receiverPhone: formData.receiverPhone,
                station: formData.station,
                productType: formData.productType,
                quantity: formData.quantity,
                vehicle: formData.vehicle,
                totalAmount: formData.totalAmount,
                sendDate: formData.sendDate
            };

            // Reload danh sách products để hiển thị sản phẩm mới
            await loadProducts();
            renderTable();

            // In biên lai nếu người dùng chọn (TRƯỚC KHI reset form)
            console.log('🖨️ [DEBUG] shouldPrint =', shouldPrint, ', productToPrint exists =', !!productToPrint);
            if (shouldPrint && productToPrint) {
                console.log('🖨️ [DEBUG] Calling printReceipt...');
                printReceipt(productToPrint);
            } else {
                console.log('🖨️ [DEBUG] NOT printing - skipped');
            }

            // Reset form và tạo mã mới (SAU KHI in)
            await resetForm();
        }
    } finally {
        // ✅ LUÔN RESET FLAG VÀ ENABLE BUTTONS LẠI (dù success hay error)
        isSubmitting = false;

        const btnSave = document.getElementById('btnSave');
        const btnSaveAndPrint = document.getElementById('btnSaveAndPrint');
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'Lưu';
        }
        if (btnSaveAndPrint) {
            btnSaveAndPrint.disabled = false;
            btnSaveAndPrint.textContent = 'Lưu & In';
        }
    }
}

// In biên lai (không mở cửa sổ mới)
function printReceipt(productData) {
    const currentUser = getCurrentUser();

    // Format ngày giờ theo ảnh mẫu: "10:38 19/09/2025"
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const formattedDateTime = `${hours}:${minutes} ${day}/${month}/${year}`;

    // Trích xuất STT từ senderStation (VD: "01 - An Đông" → "01")
    const senderStationSTT = productData.senderStation ? productData.senderStation.split(' - ')[0] : '';
    const senderStationName = productData.senderStation ? productData.senderStation.split(' - ')[1] || productData.senderStation : '';

    // Trích xuất STT từ station (trạm nhận)
    const stationSTT = productData.station ? productData.station.split(' - ')[0] : '';
    const stationName = productData.station ? productData.station.split(' - ')[1] || productData.station : '';

    // Xác định trạng thái thanh toán
    const paymentStatusText = productData.totalAmount >= 10000 ? '(Đã thanh toán)' : '(Chưa thanh toán)';

    // Tạo div chứa nội dung in
    const printDiv = document.createElement('div');
    printDiv.id = 'print-receipt-container';
    printDiv.innerHTML = `
        <div class="receipt">
            <div class="title">PHIẾU NHẬN HÀNG</div>

            <div class="info-line">
                <span class="label">Mã code:</span> ${productData.id || '-'}
            </div>

            <div class="info-line">
                <span class="label">Trạm nhận:</span> ${stationName.toUpperCase() || '-'}
            </div>

            <div class="info-line">
                <span class="label">Trạm giao:</span> ${senderStationName.toUpperCase() || '-'}
            </div>

            <div class="info-line">
                <span class="label">Người gửi:</span> ${productData.senderName || '-'} ${productData.quantity ? '(' + productData.quantity + ')' : ''}
            </div>

            <div class="info-line">
                <span class="label">Người nhận:</span> ${productData.receiverName || '-'} (${productData.receiverPhone || '-'})
            </div>

            <div class="info-line">
                <span class="label">Loại hàng:</span> ${productData.productType || '-'}
            </div>

            <div class="info-line">
                <span class="label">Thanh toán:</span> ${formatCurrency(productData.totalAmount)}đ ${paymentStatusText}
            </div>

            <div class="info-line">
                <span class="label">Ghi chú:</span>
            </div>

            <div class="divider"></div>

            <div class="footer">
                <div>Công ty TNHH Võ Cúc Phương: ${formattedDateTime} </div>
                <div><strong>Trạm:</strong> ${senderStationName.toUpperCase()}</div>
                <div>18 Nguyễn Du, Phường Xuân An, Long Khánh, Đồng Nai</div>
                <div>97i Nguyễn Duy Dương, P9,Quận 5.HCM</div>
                <div>496B Điện Biên Phú, P25, Quận Bình Thạnh.HCM</div>
                <div>ĐT: 0914 617 466 - 0942 67 0066 - Fax: -</div>
               
            </div>
        </div>
    `;

    // Thêm CSS cho print
    const style = document.createElement('style');
    style.id = 'print-receipt-style';
    style.textContent = `
        #print-receipt-container {
            display: none;
        }

        @media print {
            body * {
                visibility: hidden;
            }

            #print-receipt-container,
            #print-receipt-container * {
                visibility: visible;
            }

            #print-receipt-container {
                position: absolute;
                left: 0;
                top: 0;
                display: block;
                font-family: Arial, sans-serif;
                padding: 20px;
                font-size: 14px;
                line-height: 1.6;
            }

            #print-receipt-container .receipt {
                max-width: 600px;
                margin: 0 auto;
            }

            #print-receipt-container .title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 10px;
            }

            #print-receipt-container .info-line {
                margin: 5px 0;
            }

            #print-receipt-container .label {
                font-weight: bold;
            }

            #print-receipt-container .divider {
                border-top: 1px dotted #999;
                margin: 15px 0;
            }

            #print-receipt-container .footer {
                margin-top: 20px;
                font-size: 12px;
                line-height: 1.8;
            }
        }
    `;

    // Thêm vào body
    document.body.appendChild(printDiv);
    document.head.appendChild(style);

    // In
    window.print();

    // Xóa sau khi in xong
    window.onafterprint = function () {
        const container = document.getElementById('print-receipt-container');
        const styleEl = document.getElementById('print-receipt-style');
        if (container) container.remove();
        if (styleEl) styleEl.remove();
        window.onafterprint = null;
    };
}

// Reset form
async function resetForm() {
    // Lưu lại giá trị trạm hiện tại trước khi reset
    const currentStation = document.getElementById('station').value;

    document.getElementById('productForm').reset();
    editingProductId = null;

    // Nếu có trạm đã chọn, khôi phục và tạo mã mới
    if (currentStation) {
        document.getElementById('station').value = currentStation;
        await generateProductIdForStation(currentStation);
    } else {
        generateProductId();
    }

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

    const productDate = parseLocalDate(dateString);
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
    console.log('Search filters active:', Object.keys(searchFilters).length > 0);

    // Check if user is searching (has any search filters)
    const isSearching = Object.keys(searchFilters).length > 0 &&
        (searchFilters.keyword || searchFilters.dateFrom || searchFilters.dateTo ||
            searchFilters.station || searchFilters.vehicle || searchFilters.productType);

    // Check if user is searching by keyword (to skip station filter)
    const hasKeywordSearch = searchFilters.keyword && searchFilters.keyword.trim() !== '';

    // Filter: Chỉ hiển thị hàng do trạm hiện tại gửi
    let filteredProducts = products.filter(product => {
        // ✅ QUAN TRỌNG: Khi có keyword search, BỎ QUA filter trạm VÀ ngày - tìm tất cả đơn hàng
        if (hasKeywordSearch) {
            console.log('Keyword search mode - skipping station and date filter');
            return true;
        }

        // ✅ Chỉ hiển thị hàng trong ngày hôm nay (áp dụng cho TẤT CẢ user, kể cả admin)
        if (!isSearching) {
            if (!isToday(product.sendDate) && !isToday(product.createdAt)) {
                return false;
            }
        }

        // ✅ Admin có quyền xem TẤT CẢ đơn hàng từ mọi trạm (chỉ trong ngày)
        if (currentUser && currentUser.role === 'admin') {
            return true;
        }

        // Nếu user không có station, hiển thị tất cả trong ngày
        if (!currentUser || !currentUser.station) {
            return true;
        }

        // Chỉ hiển thị hàng có senderStation được set VÀ bằng trạm hiện tại
        if (!product.senderStation) {
            return false;
        }

        // So sánh chính xác senderStation với station của user hiện tại
        return product.senderStation === currentUser.station;
    });

    console.log('Products after station filter:', filteredProducts.length);
    console.log('Is searching mode:', isSearching);
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
                const productDate = parseLocalDate(product.sendDate);
                const fromDate = new Date(searchFilters.dateFrom);
                // Set time to 00:00:00 for start date
                fromDate.setHours(0, 0, 0, 0);
                if (productDate < fromDate) return false;
            }
            if (searchFilters.dateTo) {
                const productDate = parseLocalDate(product.sendDate);
                const toDate = new Date(searchFilters.dateTo);
                // Set time to 23:59:59 for end date
                toDate.setHours(23, 59, 59, 999);
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
                <td data-label="" onclick="event.stopPropagation()"><input type="checkbox" class="row-checkbox" value="${product.id}" onchange="handleRowSelection()"></td>
                <td data-label="STT">${index + 1}</td>
                <td data-label="Mã" class="product-code">${product.id || '-'}</td>
                <td data-label="Người gởi" class="editable" data-field="senderName">${product.senderName || '-'}</td>
                <td data-label="SĐT gởi" class="editable" data-field="senderPhone">${product.senderPhone || '-'}</td>
                <td data-label="Người nhận" class="editable" data-field="receiverName">${product.receiverName || '-'}</td>
                <td data-label="SĐT nhận" class="editable" data-field="receiverPhone">${product.receiverPhone || '-'}</td>
                <td data-label="Trạm nhận" class="editable" data-field="station">${product.station || '-'}</td>
                <td data-label="Ngày gởi">${formattedDate}</td>
                <td data-label="Xe" class="editable" data-field="vehicle">${product.vehicle || '-'}</td>
                <td data-label="Loại hàng" class="editable" data-field="productType">${product.productType || '-'}</td>
                <td data-label="Số lượng" class="editable" data-field="quantity">${product.quantity || '-'}</td>
                <td data-label="Tổng tiền" class="editable" data-field="totalAmount">${formattedAmount}</td>
                <td data-label="Thanh toán">${paymentStatusText}</td>
                <td data-label="Nhân viên">${product.employee || '-'}</td>
                <td data-label="" class="action-cell" onclick="event.stopPropagation()">
                    <button class="btn btn-primary" onclick="printProductReceipt('${product.id}')" style="margin-right: 5px;">In</button>
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
    document.getElementById('quantity').value = product.quantity || '';
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
// ✅ FIX: Bỏ Z suffix để không bị convert timezone
function formatDateTime(dateTimeString) {
    // Bỏ Z suffix và timezone offset để giữ nguyên giờ
    const cleanDateStr = String(dateTimeString).replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '');
    const date = new Date(cleanDateStr);

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

            // KHÔNG auto-save - user phải nhấn Enter hoặc nút Lưu
            select.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveInlineEdit(productId);
                } else if (e.key === 'Escape') {
                    cancelInlineEdit();
                }
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

    // Add edit action buttons (Save/Cancel) to the action cell
    const actionCell = row.querySelector('.action-cell');
    if (actionCell) {
        const originalContent = actionCell.innerHTML;
        actionCell.dataset.originalContent = originalContent;
        actionCell.innerHTML = `
            <button class="btn btn-success btn-sm" onclick="saveInlineEdit('${productId}')" title="Lưu (Enter)">✓ Lưu</button>
            <button class="btn btn-secondary btn-sm" onclick="cancelInlineEdit()" title="Hủy (ESC)">✕ Hủy</button>
        `;
    }

    // Add document click handler to cancel when clicking outside
    setupClickOutsideHandler(row);
}

// Setup click outside handler - HỦY thay vì lưu khi click ra ngoài
function setupClickOutsideHandler(row) {
    // Remove previous handler if exists
    if (window.clickOutsideHandler) {
        document.removeEventListener('click', window.clickOutsideHandler);
    }

    // Create new handler
    window.clickOutsideHandler = function (event) {
        // If clicking outside the editing row
        if (currentEditingRow && !currentEditingRow.contains(event.target)) {
            // Don't cancel if clicking on another data row (it will trigger its own edit)
            const clickedRow = event.target.closest('tr');
            const isDataRow = clickedRow && clickedRow.dataset.id && !clickedRow.classList.contains('form-input-row');

            if (!isDataRow) {
                // HỦY thay đổi khi click ra ngoài
                cancelInlineEdit();
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

    // Tự động cập nhật paymentStatus khi thay đổi totalAmount
    // >= 10000: paid, < 10000: unpaid
    if (updates.totalAmount !== undefined) {
        const newAmount = parseFloat(updates.totalAmount) || 0;
        updates.paymentStatus = newAmount >= 10000 ? 'paid' : 'unpaid';
    }

    try {
        // Update in database
        const result = await updateProduct(productId, updates);

        if (result && result.success) {
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
        } else if (result?.code === 'EDIT_TIME_EXPIRED') {
            // Hết thời gian sửa giá (1 phút kể từ khi tạo đơn)
            showNotification('Đã quá 1 phút! Không thể sửa giá sau khi tạo đơn. Liên hệ quản trị viên.', 'error');
            cancelInlineEdit();
        } else {
            showNotification('Lỗi: ' + (result?.message || result?.error || 'Không xác định'), 'error');
            cancelInlineEdit();
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showNotification('Lỗi khi cập nhật: ' + error.message, 'error');
        cancelInlineEdit();
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
        selectAllCheckbox.addEventListener('change', function () {
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

// In biên lai cho đơn hàng đã tạo
function printProductReceipt(productId) {
    // Tìm product trong danh sách
    const product = products.find(p => p.id === productId);

    if (!product) {
        alert('Không tìm thấy đơn hàng!');
        return;
    }

    // Gọi hàm printReceipt để hiển thị preview và in
    printReceipt(product);
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
window.printProductReceipt = printProductReceipt;
