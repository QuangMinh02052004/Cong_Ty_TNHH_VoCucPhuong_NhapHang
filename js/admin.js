// Admin Module - Quản lý tài khoản nhân viên với Firebase
import {
    getAllUsers,
    addUser,
    updateUser,
    deleteUser as deleteUserFromDB
} from './firebase-db.js';

import { OPTIONS } from '../data/options.js';

let editingUserId = null;
let users = [];

// Khởi tạo
document.addEventListener('DOMContentLoaded', async function () {
    // Kiểm tra quyền admin
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Bạn không có quyền truy cập trang này!');
        window.location.href = 'index.html';
        return;
    }

    // Load users từ Firestore
    await loadUsers();

    // Render bảng users
    renderUsersTable();

    // Setup form
    document.getElementById('userForm').addEventListener('submit', handleSaveUser);
});

// Load users từ Firestore
async function loadUsers() {
    users = await getAllUsers();
}

// Render bảng users
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 30px; color: #9ca3af;">
                    Chưa có tài khoản nào.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map((user, index) => {
        const createdDate = new Date(user.createdAt).toLocaleDateString('vi-VN');
        const statusBadge = user.active
            ? '<span class="status-badge status-active">Hoạt động</span>'
            : '<span class="status-badge status-inactive">Vô hiệu</span>';
        const roleBadge = user.role === 'admin'
            ? '<span class="role-badge role-admin">Quản trị</span>'
            : '<span class="role-badge role-employee">Nhân viên</span>';

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${user.username}</td>
                <td>${user.fullName}</td>
                <td>${roleBadge}</td>
                <td>${user.station || '-'}</td>
                <td>${statusBadge}</td>
                <td>${createdDate}</td>
                <td class="action-cell">
                    <button class="btn btn-edit" onclick="editUserHandler('${user.id}')">Sửa</button>
                    ${user.username !== 'admin' ? `<button class="btn btn-danger" onclick="deleteUserHandler('${user.id}')">Xóa</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// Populate station dropdown
function populateStationDropdown() {
    const select = document.getElementById('modalStation');
    if (!select) return;

    // Keep the first placeholder option
    const placeholder = select.querySelector('option[value=""]');

    // Clear existing options
    select.innerHTML = '';
    if (placeholder) {
        select.appendChild(placeholder);
    }

    // Add station options from OPTIONS
    OPTIONS.stations.forEach(station => {
        const optionElement = document.createElement('option');
        optionElement.value = station;
        optionElement.textContent = station;
        select.appendChild(optionElement);
    });
}

// Show modal thêm user
function showAddUserModal() {
    editingUserId = null;
    document.getElementById('modalTitle').textContent = 'Thêm tài khoản mới';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('modalPassword').required = true;
    document.getElementById('modalActive').checked = true;
    document.getElementById('modalUsername').disabled = false;
    document.getElementById('modalRole').disabled = false;
    populateStationDropdown();
    document.getElementById('userModal').classList.add('show');
}

// Show modal sửa user
async function editUserHandler(userId) {
    const user = users.find(u => u.id === userId);

    if (!user) return;

    editingUserId = userId;
    document.getElementById('modalTitle').textContent = 'Chỉnh sửa tài khoản';
    document.getElementById('userId').value = user.id;
    document.getElementById('modalUsername').value = user.username;
    document.getElementById('modalPassword').value = user.password;
    document.getElementById('modalPassword').required = false;
    document.getElementById('modalFullName').value = user.fullName;
    document.getElementById('modalRole').value = user.role;
    document.getElementById('modalActive').checked = user.active;

    // Populate station dropdown first, then set value
    populateStationDropdown();
    document.getElementById('modalStation').value = user.station || '';

    // Disable username nếu là admin
    if (user.username === 'admin') {
        document.getElementById('modalUsername').disabled = true;
        document.getElementById('modalRole').disabled = true;
    } else {
        document.getElementById('modalUsername').disabled = false;
        document.getElementById('modalRole').disabled = false;
    }

    document.getElementById('userModal').classList.add('show');
}

// Đóng modal
function closeUserModal() {
    document.getElementById('userModal').classList.remove('show');
    editingUserId = null;
}

// Xử lý lưu user (thêm hoặc sửa)
async function handleSaveUser(e) {
    e.preventDefault();

    const username = document.getElementById('modalUsername').value.trim();
    const password = document.getElementById('modalPassword').value;
    const fullName = document.getElementById('modalFullName').value.trim();
    const role = document.getElementById('modalRole').value;
    const active = document.getElementById('modalActive').checked;
    const station = document.getElementById('modalStation').value;

    // Kiểm tra username đã tồn tại chưa (khi thêm mới hoặc sửa username)
    const existingUser = users.find(u => u.username === username && u.id !== editingUserId);
    if (existingUser) {
        alert('Tên đăng nhập đã tồn tại!');
        return;
    }

    let result;

    if (editingUserId) {
        // Cập nhật user
        const userData = {
            username,
            fullName,
            role,
            active,
            station
        };

        // Chỉ cập nhật password nếu có nhập mới
        if (password) {
            userData.password = password;
        } else {
            // Giữ nguyên password cũ
            const oldUser = users.find(u => u.id === editingUserId);
            userData.password = oldUser.password;
        }

        result = await updateUser(editingUserId, userData);

        if (result.success) {
            showNotification('Cập nhật tài khoản thành công!', 'success');
        } else {
            showNotification('Lỗi cập nhật: ' + result.error, 'error');
            return;
        }
    } else {
        // Thêm user mới
        const newUserId = generateUserId();
        const userData = {
            id: newUserId,
            username,
            password,
            fullName,
            role,
            active,
            station,
            createdAt: new Date().toISOString()
        };

        result = await addUser(userData);

        if (result.success) {
            showNotification('Thêm tài khoản thành công!', 'success');
        } else {
            showNotification('Lỗi thêm mới: ' + result.error, 'error');
            return;
        }
    }

    // Reload users và render lại
    await loadUsers();
    renderUsersTable();
    closeUserModal();
}

// Xóa user
async function deleteUserHandler(userId) {
    const user = users.find(u => u.id === userId);

    if (!user) return;

    if (user.username === 'admin') {
        alert('Không thể xóa tài khoản admin!');
        return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${user.fullName}"?`)) {
        const result = await deleteUserFromDB(userId);

        if (result.success) {
            showNotification('Xóa tài khoản thành công!', 'success');
            await loadUsers();
            renderUsersTable();
        } else {
            showNotification('Lỗi xóa: ' + result.error, 'error');
        }
    }
}

// Sinh ID mới cho user
function generateUserId() {
    return Date.now().toString();
}

// Hiển thị thông báo
function showNotification(message, type = 'success') {
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

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Export functions to global scope
window.showAddUserModal = showAddUserModal;
window.editUserHandler = editUserHandler;
window.deleteUserHandler = deleteUserHandler;
window.closeUserModal = closeUserModal;
