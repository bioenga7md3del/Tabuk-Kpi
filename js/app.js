// js/app.js
import * as DB from './db.js';
import * as UI from './ui.js';
// أضف السطر ده في الأول مع الـ imports
import * as PrintSystem from './print.js';

let appData = { contracts: {}, contractors: {}, monthNames: [] };
window.userRole = null; // 'super', 'medical', 'non_medical', 'viewer'
window.selectedYear = new Date().getFullYear();

// --- 1. Login Logic (Updated for 4 Roles) ---
window.adminLogin = async function() {
    const pwInput = document.getElementById('adminPassword').value;
    
    // جلب كلمات المرور المحفوظة (مع قيم افتراضية)
    const stored = await DB.getPasswords();
    const passwords = {
        super: stored.super || 'super123',
        medical: stored.medical || 'med123',
        non_medical: stored.non_medical || 'nonmed123',
        viewer: stored.viewer || 'view123'
    };
    
    // تحديد الصلاحية بناءً على الباسورد
    if (pwInput === passwords.super) window.userRole = 'super';
    else if (pwInput === passwords.medical) window.userRole = 'medical';
    else if (pwInput === passwords.non_medical) window.userRole = 'non_medical';
    else if (pwInput === passwords.viewer) window.userRole = 'viewer';
    else {
        Swal.fire('خطأ', 'كلمة المرور غير صحيحة', 'error');
        return;
    }

    // إخفاء شاشة الدخول
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // تحديث واجهة المستخدم حسب الصلاحية
    updateUIForRole();

    await loadData();
    refreshView();
    if(window.userRole === 'super') checkAutoBackup();
};

function updateUIForRole() {
    const role = window.userRole;
    const roleDisplay = document.getElementById('userRoleDisplay');
    
    // نصوص العرض
    let roleName = "غير معروف";
    if (role === 'super') roleName = "👑 سوبر أدمن";
    if (role === 'medical') roleName = "🩺 مشرف طبي";
    if (role === 'non_medical') roleName = "🏢 مشرف غير طبي";
    if (role === 'viewer') roleName = "👀 مطلع فقط";
    roleDisplay.innerText = roleName;

    // 1. أزرار السوبر أدمن (النسخ الاحتياطي، الإعدادات، التهيئة)
    const superBtns = document.querySelectorAll('.super-admin-only');
    superBtns.forEach(btn => btn.style.display = (role === 'super') ? 'inline-flex' : 'none');

    // 2. أزرار التعديل والإضافة (تختفي للمطلع)
    const editBtns = document.querySelectorAll('.edit-permission-only');
    editBtns.forEach(btn => btn.style.display = (role === 'viewer') ? 'none' : 'inline-flex');
    
    // 3. قفل فلتر الأنواع للمشرفين
    const typeFilter = document.getElementById('typeFilter');
    if (role === 'medical') {
        typeFilter.value = 'طبي';
        typeFilter.disabled = true;
    } else if (role === 'non_medical') {
        typeFilter.value = 'غير طبي';
        typeFilter.disabled = true;
    } else {
        typeFilter.disabled = false;
        typeFilter.value = 'all';
    }
}

window.logout = function() { location.reload(); };

// --- 2. Data Loading ---
async function loadData() {
    const data = await DB.getData('app_db_v2');
    if (data) {
        appData = data;
        if (!appData.contracts) appData.contracts = {};
        if (!appData.contractors) appData.contractors = {};
        if (!appData.monthNames) appData.monthNames = [];
    } else {
        appData = { contracts: {}, contractors: {}, monthNames: [] };
    }
}

window.refreshView = function() {
    // تمرير userRole لـ renderTable للفلترة
    const filteredRows = UI.renderTable(appData, window.userRole, canEdit, window.selectedYear);
    UI.updateStats(filteredRows, appData, window.selectedYear);
    UI.renderYearTabs(appData.contracts, window.selectedYear);
    
    // تحديث الكروت إذا كان التاب نشطاً
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'tab-contracts') window.renderCards('contract');
    if (activeTab && activeTab.id === 'tab-contractors') window.renderCards('contractor');

    UI.checkNotifications(appData.contracts);
};

window.selectYear = function(year) {
    window.selectedYear = year;
    refreshView();
};

// دالة التحقق من صلاحية التعديل
function canEdit(role, contractType) {
    if (role === 'viewer') return false; // المطلع لا يعدل أبداً
    if (role === 'super') return true; // السوبر يعدل كل شيء
    if (role === 'medical' && contractType === 'طبي') return true;
    if (role === 'non_medical' && contractType === 'غير طبي') return true;
    return false;
}

