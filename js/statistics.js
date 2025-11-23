// Statistics page - Show ALL products from ALL stations
import { getAllProducts } from './firebase-db.js';
import { populateSelect, OPTIONS } from '../data/options.js';

let allProducts = [];
let searchFilters = {};

// Initialize
document.addEventListener('DOMContentLoaded', async function () {
    // Load all products
    await loadAllProducts();

    // Load search options
    populateSelect('searchStation', OPTIONS.stations);
    populateSelect('searchDestStation', OPTIONS.stations);

    // Render table and statistics
    renderStatisticsTable();
    renderStatistics();

    // Setup event listeners
    document.getElementById('searchForm').addEventListener('submit', handleSearch);
    document.getElementById('resetSearchBtn').addEventListener('click', resetSearch);
});

// Load ALL products from Firestore (no filters)
async function loadAllProducts() {
    allProducts = await getAllProducts();
    console.log('Loaded all products:', allProducts.length);
}

// Handle search form submit
function handleSearch(e) {
    e.preventDefault();

    const keyword = document.getElementById('searchKeyword').value.trim().toLowerCase();
    const dateFrom = document.getElementById('searchDateFrom').value;
    const dateTo = document.getElementById('searchDateTo').value;
    const station = document.getElementById('searchStation').value;
    const destStation = document.getElementById('searchDestStation').value;
    const deliveryStatus = document.getElementById('searchDeliveryStatus').value;

    searchFilters = {
        keyword,
        dateFrom,
        dateTo,
        station,
        destStation,
        deliveryStatus
    };

    renderStatisticsTable();
    renderStatistics();
}

// Reset search filters
function resetSearch() {
    document.getElementById('searchForm').reset();
    searchFilters = {};
    renderStatisticsTable();
    renderStatistics();
}

