import * as DB from "./db.js";
import * as Auth from "./auth.js";
import * as UI from "./ui.js";

// Global State
window.appData = { contractors: {}, contracts: {}, monthNames: [] };
window.userRole = null;
window.selectedYear = new Date().getFullYear(); // السنة الافتراضية: الحالية
window.appPasswords = { super: '1234', medical: '1111', non_medical: '2222' };

UI.initTooltip();

// 1. الاستماع للبيانات
DB.listenToData((data) => {
    document.getElementById('loader').style.display = 'none';
    if (data) {
        window.appData.contractors = data.contractors || {};
        window.appData.contracts = data.contracts || {};
        window.appData.monthNames = data.monthNames || [];
    }
    try {
        refreshView();
        document.getElementById('mainTable').style.display = 'table';
    } catch (e) { console.error("Render Error:", e); }
}, console.error);

DB.listenToPasswords((pass) => window.appPasswords = pass);

// 2. دالة تحديث العرض
function refreshView() {
    // رسم التابات
    UI.renderYearTabs(window.appData.contracts, window.selectedYear);
    
    // رسم الجدول للسنة المختارة
    const rows = UI.renderTable(window.appData, window.userRole, Auth.canEdit, window.selectedYear);
    
    // تحديث الإحصائيات للسنة المختارة
    UI.updateStats(rows, window.appData, window.selectedYear);
    
    if (window.userRole && window.userRole !== 'viewer') {
        UI.renderCards(window.appData, 'contract');
        UI.renderCards(window.appData, 'contractor');
    }
}

// --- Global Binding (ربط الدوال بالـ HTML) ---
window.renderTable = refreshView;
window.selectYear = function(year) { window.selectedYear = year; refreshView(); };
window.renderContractsCards = function() { UI.renderCards(window.appData, 'contract'); };
window.showTooltip = UI.showTooltip;
window.hideTooltip = UI.hideTooltip;
window.exportToExcel = UI.exportToExcel;

window.switchView = function(viewId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    const map = {'dashboard-view':0, 'contracts-view':1, 'contractors-view':2};
    const navs = document.querySelectorAll('.nav-item');
    if(navs[map[viewId]]) navs[map[viewId]].classList.add('active');
};

