// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAvwjl9b7fTcYgwzCy2sjpStJk5J-Y9sfE",
    authDomain: "database-kho-vocucphuong.firebaseapp.com",
    projectId: "database-kho-vocucphuong",
    storageBucket: "database-kho-vocucphuong.firebasestorage.app",
    messagingSenderId: "512424260408",
    appId: "1:512424260408:web:cb60ee6decd6f86e8ec7cd",
    measurementId: "G-K86CMK5NV2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Export for use in other files
export { app, db };