// Render statistics table - Show ALL products from ALL stations
function renderStatisticsTable() {
    const tbody = document.getElementById('statisticsTableBody');

    console.log('=== STATISTICS DEBUG ===');
    console.log('Total products:', allProducts.length);

    // NO station filter - show all products
    let filteredProducts = allProducts;

    // Apply search filters
    if (searchFilters.keyword) {
        filteredProducts = filteredProducts.filter(product =>
            product.id.toLowerCase().includes(searchFilters.keyword) ||
            (product.senderName || '').toLowerCase().includes(searchFilters.keyword) ||
            (product.senderPhone || '').includes(searchFilters.keyword) ||
            (product.receiverName || '').toLowerCase().includes(searchFilters.keyword) ||
            (product.receiverPhone || '').includes(searchFilters.keyword)
        );
    }

    if (searchFilters.dateFrom) {
        filteredProducts = filteredProducts.filter(product => {
            const productDate = product.sendDate || product.createdAt;
            return productDate >= searchFilters.dateFrom;
        });
    }

    if (searchFilters.dateTo) {
        filteredProducts = filteredProducts.filter(product => {
            const productDate = product.sendDate || product.createdAt;
            return productDate <= searchFilters.dateTo;
        });
    }

    if (searchFilters.station) {
        filteredProducts = filteredProducts.filter(product =>
            (product.senderStation || '') === searchFilters.station
        );
    }

    if (searchFilters.destStation) {
        filteredProducts = filteredProducts.filter(product =>
            (product.station || '') === searchFilters.destStation
        );
    }

    if (searchFilters.deliveryStatus) {
        filteredProducts = filteredProducts.filter(product =>
            (product.deliveryStatus || 'pending') === searchFilters.deliveryStatus
        );
    }

    console.log('Products after filter:', filteredProducts.length);

    // Sort by date (newest first)
    filteredProducts.sort((a, b) => {
        const dateA = new Date(a.sendDate || a.createdAt);
        const dateB = new Date(b.sendDate || b.createdAt);
        return dateB - dateA;
    });

    // Render table rows
    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center;">Không có dữ liệu</td></tr>';
        return;
    }

    tbody.innerHTML = filteredProducts.map((product, index) => {
        const deliveryStatus = product.deliveryStatus || 'pending';
        const deliveryStatusText = deliveryStatus === 'delivered' ? 'Đã giao' : 'Chưa giao';
        const deliveryStatusClass = deliveryStatus === 'delivered' ? 'status-delivered' : 'status-pending';

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${product.id || ''}</td>
                <td>${product.senderName || ''}</td>
                <td>${product.senderPhone || ''}</td>
                <td>${product.receiverName || ''}</td>
                <td>${product.receiverPhone || ''}</td>
                <td>${formatStationName(product.senderStation || '')}</td>
                <td>${formatStationName(product.station || '')}</td>
                <td>${product.productType || ''}</td>
                <td>${formatCurrency(product.totalAmount || 0)}</td>
                <td><span class="delivery-status ${deliveryStatusClass}">${deliveryStatusText}</span></td>
                <td>${formatDateTime(product.sendDate || product.createdAt)}</td>
            </tr>
        `;
    }).join('');
}

// Format station name (remove number prefix)
function formatStationName(station) {
    if (!station) return '';
    return station.includes(' - ') ? station.split(' - ')[1] : station;
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

// Format date time
function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
}

// Render statistics summary
function renderStatistics() {
    const statsElement = document.getElementById('statistics');

    // Apply same filters as table
    let filteredProducts = allProducts;

    if (searchFilters.keyword) {
        filteredProducts = filteredProducts.filter(product =>
            product.id.toLowerCase().includes(searchFilters.keyword) ||
            (product.senderName || '').toLowerCase().includes(searchFilters.keyword) ||
            (product.senderPhone || '').includes(searchFilters.keyword) ||
            (product.receiverName || '').toLowerCase().includes(searchFilters.keyword) ||
            (product.receiverPhone || '').includes(searchFilters.keyword)
        );
    }

    if (searchFilters.dateFrom) {
        filteredProducts = filteredProducts.filter(product => {
            const productDate = product.sendDate || product.createdAt;
            return productDate >= searchFilters.dateFrom;
        });
    }

    if (searchFilters.dateTo) {
        filteredProducts = filteredProducts.filter(product => {
            const productDate = product.sendDate || product.createdAt;
            return productDate <= searchFilters.dateTo;
        });
    }

    if (searchFilters.station) {
        filteredProducts = filteredProducts.filter(product =>
            (product.senderStation || '') === searchFilters.station
        );
    }

    if (searchFilters.destStation) {
        filteredProducts = filteredProducts.filter(product =>
            (product.station || '') === searchFilters.destStation
        );
    }

    if (searchFilters.deliveryStatus) {
        filteredProducts = filteredProducts.filter(product =>
            (product.deliveryStatus || 'pending') === searchFilters.deliveryStatus
        );
    }

    const totalShipments = filteredProducts.length;
    const deliveredProducts = filteredProducts.filter(p => p.deliveryStatus === 'delivered');
    const pendingProducts = filteredProducts.filter(p => !p.deliveryStatus || p.deliveryStatus === 'pending');

    const totalAmount = filteredProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const deliveredAmount = deliveredProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const pendingAmount = pendingProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    statsElement.innerHTML = `
        <div class="stats-summary">
            <div class="stats-header">Thống kê tổng hợp</div>
            <div class="stats-line">
                <span class="stats-label">Tổng số lượng hàng:</span>
                <span class="stats-value">${totalShipments} lượt</span>
            </div>
            <div class="stats-line">
                <span class="stats-label">Đã giao:</span>
                <span class="stats-value" style="color: #10B981;">${deliveredProducts.length} lượt</span>
            </div>
            <div class="stats-line">
                <span class="stats-label">Chưa giao:</span>
                <span class="stats-value" style="color: #F59E0B;">${pendingProducts.length} lượt</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-line">
                <span class="stats-label">Tổng tiền:</span>
                <span class="stats-value">${formatCurrency(totalAmount)} VNĐ</span>
            </div>
            <div class="stats-line">
                <span class="stats-label">Tiền hàng đã giao:</span>
                <span class="stats-value" style="color: #10B981;">${formatCurrency(deliveredAmount)} VNĐ</span>
            </div>
            <div class="stats-line">
                <span class="stats-label">Tiền hàng chưa giao:</span>
                <span class="stats-value" style="color: #F59E0B;">${formatCurrency(pendingAmount)} VNĐ</span>
            </div>
        </div>
    `;
}
