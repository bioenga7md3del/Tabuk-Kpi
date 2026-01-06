// js/config.js
// تحديث المكتبات للإصدار 10.7.1 لتتوافق مع باقي ملفاتك
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAyq5cYOWnLp1VuYKRZ_EDl03BYroaVBVI",
    authDomain: "tabuk-kpi-restore.firebaseapp.com",
    databaseURL: "https://tabuk-kpi-restore-default-rtdb.firebaseio.com",
    projectId: "tabuk-kpi-restore",
    storageBucket: "tabuk-kpi-restore.firebasestorage.app",
    messagingSenderId: "451669399138",
    appId: "1:451669399138:web:ce2567c7c02024d7ffa33b",
    measurementId: "G-R636S5F3DV"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
