// js/db.js

// 1. استدعاء المكتبات (إصدار حديث وموحد 10.7.1 لمنع الأخطاء)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, push, update, remove, child, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 2. إعدادات المشروع الجديد (Tabuk-KPI-restore)
// بدلاً من استيرادها من config.js، نضعها هنا مباشرة
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

// 3. تهيئة الاتصال
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// تصدير المتغيرات الأساسية (عوضاً عن ملف config.js)
export { db, ref, set, update, remove, push, child, get };


// --- دوال التعامل مع البيانات (نفس الدوال التي أرسلتها لي) ---

// استماع للبيانات
export function listenToData(onData, onError) {
    const dbRef = ref(db, 'app_db_v2');
    onValue(dbRef, (snapshot) => {
        const val = snapshot.val();
        onData(val);
    }, onError);
}

export function listenToPasswords(onData) {
    onValue(ref(db, 'app_settings/passwords'), (s) => {
        if (s.exists()) onData(s.val());
    });
}

// عمليات العقود
export function addContract(data) {
    // نستخدم push كما في كودك الأصلي
    return push(ref(db, 'app_db_v2/contracts'), data);
}

export function updateContract(id, data) {
    return update(ref(db, `app_db_v2/contracts/${id}`), data);
}

export function deleteContract(id) {
    return remove(ref(db, `app_db_v2/contracts/${id}`));
}

// عمليات المقاولين
export function addContractor(name) {
    return push(ref(db, 'app_db_v2/contractors'), { name });
}

export function updateContractor(id, name) {
    return update(ref(db, `app_db_v2/contractors/${id}`), { name });
}

export function deleteContractor(id) {
    return remove(ref(db, `app_db_v2/contractors/${id}`));
}

// عمليات النظام
export function updateMonthStatus(contractId, monthIdx, data) {
    // تحديث حالة الشهر (المالية/الخطابات)
    return update(ref(db, `app_db_v2/contracts/${contractId}/months/${monthIdx}`), data);
}

export function updateMonthsList(monthsArray) {
    // تحديث قائمة أسماء الشهور (لزر التحديث)
    return update(ref(db, 'app_db_v2'), { monthNames: monthsArray });
}

export function updateContractMonths(contractId, monthsArray) {
    // تحديث مصفوفة شهور العقد
    return update(ref(db, `app_db_v2/contracts/${contractId}`), { months: monthsArray });
}

export function resetDatabase() {
    return set(ref(db, 'app_db_v2'), { monthNames: [], contractors: {}, contracts: {} });
}

export function savePasswords(passwords) {
    return set(ref(db, 'app_settings/passwords'), passwords);
}