// --- 3. Popup Handling ---
window.handleKpiCell = async function(contractId, monthIndex) {
    // فحص أمان إضافي
    const row = appData.contracts[contractId];
    if (!canEdit(window.userRole, row.type)) return; 

    const currentData = (row.months && row.months[monthIndex]) ? row.months[monthIndex] : {};
    
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
            <div><label class="popup-label">رقم المطالبة</label><input id="swalClaim" class="swal2-input" value="${currentData.claimNum||''}"></div>
            <div><label class="popup-label">رقم الخطاب</label><input id="swalLetter" class="swal2-input" value="${currentData.letterNum||''}"></div>
            <div><label class="popup-label">رابط المستند</label><input id="swalLink" class="swal2-input" value="${currentData.docLink||''}"></div>
            <div class="popup-full-width"><label class="popup-label">ملاحظات</label><textarea id="swalReturn" class="swal2-textarea" style="height:80px">${currentData.returnNotes||''}</textarea></div>
        </div>`;

    const { value: formValues } = await Swal.fire({
        title: `تحديث: ${row.contractName}`,
        html: htmlForm,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'حفظ',
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
        await DB.saveData(`app_db_v2/contracts/${contractId}/months`, row.months);
        refreshView();
        UI.showToast("تم التحديث ✅");
    }
};

window.editNote = async function(id) {
    const row = appData.contracts[id];
    if (!canEdit(window.userRole, row.type)) return;

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

// --- 4. Contract Management ---
window.prepareAddContract = async function() {
    if (window.userRole === 'viewer') return;

    let contractorOptions = '';
    Object.entries(appData.contractors).forEach(([id, c]) => { contractorOptions += `<option value="${id}">${c.name}</option>`; });
    if (contractorOptions === '') { Swal.fire('تنبيه', 'أضف مقاولين أولاً', 'warning'); return; }

    // تحديد نوع العقد إجبارياً حسب المشرف
    let typeOptions = `<option value="طبي">طبي</option><option value="غير طبي">غير طبي</option>`;
    let fixedType = null;
    if (window.userRole === 'medical') {
        typeOptions = `<option value="طبي" selected>طبي</option>`;
        fixedType = 'طبي';
    } else if (window.userRole === 'non_medical') {
        typeOptions = `<option value="غير طبي" selected>غير طبي</option>`;
        fixedType = 'غير طبي';
    }

    const htmlForm = `
        <div class="popup-form-container">
            <div class="popup-full-width"><label class="popup-label">اسم العقد</label><input id="cName" class="swal2-input"></div>
            <div><label class="popup-label">رقم العقد</label><input id="cNum" class="swal2-input"></div>
            <div><label class="popup-label">القيمة</label><input id="cVal" type="number" class="swal2-input"></div>
            <div><label class="popup-label">البداية</label><input id="cStart" type="date" class="swal2-input"></div>
            <div><label class="popup-label">النهاية</label><input id="cEnd" type="date" class="swal2-input"></div>
            <div><label class="popup-label">النوع</label><select id="cType" class="swal2-select" ${fixedType ? 'disabled' : ''}>${typeOptions}</select></div>
            <div><label class="popup-label">المقاول</label><select id="cCont" class="swal2-select">${contractorOptions}</select></div>
        </div>`;

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
                // إذا كان الحقل معطل، نستخدم القيمة الثابتة، وإلا نأخذ القيمة من الحقل
                type: fixedType || document.getElementById('cType').value,
                contractorId: document.getElementById('cCont').value,
                months: []
            };
        }
    });

    if (formValues) {
        const newId = Date.now().toString();
        await DB.saveData(`app_db_v2/contracts/${newId}`, formValues);
        appData.contracts[newId] = formValues;
        Swal.fire('نجاح', 'تم إضافة العقد', 'success');
        refreshView();
    }
};

window.prepareEditContract = async function(id) {
    if (window.userRole === 'viewer') return;
    const c = appData.contracts[id];
    
    // حماية إضافية
    if (!canEdit(window.userRole, c.type)) { Swal.fire('مرفوض', 'ليس لديك صلاحية تعديل هذا النوع من العقود', 'error'); return; }

    let contractorOptions = '';
    Object.entries(appData.contractors).forEach(([cid, cont]) => {
        contractorOptions += `<option value="${cid}" ${cid===c.contractorId?'selected':''}>${cont.name}</option>`;
    });

    const htmlForm = `
        <div class="popup-form-container">
            <div class="popup-full-width"><label class="popup-label">اسم العقد</label><input id="ecName" class="swal2-input" value="${c.contractName||c.hospital||''}"></div>
            <div><label class="popup-label">رقم العقد</label><input id="ecNum" class="swal2-input" value="${c.contractNumber||''}"></div>
            <div><label class="popup-label">القيمة</label><input id="ecVal" type="number" class="swal2-input" value="${c.value||''}"></div>
            <div><label class="popup-label">البداية</label><input id="ecStart" type="date" class="swal2-input" value="${c.startDate||''}"></div>
            <div><label class="popup-label">النهاية</label><input id="ecEnd" type="date" class="swal2-input" value="${c.endDate||''}"></div>
            <div><label class="popup-label">النوع</label><select id="ecType" class="swal2-select"><option value="طبي" ${c.type==='طبي'?'selected':''}>طبي</option><option value="غير طبي" ${c.type==='غير طبي'?'selected':''}>غير طبي</option></select></div>
            <div><label class="popup-label">المقاول</label><select id="ecCont" class="swal2-select">${contractorOptions}</select></div>
        </div>`;

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
        Object.assign(appData.contracts[id], formValues);
        Swal.fire('نجاح', 'تم التعديل', 'success');
        refreshView();
    }
};

window.deleteContract = async function(id) {
    if (window.userRole === 'viewer') return;
    const c = appData.contracts[id];
    if (!canEdit(window.userRole, c.type)) { Swal.fire('مرفوض', 'ليس لديك صلاحية', 'error'); return; }

    const result = await Swal.fire({ title: 'حذف العقد؟', text: "لا يمكن التراجع", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'حذف' });
    if (result.isConfirmed) {
        await DB.deleteData(`app_db_v2/contracts/${id}`);
        delete appData.contracts[id];
        refreshView();
        Swal.fire('تم الحذف', '', 'success');
    }
};

// --- 5. Contractor Management ---
window.prepareAddContractor = async function() {
    if (window.userRole === 'viewer') return;
    const { value: name } = await Swal.fire({ title: 'إضافة مقاول', input: 'text', showCancelButton: true, confirmButtonText: 'إضافة' });
    if (name) {
        const newId = Date.now().toString();
        const data = { name: name };
        await DB.saveData(`app_db_v2/contractors/${newId}`, data);
        appData.contractors[newId] = data;
        refreshView();
    }
};

window.prepareEditContractor = async function(id, oldName) {
    if (window.userRole === 'viewer') return;
    const { value: name } = await Swal.fire({ title: 'تعديل', input: 'text', inputValue: oldName, showCancelButton: true, confirmButtonText: 'حفظ' });
    if (name) {
        await DB.updateData(`app_db_v2/contractors/${id}`, { name: name });
        appData.contractors[id].name = name;
        refreshView();
    }
};

window.deleteContractor = async function(id) {
    if (window.userRole === 'viewer') return;
    const result = await Swal.fire({ title: 'حذف المقاول؟', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'حذف' });
    if (result.isConfirmed) {
        await DB.deleteData(`app_db_v2/contractors/${id}`);
        delete appData.contractors[id];
        refreshView();
    }
};

// --- 6. Settings (Updated for 4 Roles) ---
window.openSettings = async function() {
    if (window.userRole !== 'super') return;
    const stored = await DB.getPasswords();
    const passwords = {
        super: stored.super || 'super123',
        medical: stored.medical || 'med123',
        non_medical: stored.non_medical || 'nonmed123',
        viewer: stored.viewer || 'view123'
    };

    const htmlForm = `
        <div class="popup-form-container">
            <div class="popup-full-width" style="text-align:center;color:#777;margin-bottom:10px;">تغيير كلمات مرور النظام</div>
            <div class="popup-full-width"><label class="popup-label">👑 سوبر أدمن</label><input id="pwSuper" class="swal2-input" value="${passwords.super}"></div>
            <div class="popup-full-width"><label class="popup-label">🩺 مشرف طبي</label><input id="pwMed" class="swal2-input" value="${passwords.medical}"></div>
            <div class="popup-full-width"><label class="popup-label">🏢 مشرف غير طبي</label><input id="pwNonMed" class="swal2-input" value="${passwords.non_medical}"></div>
            <div class="popup-full-width"><label class="popup-label">👀 مطلع (Viewer)</label><input id="pwView" class="swal2-input" value="${passwords.viewer}"></div>
        </div>`;

    const { value: formValues } = await Swal.fire({
        title: '⚙️ إعدادات النظام',
        html: htmlForm,
        width: '500px',
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        preConfirm: () => {
            return {
                super: document.getElementById('pwSuper').value,
                medical: document.getElementById('pwMed').value,
                non_medical: document.getElementById('pwNonMed').value,
                viewer: document.getElementById('pwView').value
            }
        }
    });

    if (formValues) {
        if(!formValues.super || !formValues.medical || !formValues.non_medical || !formValues.viewer) {
            Swal.fire('خطأ', 'لا تترك حقول فارغة', 'error'); return;
        }
        await DB.savePasswords(formValues);
        Swal.fire('تم', 'تم تحديث جميع كلمات المرور', 'success');
    }
};

// --- 7. System Functions ---
window.prepareMonthsUpdate = async function() {
    const months = []; const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    for (let y = 2024; y <= 2029; y++) { for (let m = 0; m < 12; m++) months.push(`${arMonths[m]} ${y}`); }
    await DB.saveData('app_db_v2/monthNames', months);
    appData.monthNames = months;
    const updates = [];
    Object.keys(appData.contracts).forEach(id => {
        const c = appData.contracts[id]; let cMonths = c.months || [];
        while(cMonths.length < months.length) cMonths.push({ financeStatus: 'late' });
        updates.push(DB.saveData(`app_db_v2/contracts/${id}/months`, cMonths));
        c.months = cMonths;
    });
    await Promise.all(updates);
    Swal.fire('تم', 'تم تحديث الشهور', 'success');
    refreshView();
};

window.systemReset = async function() {
    const { isConfirmed } = await Swal.fire({ title: 'تهيئة النظام؟', text: "سيتم حذف كل شيء!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'نعم' });
    if (isConfirmed) {
        await DB.saveData('app_db_v2', { contracts: {}, contractors: {}, monthNames: [] });
        location.reload();
    }
};

window.downloadBackup = async function(isAuto = false) {
    if (window.userRole !== 'super') return;
    if (!isAuto) UI.showToast("جاري تحضير النسخة...");
    try {
        const snapshot = await DB.getAllData(); const data = snapshot.val(); if (!data) return;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `KPI_Backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        if (!isAuto) UI.showToast("تم التحميل ✅");
        if (isAuto) localStorage.setItem('last_auto_backup', new Date().toDateString());
    } catch (error) { console.error(error); }
};

