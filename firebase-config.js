import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
    clearIndexedDbPersistence,
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    terminate
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
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
export const OFFLINE_TRUST_KEY = 'registro-vendas:trusted-device:v75';
const offlinePersistenceRequested = (() => {
    try { return localStorage.getItem(OFFLINE_TRUST_KEY) === 'yes'; }
    catch (_) { return false; }
})();
let offlinePersistenceActive = false;

export const db = (() => {
    if (!offlinePersistenceRequested) return getFirestore(app);
    try {
        const firestore = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });
        offlinePersistenceActive = true;
        return firestore;
    } catch (error) {
        console.warn('Persistência offline indisponível; usando cache temporário nesta sessão.', error);
        return getFirestore(app);
    }
})();
export const auth = getAuth(app);

export const isOfflineDataEnabled = () => offlinePersistenceActive;
export const isOfflineDataRequested = () => offlinePersistenceRequested;
export const enableOfflineData = () => {
    localStorage.setItem(OFFLINE_TRUST_KEY, 'yes');
    location.reload();
};
export const disableOfflineData = async () => {
    await terminate(db);
    try {
        await clearIndexedDbPersistence(db);
    } finally {
        localStorage.removeItem(OFFLINE_TRUST_KEY);
        location.reload();
    }
};

export const APP_ID = 'vendas-aura-main';
export const ADMIN_EMAIL = "washington.wn8@gmail.com";
