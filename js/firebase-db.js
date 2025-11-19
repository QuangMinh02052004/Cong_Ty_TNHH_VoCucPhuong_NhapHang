// Firebase Database Operations
import { db } from './firebase-config.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==================== PRODUCTS OPERATIONS ====================

// Get all products (real-time listener)
export function listenToProducts(callback) {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('sendDate', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const products = [];
        snapshot.forEach((doc) => {
            products.push({ ...doc.data(), id: doc.id });
        });
        callback(products);
    }, (error) => {
        console.error("Error listening to products:", error);
        callback([]);
    });
}

// Get all products (one-time fetch)
export async function getAllProducts() {
    try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, orderBy('sendDate', 'desc'));
        const snapshot = await getDocs(q);

        const products = [];
        snapshot.forEach((doc) => {
            products.push({ ...doc.data(), id: doc.id });
        });

        return products;
    } catch (error) {
        console.error("Error getting products:", error);
        return [];
    }
}

// Add a new product
export async function addProduct(productData) {
    try {
        const productRef = doc(db, 'products', productData.id);
        await setDoc(productRef, productData);
        return { success: true, id: productData.id };
    } catch (error) {
        console.error("Error adding product:", error);
        return { success: false, error: error.message };
    }
}

// Update a product
export async function updateProduct(productId, productData) {
    try {
        const productRef = doc(db, 'products', productId);
        await updateDoc(productRef, productData);
        return { success: true };
    } catch (error) {
        console.error("Error updating product:", error);
        return { success: false, error: error.message };
    }
}

// Delete a product
export async function deleteProduct(productId) {
    try {
        const productRef = doc(db, 'products', productId);
        await deleteDoc(productRef);
        return { success: true };
    } catch (error) {
        console.error("Error deleting product:", error);
        return { success: false, error: error.message };
    }
}

// ==================== USERS OPERATIONS ====================

// Get all users
export async function getAllUsers() {
    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        const users = [];
        snapshot.forEach((doc) => {
            users.push({ ...doc.data(), id: doc.id });
        });

        return users;
    } catch (error) {
        console.error("Error getting users:", error);
        return [];
    }
}

// Get user by username
export async function getUserByUsername(username) {
    try {
        const users = await getAllUsers();
        return users.find(u => u.username === username);
    } catch (error) {
        console.error("Error getting user by username:", error);
        return null;
    }
}

// Add a new user
export async function addUser(userData) {
    try {
        const userRef = doc(db, 'users', userData.id);
        await setDoc(userRef, userData);
        return { success: true, id: userData.id };
    } catch (error) {
        console.error("Error adding user:", error);
        return { success: false, error: error.message };
    }
}

// Update a user
export async function updateUser(userId, userData) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, userData);
        return { success: true };
    } catch (error) {
        console.error("Error updating user:", error);
        return { success: false, error: error.message };
    }
}

// Delete a user
export async function deleteUser(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);
        return { success: true };
    } catch (error) {
        console.error("Error deleting user:", error);
        return { success: false, error: error.message };
    }
}

// ==================== COUNTERS OPERATIONS ====================

// Get counter for a station on a specific date
export async function getCounter(station, dateKey) {
    try {
        const counterKey = `counter_${station}_${dateKey}`;
        const counterRef = doc(db, 'counters', counterKey);
        const counterDoc = await getDoc(counterRef);

        if (counterDoc.exists()) {
            return counterDoc.data().value || 0;
        }
        return 0;
    } catch (error) {
        console.error("Error getting counter:", error);
        return 0;
    }
}

// Increment counter (atomic operation)
export async function incrementCounter(station, dateKey) {
    try {
        const counterKey = `counter_${station}_${dateKey}`;
        const counterRef = doc(db, 'counters', counterKey);

        const newValue = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let currentValue = 0;
            if (counterDoc.exists()) {
                currentValue = counterDoc.data().value || 0;
            }

            const newValue = currentValue + 1;
            transaction.set(counterRef, {
                value: newValue,
                station: station,
                date: dateKey,
                lastUpdated: new Date().toISOString()
            });

            return newValue;
        });

        return newValue;
    } catch (error) {
        console.error("Error incrementing counter:", error);
        return null;
    }
}

// ==================== INITIALIZATION ====================

// Initialize default users if not exists
export async function initializeDefaultUsers() {
    try {
        const users = await getAllUsers();

        if (users.length === 0) {
            // Create default admin
            await addUser({
                id: '1',
                username: 'admin',
                password: 'admin123',
                fullName: 'Quản trị viên',
                role: 'admin',
                station: '01 - AN ĐỒNG', // Trạm mặc định cho admin
                active: true,
                createdAt: new Date().toISOString()
            });

            // Create default employee
            await addUser({
                id: '2',
                username: 'lethanhtam',
                password: '123456',
                fullName: 'Lê Thanh Tâm',
                role: 'employee',
                station: '01 - AN ĐỒNG', // Trạm mặc định
                active: true,
                createdAt: new Date().toISOString()
            });

            console.log("Default users created successfully");
        }
    } catch (error) {
        console.error("Error initializing default users:", error);
    }
}

// ==================== MIGRATION HELPERS ====================

// Migrate data from localStorage to Firestore
export async function migrateFromLocalStorage() {
    try {
        // Migrate products
        const productsStr = localStorage.getItem('products');
        if (productsStr) {
            const products = JSON.parse(productsStr);
            for (const product of products) {
                await addProduct(product);
            }
            console.log(`Migrated ${products.length} products`);
        }

        // Migrate users
        const usersStr = localStorage.getItem('users');
        if (usersStr) {
            const users = JSON.parse(usersStr);
            for (const user of users) {
                await addUser(user);
            }
            console.log(`Migrated ${users.length} users`);
        }

        console.log("Migration completed successfully!");
        return { success: true };
    } catch (error) {
        console.error("Error during migration:", error);
        return { success: false, error: error.message };
    }
}