function checkAutoBackup() {
    const last = localStorage.getItem('last_auto_backup');
    if (last !== new Date().toDateString()) setTimeout(() => window.downloadBackup(true), 5000);
}

// --- 8. UI Helpers ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    const navItems = document.querySelectorAll('.nav-item');
    if(tabName==='table') navItems[0].classList.add('active');
    if(tabName==='contracts') navItems[1].classList.add('active');
    if(tabName==='contractors') navItems[2].classList.add('active');
    
    if (tabName === 'contracts') window.renderCards('contract');
    if (tabName === 'contractors') window.renderCards('contractor');
};

window.renderCards = function(type) { UI.renderCards(appData, type); };
window.exportToExcel = function() { UI.exportToExcel(); };
window.toggleNotifications = function() { UI.toggleNotifications(); };
// js/app.js (في النهاية)
window.printReport = function() {
    // نرسل البيانات الحالية والسنة المختارة والصلاحية لملف الطباعة
    PrintSystem.openPrintPage(appData, window.selectedYear, window.userRole);
};
// دالة إضافة شهر جديد بأمان (متوافقة مع الترتيب المعكوس)
window.addNewMonthSafely = async function() {
    if (window.userRole !== 'super') return;

    const { value: newMonth } = await Swal.fire({
        title: 'إضافة شهر جديد',
        input: 'text',
        inputLabel: 'اكتب اسم الشهر والسنة (مثال: فبراير 2026)',
        inputPlaceholder: 'فبراير 2026',
        showCancelButton: true,
        confirmButtonText: 'إضافة',
        cancelButtonText: 'إلغاء'
    });

    if (newMonth) {
        // 1. التأكد من عدم تكرار الشهر
        if (appData.monthNames && appData.monthNames.includes(newMonth)) {
            Swal.fire('تنبيه', 'هذا الشهر موجود بالفعل!', 'warning');
            return;
        }

        UI.showToast("جاري إضافة الشهر وتهيئة العقود...");

        // 2. إضافة الشهر في أعلى القائمة (Index 0)
        appData.monthNames.unshift(newMonth); // unshift تضع العنصر في البداية
        await DB.saveData('app_db_v2/monthNames', appData.monthNames);

        // 3. المرور على كل العقود لترحيل البيانات وتفريغ الخانة الأولى
        const updates = [];
        Object.keys(appData.contracts).forEach(id => {
            const c = appData.contracts[id];
            let cMonths = c.months || [];
            // إضافة خانة جديدة فارغة (تأخير افتراضي) في بداية مصفوفة العقد
            cMonths.unshift({ financeStatus: 'late' }); 
            updates.push(DB.saveData(`app_db_v2/contracts/${id}/months`, cMonths));
            c.months = cMonths;
        });

        await Promise.all(updates);
        Swal.fire('نجاح', `تم إضافة "${newMonth}" وتحديث الجدول بأمان.`, 'success');
        refreshView();
    }
};
