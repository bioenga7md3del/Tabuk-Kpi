// js/db.js

// 1. استدعاء المكتبات
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, update, remove, child } 
    from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// 2. إعدادات مشروعك (كما هي من ملفك)
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
const dbRef = ref(db);

// --- الدوال العامة الجديدة (التي يبحث عنها app.js) ---

// 1. جلب البيانات (يحل مشكلة getData error)
export async function getData(path) {
    try {
        const snapshot = await get(child(dbRef, path));
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            console.warn("لا توجد بيانات في المسار:", path);
            return null;
        }
    } catch (error) {
        console.error("خطأ في جلب البيانات:", error);
        return null;
    }
}

// 2. حفظ بيانات جديدة (يحل محل set)
export async function saveData(path, data) {
    try {
        await set(ref(db, path), data);
    } catch (error) {
        console.error("خطأ في الحفظ:", error);
        throw error;
    }
}

// 3. تحديث بيانات (يحل محل updateContract وغيرها)
export async function updateData(path, updates) {
    try {
        await update(ref(db, path), updates);
    } catch (error) {
        console.error("خطأ في التحديث:", error);
        throw error;
    }
}

// 4. حذف بيانات
export async function deleteData(path) {
    try {
        await remove(ref(db, path));
    } catch (error) {
        console.error("خطأ في الحذف:", error);
        throw error;
    }
}

// 5. دالة النسخ الاحتياطي (التي طلبناها)
export function getAllData() {
    return get(ref(db, 'app_db_v2'));
}
// js/db.js
// ... (نفس الكود السابق للمكتبات والإعدادات والدوال العامة) ...

// (أضف هذا في نهاية الملف)

// 6. دوال إدارة كلمات المرور
export async function getPasswords() {
    try {
        const snapshot = await get(child(ref(db), 'app_settings/passwords'));
        if (snapshot.exists()) return snapshot.val();
        // كلمات المرور الافتراضية في حال عدم وجودها في القاعدة
        return { super: 'super123', admin: 'admin123' };
    } catch (error) {
        console.error("خطأ في جلب كلمات المرور", error);
        return { super: 'super123', admin: 'admin123' };
    }
}

export async function savePasswords(passwords) {
    return set(ref(db, 'app_settings/passwords'), passwords);
}
