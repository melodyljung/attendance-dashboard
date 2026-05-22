// Imports
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBIFPg8JocImYtoRe-84a-nrbUaaKiQNcM",
    authDomain: "student-attendance-170806.firebaseapp.com",
    projectId: "student-attendance-170806",
    storageBucket: "student-attendance-170806.firebasestorage.app",
    messagingSenderId: "867670859335",
    appId: "1:867670859335:web:793fd7fcf88ef82d2a5b62"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services and export them so other files can import them
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();