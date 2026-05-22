// Imports
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_APPID, PUBLIC_FIREBASE_AUTHDOMAIN, PUBLIC_FIREBASE_MESSAGINGSENDERID, PUBLIC_FIREBASE_PROJECTID, PUBLIC_FIREBASE_STORAGEBUCKET, } from "$env/static/public";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: PUBLIC_FIREBASE_API_KEY,
    authDomain: PUBLIC_FIREBASE_AUTHDOMAIN,
    projectId: PUBLIC_FIREBASE_PROJECTID,
    storageBucket: PUBLIC_FIREBASE_STORAGEBUCKET,
    messagingSenderId: PUBLIC_FIREBASE_MESSAGINGSENDERID,
    appId: PUBLIC_FIREBASE_APPID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services and export them so other files can import them
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();