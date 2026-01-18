// API Service - Kết nối với Backend API trên Vercel
// Đã chuyển từ Firebase sang Neon PostgreSQL

// API Base URL - Sử dụng Vercel deployment
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost
    ? 'http://localhost:3000/api/nhap-hang'  // Local dev (Next.js)
    : 'https://vocucphuongmanage.vercel.app/api/nhap-hang';  // Production (Vercel)

// Helper function để lấy token từ sessionStorage/localStorage
function getAuthToken() {
    const sessionUser = sessionStorage.getItem('currentUser');
    const localUser = localStorage.getItem('currentUser');

    const user = sessionUser ? JSON.parse(sessionUser) : (localUser ? JSON.parse(localUser) : null);
    return user?.token;
}

// Helper function để call API
async function callAPI(endpoint, options = {}) {
    const token = getAuthToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        // Nếu 401, redirect về login (token hết hạn)
        if (response.status === 401) {
            console.error('401 - Token invalid or expired');

            // Chỉ redirect nếu không phải login page
            if (!window.location.pathname.includes('login.html')) {
                sessionStorage.removeItem('currentUser');
                localStorage.removeItem('currentUser');
                alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!');
                window.location.href = 'login.html';
            }
            return null;
        }

        const data = await response.json();

        // Nếu 403, trả về data để xử lý (có thể là lỗi hết thời gian sửa, không phải token)
        if (response.status === 403) {
            console.warn('403 - Forbidden:', data.message || data.code);
            return data; // Trả về để caller xử lý
        }

        if (!response.ok) {
            throw new Error(data.message || data.error || 'API call failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ==================== AUTHENTICATION OPERATIONS ====================

export async function login(username, password) {
    try {
        const data = await callAPI('/auth', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (data && data.success) {
            return {
                success: true,
                token: 'session-token', // Simple token for now
                user: data.user
            };
        }

        return { success: false, message: data?.error || 'Đăng nhập thất bại' };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: error.message };
    }
}

export async function getCurrentUserInfo() {
    try {
        const sessionUser = sessionStorage.getItem('currentUser');
        const localUser = localStorage.getItem('currentUser');
        const user = sessionUser ? JSON.parse(sessionUser) : (localUser ? JSON.parse(localUser) : null);
        return user;
    } catch (error) {
        console.error('Get user info error:', error);
        return null;
    }
}

// ==================== PRODUCTS OPERATIONS ====================

// Get all products
export async function getAllProducts() {
    try {
        const data = await callAPI('/products', {
            method: 'GET'
        });

        return data.products || data.data || [];
    } catch (error) {
        console.error('Error getting products:', error);
        return [];
    }
}

// Listen to products (CHỈ LOAD MỘT LẦN - KHÔNG POLLING)
export function listenToProducts(callback) {
    // Chỉ load một lần duy nhất, không poll liên tục
    getAllProducts().then(products => {
        callback(products);
    });

    // Return empty unsubscribe function
    return () => {};
}

// Add a new product
export async function addProduct(productData) {
    try {
        const data = await callAPI('/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });

        if (data && data.success) {
            return {
                success: true,
                id: data.product?.id || data.data?.id,
                product: data.product || data.data
            };
        }

        return { success: false, error: data?.error || data?.message || 'Unknown error' };
    } catch (error) {
        console.error('Error adding product:', error);
        return { success: false, error: error.message };
    }
}

// Update a product
export async function updateProduct(productId, productData) {
    try {
        const result = await callAPI(`/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(productData)
        });

        // Trả về kết quả từ server (bao gồm cả lỗi 403 - hết thời gian sửa giá)
        if (result && result.success === false) {
            return result;
        }

        return { success: true, product: result?.product || result?.data };
    } catch (error) {
        console.error('Error updating product:', error);
        return { success: false, error: error.message };
    }
}

// Delete a product
export async function deleteProduct(productId) {
    try {
        const result = await callAPI(`/products/${productId}`, {
            method: 'DELETE'
        });

        return { success: true };
    } catch (error) {
        console.error('Error deleting product:', error);
        return { success: false, error: error.message };
    }
}

// ==================== USERS OPERATIONS ====================

// Get all users (admin only)
export async function getAllUsers() {
    try {
        const data = await callAPI('/users', {
            method: 'GET'
        });

        return data.users || data.data || [];
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

// Get user by username
export async function getUserByUsername(username) {
    try {
        const users = await getAllUsers();
        return users.find(u => u.username === username);
    } catch (error) {
        console.error('Error getting user by username:', error);
        return null;
    }
}

// Add a new user (admin only)
export async function addUser(userData) {
    try {
        const data = await callAPI('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        return { success: true, id: data.user?.id || data.data?.id };
    } catch (error) {
        console.error('Error adding user:', error);
        return { success: false, error: error.message };
    }
}

// Update a user (admin only)
export async function updateUser(userId, userData) {
    try {
        await callAPI(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating user:', error);
        return { success: false, error: error.message };
    }
}

// Delete a user (admin only)
export async function deleteUser(userId) {
    try {
        await callAPI(`/users/${userId}`, {
            method: 'DELETE'
        });

        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: error.message };
    }
}

// ==================== COUNTERS OPERATIONS ====================

// Get counter for a station on a specific date
export async function getCounter(station, dateKey) {
    try {
        const data = await callAPI(`/counters?station=${encodeURIComponent(station)}&date=${encodeURIComponent(dateKey)}`, {
            method: 'GET'
        });

        return data?.data?.currentValue || 0;
    } catch (error) {
        console.error('Error getting counter:', error);
        return 0;
    }
}

// Increment counter (generate next ID)
export async function incrementCounter(station, dateKey) {
    try {
        const data = await callAPI('/counters', {
            method: 'POST',
            body: JSON.stringify({ station, date: dateKey })
        });

        return data?.data?.value || 1;
    } catch (error) {
        console.error('Error incrementing counter:', error);
        return null;
    }
}

// ==================== STATIONS OPERATIONS ====================

// Get all stations
export async function getAllStations() {
    try {
        const data = await callAPI('/stations', {
            method: 'GET'
        });

        return data.stations || data.data || [];
    } catch (error) {
        console.error('Error getting stations:', error);
        return [];
    }
}

// ==================== INITIALIZATION ====================

// Initialize default users if not exists
export async function initializeDefaultUsers() {
    // Users được tạo tự động khi chạy /api/nhap-hang/setup
    console.log('initializeDefaultUsers: Skipped (users already exist in database)');
    return;
}
