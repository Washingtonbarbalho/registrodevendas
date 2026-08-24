import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { clearIndexedDbPersistence, getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng",
    authDomain: "vendas-aura.firebaseapp.com",
    projectId: "vendas-aura",
    storageBucket: "vendas-aura.firebasestorage.app",
    messagingSenderId: "767983700810",
    appId: "1:767983700810:web:947c8713bd23fb8a078fb3"
};

export const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const LEGACY_OFFLINE_KEY = 'registro-vendas:trusted-device:v75';
const OFFLINE_CLEANUP_KEY = 'registro-vendas:firestore-offline-removed:v76';

try {
    localStorage.removeItem(LEGACY_OFFLINE_KEY);
    if (localStorage.getItem(OFFLINE_CLEANUP_KEY) !== 'done') {
        await clearIndexedDbPersistence(firestore);
        localStorage.setItem(OFFLINE_CLEANUP_KEY, 'done');
    }
} catch (error) {
    console.warn('O cache persistente antigo do Firebase será limpo em uma próxima abertura.', error);
}

export const db = firestore;
export const auth = getAuth(app);

export const APP_ID = 'vendas-aura-main';
export const ADMIN_EMAIL = "washington.wn8@gmail.com";
