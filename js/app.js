// js/app.js
import * as DB from './db.js';
import * as UI from './ui.js';

let appData = { contracts: {}, contractors: {}, monthNames: [] };
window.userRole = null; // 'admin' or 'super'
window.selectedYear = new Date().getFullYear();

// --- 1. Login Logic ---
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
    checkAutoBackup();
};

window.logout = function() { location.reload(); };

// --- 2. Data Loading ---
async function loadData() {
    const data = await DB.getData('app_db_v2');
    if (data) {
        appData = data;
        // ضمان وجود الهياكل الأساسية
        if (!appData.contracts) appData.contracts = {};
        if (!appData.contractors) appData.contractors = {};
        if (!appData.monthNames) appData.monthNames = [];
    } else {
        // إذا كانت قاعدة البيانات فارغة تماماً
        appData = { contracts: {}, contractors: {}, monthNames: [] };
    }
}

window.refreshView = function() {
    // تحديث الجدول
    const filteredRows = UI.renderTable(appData, window.userRole, canEdit, window.selectedYear);
    UI.updateStats(filteredRows, appData, window.selectedYear);
    UI.renderYearTabs(appData.contracts, window.selectedYear);
    
    // تحديث الكروت إذا كنا في تاب العقود أو المقاولين
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'tab-contracts') window.renderCards('contract');
    if (activeTab && activeTab.id === 'tab-contractors') window.renderCards('contractor');

    // تشغيل التنبيهات
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

// --- 3. تحسين نافذة تحديث حالة الشهر (Popup) ---
window.handleKpiCell = async function(contractId, monthIndex) {
    const row = appData.contracts[contractId];
    const currentData = (row.months && row.months[monthIndex]) ? row.months[monthIndex] : {};
    
    // تصميم جديد للنافذة (Grid Layout)
    const htmlForm = `
        <div class="popup-form-container">
            <div>
                <label class="popup-label">الحالة</label>
                <select id="swalStatus" class="swal2-select">
                    <option value="late" ${currentData.financeStatus==='late'?'selected':''}>متأخر ❌</option>
                    <option value="sent" ${currentData.financeStatus==='sent'?'selected':''}>تم الرفع ✅</option>
                    <option value="returned" ${currentData.financeStatus==='returned'?'selected':''}>إعادة ⚠️</option>
                </select>
            </div>
            
            <div>
                <label class="popup-label">رقم المطالبة</label>
                <input id="swalClaim" class="swal2-input" placeholder="مثال: 1025" value="${currentData.claimNum||''}">
            </div>

            <div>
                <label class="popup-label">رقم الخطاب</label>
                <input id="swalLetter" class="swal2-input" placeholder="مثال: 550" value="${currentData.letterNum||''}">
            </div>

            <div>
                <label class="popup-label">رابط المستند (Drive)</label>
                <input id="swalLink" class="swal2-input" placeholder="https://..." value="${currentData.docLink||''}">
            </div>

            <div class="popup-full-width">
                <label class="popup-label">ملاحظات / سبب الإعادة</label>
                <textarea id="swalReturn" class="swal2-textarea" placeholder="اكتب الملاحظات هنا..." style="height: 80px;">${currentData.returnNotes||''}</textarea>
            </div>
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        title: `تحديث: ${row.contractName || row.hospital}`,
        html: htmlForm,
        width: '600px', // تعريض النافذة قليلاً
        showCancelButton: true,
        confirmButtonText: 'حفظ التغييرات',
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
            return {
                financeStatus: document.getElementById('swalStatus').value,
                claimNum: document.getElementById('swalClaim').value,
                letterNum: document.getElementById('swalLetter').value,
                returnNotes: document.getElementById('swalReturn').value,
                docLink: document.getElementById('swalLink').value
            }
        }
    });

    if (formValues) {
        if (!row.months) row.months = [];
        row.months[monthIndex] = formValues;
        
        // حفظ في الفيربيز
        await DB.saveData(`app_db_v2/contracts/${contractId}/months`, row.months);
        
        // تحديث الواجهة
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

// --- 4. إدارة العقود (تم استعادتها بالكامل) ---

window.prepareAddContract = async function() {
    // تحضير قائمة المقاولين
    let contractorOptions = '';
    Object.entries(appData.contractors).forEach(([id, c]) => {
        contractorOptions += `<option value="${id}">${c.name}</option>`;
    });

    if (contractorOptions === '') {
        Swal.fire('تنبيه', 'يرجى إضافة مقاولين أولاً من تبويب المقاولين', 'warning');
        return;
    }

    const htmlForm = `
        <div class="popup-form-container">
            <div class="popup-full-width">
                <label class="popup-label">اسم العقد / المستشفى</label>
                <input id="cName" class="swal2-input" placeholder="اسم العقد">
            </div>
            
            <div>
                <label class="popup-label">رقم العقد</label>
                <input id="cNum" class="swal2-input" placeholder="مثال: 4402">
            </div>

            <div>
                <label class="popup-label">القيمة (ريال)</label>
                <input id="cVal" type="number" class="swal2-input" placeholder="0.00">
            </div>

            <div>
                <label class="popup-label">تاريخ البداية</label>
                <input id="cStart" type="date" class="swal2-input">
            </div>

            <div>
                <label class="popup-label">تاريخ النهاية</label>
                <input id="cEnd" type="date" class="swal2-input">
            </div>

            <div>
                <label class="popup-label">النوع</label>
                <select id="cType" class="swal2-select">
                    <option value="طبي">طبي</option>
                    <option value="غير طبي">غير طبي</option>
                </select>
            </div>

            <div>
                <label class="popup-label">المقاول</label>
                <select id="cCont" class="swal2-select">${contractorOptions}</select>
            </div>
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        title: 'إضافة عقد جديد',
        html: htmlForm,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'إضافة',
        preConfirm: () => {
            const start = document.getElementById('cStart').value;
            const end = document.getElementById('cEnd').value;
            if(!start || !end) { Swal.showValidationMessage('يرجى تحديد التواريخ'); return false; }
            return {
                contractName: document.getElementById('cName').value,
                contractNumber: document.getElementById('cNum').value,
                value: document.getElementById('cVal').value,
                startDate: start,
                endDate: end,
                type: document.getElementById('cType').value,
                contractorId: document.getElementById('cCont').value,
                months: [] // مصفوفة فارغة
            };
        }
    });

    if (formValues) {
        // إنشاء ID فريد
        const newId = Date.now().toString();
        // حفظ في الفيربيز
        await DB.saveData(`app_db_v2/contracts/${newId}`, formValues);
        // تحديث محلي
        appData.contracts[newId] = formValues;
        
        Swal.fire('نجاح', 'تم إضافة العقد', 'success');
        refreshView();
    }
};