window.adminLogin = async function() {
    const { value: pass } = await Swal.fire({ title: 'دخول', input: 'password', confirmButtonText: 'دخول' });
    if (!pass) return;
    const res = Auth.checkLogin(pass, window.appPasswords);
    if (!res) return Swal.fire('خطأ', 'كلمة المرور خطأ', 'error');
    window.userRole = res.role;
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardControls').classList.remove('hidden');
    document.getElementById('loginBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('roleDisplay').innerText = res.name;
    const isSuper = window.userRole === 'super';
    const isViewer = window.userRole === 'viewer';
    document.querySelectorAll('.super-admin-only').forEach(el => el.style.display = isSuper ? 'inline-block' : 'none');
    document.querySelectorAll('.restricted-tab').forEach(el => el.style.display = isViewer ? 'none' : 'block');
    refreshView();
};

window.saveContract = function() {
    const id = document.getElementById('form-contract-id').value;
    const data = {
        contractName: document.getElementById('form-contract-name').value,
        hospital: document.getElementById('form-contract-name').value,
        type: document.getElementById('form-type').value,
        contractorId: document.getElementById('form-contractor').value,
        startDate: document.getElementById('form-start-date').value,
        endDate: document.getElementById('form-end-date').value,
        duration: document.getElementById('form-duration').value,
        value: document.getElementById('form-value').value,
        contractNumber: document.getElementById('form-contract-num').value
    };
    if(!data.contractName || !data.contractorId) return Swal.fire('تنبيه', 'بيانات ناقصة', 'error');
    if(id) {
        const old = window.appData.contracts[id];
        data.months = old.months || []; data.notes = old.notes || "";
        DB.updateContract(id, data).then(() => { UI.showToast("تم التعديل"); UI.toggleModal('contractModal', false); });
    } else {
        const count = window.appData.monthNames.length;
        data.months = Array(count).fill().map(() => ({status:"late", financeStatus:"late"}));
        data.notes = "";
        DB.addContract(data).then(() => { UI.showToast("تم الحفظ"); UI.toggleModal('contractModal', false); });
    }
};

window.saveContractor = function() {
    const id = document.getElementById('form-contractor-id').value;
    const name = document.getElementById('form-new-contractor').value;
    if(!name) return;
    const p = id ? DB.updateContractor(id, name) : DB.addContractor(name);
    p.then(() => { UI.showToast("تم"); UI.toggleModal('contractorModal', false); });
};

window.prepareEditContract = function(id) {
    const c = window.appData.contracts[id];
    fillSelect();
    document.getElementById('form-contract-id').value = id;
    document.getElementById('form-contract-name').value = c.contractName || c.hospital;
    document.getElementById('form-type').value = c.type;
    document.getElementById('form-contractor').value = c.contractorId;
    document.getElementById('form-start-date').value = c.startDate || "";
    document.getElementById('form-end-date').value = c.endDate || "";
    document.getElementById('form-duration').value = c.duration || "";
    document.getElementById('form-value').value = c.value || "";
    document.getElementById('form-contract-num').value = c.contractNumber || "";
    UI.toggleModal('contractModal', true);
};

window.prepareEditContractor = function(id, name) {
    document.getElementById('form-contractor-id').value = id;
    document.getElementById('form-new-contractor').value = name;
    UI.toggleModal('contractorModal', true);
};

window.deleteContract = async (id) => { if((await Swal.fire({title:'حذف؟',icon:'warning',showCancelButton:true})).isConfirmed) DB.deleteContract(id); };
window.deleteContractor = function(id) { const has = Object.values(window.appData.contracts).some(c => c.contractorId === id); if(has) Swal.fire('لا','مرتبط بعقود','error'); else DB.deleteContractor(id); };

// --- ✅ تعديل شهر (نسخة محمية من الأخطاء) ---
window.handleKpiCell = async function(cid, midx) {
    if (!Auth.canEdit(window.userRole, window.appData.contracts[cid].type)) return;
    
    // جلب العقد
    const contract = window.appData.contracts[cid];
    if (!contract) return UI.showToast("خطأ: العقد غير موجود");

    // --- الحماية من الانهيار ---
    if (!contract.months) contract.months = [];
    if (!contract.months[midx]) {
        contract.months[midx] = { financeStatus: 'late', status: 'late' };
    }

    const m = contract.months[midx];
    const monthName = window.appData.monthNames[midx] || "تحديث الحالة";
    
    const {value:v} = await Swal.fire({
        title: monthName,
        html: `
            <label style="display:block;text-align:right;margin-bottom:5px">الحالة:</label>
            <select id="sw-st" class="form-control" style="margin-bottom:10px">
                <option value="late" ${m.financeStatus==='late'?'selected':''}>❌ متأخر</option>
                <option value="sent" ${m.financeStatus==='sent'?'selected':''}>✅ تم رفعه للمالية</option>
                <option value="returned" ${m.financeStatus==='returned'?'selected':''}>⚠️ تم إرجاعه</option>
            </select>
            
            <label style="display:block;text-align:right;margin-bottom:5px">رقم المطالبة:</label>
            <input id="sw-cn" class="form-control" placeholder="رقم المطالبة" value="${m.claimNum||''}" style="margin-bottom:10px">
            
            <label style="display:block;text-align:right;margin-bottom:5px">رقم الخطاب:</label>
            <input id="sw-ln" class="form-control" placeholder="رقم الخطاب" value="${m.letterNum||''}" style="margin-bottom:10px">
            
            <label style="display:block;text-align:right;margin-bottom:5px">تاريخ الخطاب:</label>
            <input id="sw-dt" class="form-control" type="date" value="${m.submissionDate||''}" style="margin-bottom:10px">
            
            <label style="display:block;text-align:right;margin-bottom:5px">ملاحظات / سبب الإرجاع:</label>
            <input id="sw-nt" class="form-control" placeholder="ملاحظات" value="${m.returnNotes||''}">
        `,
        focusConfirm: false,
        preConfirm: () => ({ 
            financeStatus: document.getElementById('sw-st').value, 
            claimNum: document.getElementById('sw-cn').value, 
            letterNum: document.getElementById('sw-ln').value, 
            submissionDate: document.getElementById('sw-dt').value, 
            returnNotes: document.getElementById('sw-nt').value 
        })
    });
    
    if(v) {
        try {
            await DB.updateMonthStatus(cid, midx, v);
            contract.months[midx] = v; // تحديث محلي
            refreshView(); 
            UI.showToast("تم الحفظ"); 
        } catch (error) {
            console.error(error);
            UI.showToast("حدث خطأ أثناء الحفظ");
        }
    }
};

window.editNote = async function(cid) {
    if (!Auth.canEdit(window.userRole, window.appData.contracts[cid].type)) return;
    const {value:t} = await Swal.fire({input:'textarea', inputValue:window.appData.contracts[cid].notes});
    if(t!==undefined) DB.updateContract(cid, {notes:t});
};

// --- 🔥🔥🔥 Smart Refresh (يمنع ترحيل البيانات) 🔥🔥🔥 ---
window.refreshMonthsSystem = async function() {
    if(!window.userRole) return;
    
    const result = await Swal.fire({
        title: 'تحديث وإعادة هيكلة الشهور؟',
        text: "سيتم ترتيب الشهور بناءً على الأسماء (لن تضيع البيانات القديمة).",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، تحديث',
        cancelButtonText: 'إلغاء'
    });

    if(!result.isConfirmed) return;

    // 1. تحديد أقدم سنة
    let minYear = 2024;
    const contracts = window.appData.contracts || {};
    Object.values(contracts).forEach(c => {
        if (c.startDate) {
            const y = new Date(c.startDate).getFullYear();
            if (y < minYear) minYear = y;
        }
    });

    const startDate = new Date(minYear, 0, 1); // 1 يناير من أقدم سنة
    const now = new Date(); // اليوم
    
    const arM = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    let newMonthNames = [];

    // 2. توليد قائمة الشهور الجديدة (من الأقدم للأحدث ثم نعكسها)
    let current = new Date(startDate);
    while (current <= now) {
        let mIndex = current.getMonth();
        let y = current.getFullYear();
        newMonthNames.push(`${arM[mIndex]} ${y}`);
        current.setMonth(current.getMonth() + 1);
    }
    newMonthNames.reverse(); // النتيجة: [يناير 2026, ..., يناير 2025, ..., يناير 2020]
    
    // حفظ أسماء الشهور القديمة (للمقارنة)
    const oldMonthNames = window.appData.monthNames || [];

    const updates = {};
    
    // تحديث قائمة الأسماء في DB
    updates['app_db_v2/monthNames'] = newMonthNames;

    // 3. إعادة توزيع بيانات العقود
    Object.entries(contracts).forEach(([id, c]) => {
        // التأكد أن البيانات مصفوفة
        const oldMonths = Array.isArray(c.months) ? c.months : [];
        
        // إنشاء مصفوفة جديدة فارغة بحجم الشهور الجديدة
        const newMonthsData = new Array(newMonthNames.length).fill(null).map(() => ({
            status: "late", 
            financeStatus: "late"
        }));

        // 🌟 السحر هنا: نقل البيانات بناءً على "الاسم" وليس "المكان"
        oldMonthNames.forEach((oldName, oldIdx) => {
            // هل هذا الشهر القديم موجود في القائمة الجديدة؟
            const newIdx = newMonthNames.indexOf(oldName);
            
            // إذا وجدناه، وكان له بيانات، انسخها في مكانها الجديد
            if (newIdx !== -1 && oldMonths[oldIdx]) {
                newMonthsData[newIdx] = oldMonths[oldIdx];
            }
        });

        updates[`app_db_v2/contracts/${id}/months`] = newMonthsData;
    });
    
    // تنفيذ التحديث في فيربيز
    if(Object.keys(updates).length > 0) {
        await DB.update(DB.ref(DB.db), updates);
    }
    
    UI.showToast(`تم التحديث بنجاح`);
    setTimeout(() => location.reload(), 1500);
};

window.systemReset = async function() {
    if(window.userRole!=='super') return;
    if((await Swal.fire({title:'مسح؟',icon:'warning',showCancelButton:true})).isConfirmed) {
        DB.resetDatabase().then(()=>location.reload());
        DB.savePasswords({ super:'1234', medical:'1111', non_medical:'2222' });
    }
};

// أضف هذا في ملف js/app.js

window.downloadBackup = async function() {
    // 1. التحقق من الصلاحية (للسوبر أدمن فقط)
    if (window.userRole !== 'super') return;

    UI.showToast("⏳ جاري تحضير النسخة الاحتياطية...");

    try {
        // 2. جلب البيانات من الفيربيز
        const snapshot = await DB.getAllData();
        const data = snapshot.val();

        if (!data) {
            Swal.fire('تنبيه', 'لا توجد بيانات لتحميلها', 'info');
            return;
        }

        // 3. تحويل البيانات لملف JSON
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // 4. تسمية الملف بالتاريخ والوقت
        const d = new Date();
        const fileName = `Backup_KPI_${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}_${d.getHours()}-${d.getMinutes()}.json`;

        // 5. إنشاء رابط التحميل والضغط عليه أوتوماتيكياً
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // تنظيف
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        UI.showToast("✅ تم تحميل النسخة بنجاح");

    } catch (error) {
        console.error("Backup Error:", error);
        UI.showToast("❌ حدث خطأ أثناء التحميل");
    }
};



window.changePasswords = async function() {
    if (!window.userRole || window.userRole !== 'super') return;
    const { value: f } = await Swal.fire({
        title: 'تغيير كلمات المرور',
        html: '<input id="p1" class="swal2-input" value="'+window.appPasswords.super+'"><input id="p2" class="swal2-input" value="'+window.appPasswords.medical+'"><input id="p3" class="swal2-input" value="'+window.appPasswords.non_medical+'">',
        preConfirm: () => ({ super: document.getElementById('p1').value, medical: document.getElementById('p2').value, non_medical: document.getElementById('p3').value })
    });
    if (f) DB.savePasswords(f).then(() => { window.appPasswords = f; UI.showToast('تم الحفظ'); });
};

// --- Helpers ---
window.openModal = function(id) {
    UI.toggleModal(id, true);
    if(id==='contractModal') fillSelect();
    if(id==='contractorModal' && !document.getElementById('form-contractor-id').value) document.getElementById('form-new-contractor').value='';
    if(id==='contractModal' && !document.getElementById('form-contract-id').value) {
        document.getElementById('form-contract-name').value='';
        document.getElementById('form-contract-num').value='';
        document.getElementById('form-duration').value='';
        document.getElementById('form-value').value='';
        document.getElementById('form-start-date').value='';
        document.getElementById('form-end-date').value='';
    }
};
window.closeModal = function(id) {
    UI.toggleModal(id, false);
    if(id==='contractModal') document.getElementById('form-contract-id').value='';
    if(id==='contractorModal') document.getElementById('form-contractor-id').value='';
};
function fillSelect() {
    const s = document.getElementById('form-contractor');
    if(!s) return;
    const curr = s.value;
    s.innerHTML = '<option value="">اختر...</option>';
    Object.entries(window.appData.contractors).forEach(([id,v])=> s.innerHTML+=`<option value="${id}">${v.name}</option>`);
    s.value = curr;
}
