// js/app.js
import * as DB from './db.js';
import * as UI from './ui.js';

let appData = { contracts: {}, contractors: {}, monthNames: [] };
window.userRole = null;
window.selectedYear = new Date().getFullYear();

// --- Login ---
window.adminLogin = async function() {
    const pw = document.getElementById('adminPassword').value;
    if (pw === 'admin123') window.userRole = 'admin';
    else if (pw === 'super123') window.userRole = 'super';
    else { Swal.fire('خطأ', 'كلمة المرور غير صحيحة', 'error'); return; }

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    if (window.userRole !== 'super') {
        document.querySelectorAll('.super-admin-only').forEach(el => el.style.display = 'none');
    }

    await loadData();
    refreshView();
    // ✅ تشغيل فحص النسخ الاحتياطي التلقائي
    checkAutoBackup();
};

window.logout = function() { location.reload(); };

async function loadData() {
    const data = await DB.getData('app_db_v2');
    if (data) {
        appData = data;
        if (!appData.contracts) appData.contracts = {};
        if (!appData.contractors) appData.contractors = {};
        if (!appData.monthNames) appData.monthNames = [];
    }
}

window.refreshView = function() {
    const filteredRows = UI.renderTable(appData, window.userRole, canEdit, window.selectedYear);
    UI.updateStats(filteredRows, appData, window.selectedYear);
    UI.renderYearTabs(appData.contracts, window.selectedYear);
    // ✅ تشغيل التنبيهات مع كل تحديث
    UI.checkNotifications(appData.contracts);
};

window.selectYear = function(year) {
    window.selectedYear = year;
    refreshView();
};

function canEdit(role, type) {
    if (role === 'super') return true;
    if (role === 'admin' && type === 'طبي') return true;
    return false;
}

// --- ✅ تعديل النافذة المنبثقة لإضافة حقل الرابط ---
window.handleKpiCell = async function(contractId, monthIndex) {
    const row = appData.contracts[contractId];
    const currentData = (row.months && row.months[monthIndex]) ? row.months[monthIndex] : {};
    
    // HTML للفورم داخل الـ Popup
    const htmlForm = `
        <select id="swalStatus" class="swal2-input">
            <option value="late" ${currentData.financeStatus==='late'?'selected':''}>متأخر ❌</option>
            <option value="sent" ${currentData.financeStatus==='sent'?'selected':''}>تم الرفع ✅</option>
            <option value="returned" ${currentData.financeStatus==='returned'?'selected':''}>إعادة ⚠️</option>
        </select>
        <input id="swalClaim" class="swal2-input" placeholder="رقم المطالبة" value="${currentData.claimNum||''}">
        <input id="swalLetter" class="swal2-input" placeholder="رقم الخطاب" value="${currentData.letterNum||''}">
        <textarea id="swalReturn" class="swal2-textarea" placeholder="سبب الإعادة">${currentData.returnNotes||''}</textarea>
        <input id="swalLink" class="swal2-input" placeholder="رابط المستند (Drive/SharePoint)" value="${currentData.docLink||''}">
    `;

    const { value: formValues } = await Swal.fire({
        title: 'تحديث الحالة',
        html: htmlForm,
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            return {
                financeStatus: document.getElementById('swalStatus').value,
                claimNum: document.getElementById('swalClaim').value,
                letterNum: document.getElementById('swalLetter').value,
                returnNotes: document.getElementById('swalReturn').value,
                docLink: document.getElementById('swalLink').value // قراءة الرابط
            }
        }
    });

    if (formValues) {
        if (!row.months) row.months = [];
        row.months[monthIndex] = formValues;
        await DB.saveData(`app_db_v2/contracts/${contractId}/months`, row.months);
        row.months[monthIndex] = formValues; // تحديث محلي
        refreshView();
        UI.showToast("تم التحديث ✅");
    }
};

window.editNote = async function(id) {
    const row = appData.contracts[id];
    const { value: note } = await Swal.fire({
        title: 'ملاحظات العقد',
        input: 'textarea',
        inputValue: row.notes || '',
        showCancelButton: true,
        confirmButtonText: 'حفظ'
    });
    if (note !== undefined) {
        await DB.updateData(`app_db_v2/contracts/${id}`, { notes: note });
        row.notes = note;
        refreshView();
    }
};

// --- وظائف النسخ الاحتياطي (جديد) ---

// 1. النسخ اليدوي (زر)
window.downloadBackup = async function(isAuto = false) {
    if (window.userRole !== 'super') return;

    if (!isAuto) UI.showToast("جاري تحضير النسخة...");

    try {
        const snapshot = await DB.getAllData();
        const data = snapshot.val();
        if (!data) return;

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const d = new Date();
        const prefix = isAuto ? "AutoBackup" : "ManualBackup";
        const fileName = `${prefix}_KPI_${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (!isAuto) UI.showToast("تم التحميل بنجاح ✅");
        
        if (isAuto) {
            localStorage.setItem('last_auto_backup', new Date().toDateString());
            console.log("Auto Backup Done");
        }

    } catch (error) {
        console.error("Backup Error:", error);
    }
};

// 2. الفحص التلقائي (يعمل عند الدخول)
function checkAutoBackup() {
    if (window.userRole !== 'super') return;
    const todayStr = new Date().toDateString();
    const lastBackup = localStorage.getItem('last_auto_backup');

    if (lastBackup !== todayStr) {
        setTimeout(() => {
            UI.showToast("جاري النسخ الاحتياطي التلقائي...");
            window.downloadBackup(true);
        }, 3000);
    }
}

// --- Tabs & Other Actions (موجودة سابقاً) ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');
    if (tabName === 'contract') window.renderCards('contract');
    if (tabName === 'contractors') window.renderCards('contractor');
};

window.renderCards = function(type) { UI.renderCards(appData, type); };
window.exportToExcel = function() { UI.exportToExcel(); };

// --- CRUD (Contract & Contractor) ---
// (هذه الدوال كما هي لم تتغير، فقط تأكد من وجودها)
window.prepareAddContract = async function() { /* ... كود الإضافة ... */ };
window.prepareEditContract = async function(id) { /* ... كود التعديل ... */ };
window.deleteContract = async function(id) { /* ... كود الحذف ... */ };
// ... وهكذا لباقي دوال الإدارة