window.prepareEditContract = async function(id) {
    const c = appData.contracts[id];
    let contractorOptions = '';
    Object.entries(appData.contractors).forEach(([cid, cont]) => {
        contractorOptions += `<option value="${cid}" ${cid===c.contractorId?'selected':''}>${cont.name}</option>`;
    });

    const htmlForm = `
        <div class="popup-form-container">
            <div class="popup-full-width">
                <label class="popup-label">اسم العقد</label>
                <input id="ecName" class="swal2-input" value="${c.contractName||c.hospital||''}">
            </div>
            <div>
                <label class="popup-label">رقم العقد</label>
                <input id="ecNum" class="swal2-input" value="${c.contractNumber||''}">
            </div>
            <div>
                <label class="popup-label">القيمة</label>
                <input id="ecVal" type="number" class="swal2-input" value="${c.value||''}">
            </div>
            <div>
                <label class="popup-label">البداية</label>
                <input id="ecStart" type="date" class="swal2-input" value="${c.startDate||''}">
            </div>
            <div>
                <label class="popup-label">النهاية</label>
                <input id="ecEnd" type="date" class="swal2-input" value="${c.endDate||''}">
            </div>
            <div>
                <label class="popup-label">النوع</label>
                <select id="ecType" class="swal2-select">
                    <option value="طبي" ${c.type==='طبي'?'selected':''}>طبي</option>
                    <option value="غير طبي" ${c.type==='غير طبي'?'selected':''}>غير طبي</option>
                </select>
            </div>
            <div>
                <label class="popup-label">المقاول</label>
                <select id="ecCont" class="swal2-select">${contractorOptions}</select>
            </div>
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        title: 'تعديل العقد',
        html: htmlForm,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        preConfirm: () => {
            return {
                contractName: document.getElementById('ecName').value,
                contractNumber: document.getElementById('ecNum').value,
                value: document.getElementById('ecVal').value,
                startDate: document.getElementById('ecStart').value,
                endDate: document.getElementById('ecEnd').value,
                type: document.getElementById('ecType').value,
                contractorId: document.getElementById('ecCont').value
            };
        }
    });

    if (formValues) {
        await DB.updateData(`app_db_v2/contracts/${id}`, formValues);
        // تحديث محلي سريع
        Object.assign(appData.contracts[id], formValues);
        
        Swal.fire('نجاح', 'تم تعديل البيانات', 'success');
        refreshView();
    }
};

window.deleteContract = async function(id) {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "سيتم حذف العقد وكل بياناته!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف'
    });

    if (result.isConfirmed) {
        await DB.deleteData(`app_db_v2/contracts/${id}`);
        delete appData.contracts[id];
        refreshView();
        Swal.fire('تم الحذف', '', 'success');
    }
};

// --- 5. إدارة المقاولين (تم استعادتها) ---

window.prepareAddContractor = async function() {
    const { value: name } = await Swal.fire({
        title: 'إضافة مقاول جديد',
        input: 'text',
        inputLabel: 'اسم الشركة / المقاول',
        showCancelButton: true,
        confirmButtonText: 'إضافة'
    });

    if (name) {
        const newId = Date.now().toString();
        const data = { name: name };
        await DB.saveData(`app_db_v2/contractors/${newId}`, data);
        appData.contractors[newId] = data;
        
        Swal.fire('نجاح', 'تم إضافة المقاول', 'success');
        refreshView();
    }
};

window.prepareEditContractor = async function(id, oldName) {
    const { value: name } = await Swal.fire({
        title: 'تعديل اسم المقاول',
        input: 'text',
        inputValue: oldName,
        showCancelButton: true,
        confirmButtonText: 'حفظ'
    });

    if (name) {
        await DB.updateData(`app_db_v2/contractors/${id}`, { name: name });
        appData.contractors[id].name = name;
        refreshView();
        UI.showToast('تم التعديل ✅');
    }
};

window.deleteContractor = async function(id) {
    const result = await Swal.fire({
        title: 'حذف المقاول؟',
        text: "تأكد أنه ليس مرتبطاً بعقود سارية",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'حذف'
    });

    if (result.isConfirmed) {
        await DB.deleteData(`app_db_v2/contractors/${id}`);
        delete appData.contractors[id];
        refreshView();
        Swal.fire('تم الحذف', '', 'success');
    }
};

// --- 6. وظائف النظام (تحديث الشهور / النسخ الاحتياطي) ---

window.prepareMonthsUpdate = async function() {
    // 1. توليد قائمة الشهور لـ 5 سنوات (الماضي، الحالي، +3 مستقبل)
    const baseYear = 2024;
    const endYear = baseYear + 5; 
    const months = [];
    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    for (let y = baseYear; y <= endYear; y++) {
        for (let m = 0; m < 12; m++) {
            months.push(`${arMonths[m]} ${y}`);
        }
    }

    // 2. تحديث قائمة الشهور العامة
    await DB.saveData('app_db_v2/monthNames', months);
    appData.monthNames = months;

    // 3. تحديث مصفوفات العقود لتتناسب مع الطول الجديد
    // نستخدم Promise.all لتسريع العملية
    const updates = [];
    Object.keys(appData.contracts).forEach(id => {
        const c = appData.contracts[id];
        let cMonths = c.months || [];
        // تمديد المصفوفة مع الحفاظ على البيانات القديمة
        while(cMonths.length < months.length) {
            cMonths.push({ financeStatus: 'late' });
        }
        updates.push(DB.saveData(`app_db_v2/contracts/${id}/months`, cMonths));
        c.months = cMonths;
    });

    await Promise.all(updates);
    Swal.fire('تم', 'تم تحديث هيكل الشهور والسنوات بنجاح', 'success');
    refreshView();
};

window.systemReset = async function() {
    const { isConfirmed } = await Swal.fire({
        title: 'تهيئة النظام بالكامل؟',
        text: "سيتم مسح جميع البيانات وإنشاء قاعدة بيانات جديدة!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، تهيئة'
    });

    if (isConfirmed) {
        const emptyData = {
            contracts: {},
            contractors: {},
            monthNames: []
        };
        await DB.saveData('app_db_v2', emptyData);
        appData = emptyData;
        
        Swal.fire('تم', 'تمت تهيئة النظام. يرجى الضغط على "تحديث الشهور" للبدء.', 'success');
        refreshView();
    }
};

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
        if (isAuto) localStorage.setItem('last_auto_backup', new Date().toDateString());

    } catch (error) {
        console.error("Backup Error:", error);
    }
};

function checkAutoBackup() {
    if (window.userRole !== 'super') return;
    const todayStr = new Date().toDateString();
    const lastBackup = localStorage.getItem('last_auto_backup');

    if (lastBackup !== todayStr) {
        setTimeout(() => window.downloadBackup(true), 5000);
    }
}

// --- 7. Tabs & Helpers ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    // تلوين الزر النشط في النافبار
    const navItems = document.querySelectorAll('.nav-item');
    if(tabName === 'table') navItems[0].classList.add('active');
    if(tabName === 'contracts') navItems[1].classList.add('active');
    if(tabName === 'contractors') navItems[2].classList.add('active');

    // إعادة رسم الكروت عند دخول التاب
    if (tabName === 'contracts') window.renderCards('contract');
    if (tabName === 'contractors') window.renderCards('contractor');
};

window.renderCards = function(type) { UI.renderCards(appData, type); };
window.exportToExcel = function() { UI.exportToExcel(); };
window.toggleNotifications = function() { UI.toggleNotifications(); };
window.printReport = function() { UI.printReport(); };
