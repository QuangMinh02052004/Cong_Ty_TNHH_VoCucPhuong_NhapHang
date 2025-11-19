// Authentication Module with Firebase
import {
    getAllUsers,
    getUserByUsername,
    initializeDefaultUsers
} from './firebase-db.js';

// Kiểm tra xem đã đăng nhập chưa khi load trang
document.addEventListener('DOMContentLoaded', async function () {
    // Nếu đang ở trang login và đã đăng nhập, redirect về trang chính
    if (window.location.pathname.includes('login.html')) {
        const currentUser = getCurrentUser();
        if (currentUser) {
            window.location.href = 'index.html';
            return;
        }

        // Khởi tạo default users nếu chưa có
        await initializeDefaultUsers();

        // Setup form login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
    } else {
        // Nếu không phải trang login, check authentication
        checkAuthentication();
    }
});

// Xử lý đăng nhập
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    // Lấy danh sách users từ Firestore
    const users = await getAllUsers();

    // Tìm user khớp
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // Đăng nhập thành công
        if (!user.active) {
            showError('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
            return;
        }

        // Lưu thông tin đăng nhập
        const sessionData = {
            userId: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            loginTime: new Date().toISOString()
        };

        if (rememberMe) {
            localStorage.setItem('currentUser', JSON.stringify(sessionData));
        } else {
            sessionStorage.setItem('currentUser', JSON.stringify(sessionData));
        }

        // Redirect về trang chính
        window.location.href = 'index.html';
    } else {
        showError('Tên đăng nhập hoặc mật khẩu không đúng!');
    }
}

// Hiển thị lỗi
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Lấy thông tin user hiện tại
function getCurrentUser() {
    const sessionUser = sessionStorage.getItem('currentUser');
    const localUser = localStorage.getItem('currentUser');

    if (sessionUser) {
        return JSON.parse(sessionUser);
    } else if (localUser) {
        return JSON.parse(localUser);
    }
    return null;
}

// Kiểm tra authentication
function checkAuthentication() {
    const currentUser = getCurrentUser();

    if (!currentUser) {
        // Chưa đăng nhập, redirect về trang login
        window.location.href = 'login.html';
        return false;
    }

    // Đã đăng nhập, hiển thị thông tin user
    updateUIWithUser(currentUser);
    return true;
}

// Cập nhật UI với thông tin user
function updateUIWithUser(user) {
    const userElement = document.getElementById('currentUser');
    if (userElement) {
        userElement.textContent = user.fullName;
    }

    // Nếu là admin, hiển thị menu quản lý tài khoản
    if (user.role === 'admin') {
        addAdminMenu();
    }
}

// Thêm menu quản lý cho admin
function addAdminMenu() {
    const navbar = document.querySelector('.navbar');
    if (navbar && !document.querySelector('.nav-item-admin')) {
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.className = 'nav-item nav-item-admin';
        adminLink.textContent = 'Quản lý tài khoản';
        navbar.appendChild(adminLink);
    }
}

// Đăng xuất
function logout() {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// Export functions for use in other files
window.getCurrentUser = getCurrentUser;
window.logout = logout;
window.checkAuthentication = checkAuthentication;
