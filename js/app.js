import { ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { db } from "./config.js";

// Global State
window.appData = { contractors: {}, contracts: {}, monthNames: [] };
window.userRole = null;
window.appPasswords = { super: '1234', medical: '1111', non_medical: '2222' };

// --- Loading Data ---
const dbRef = ref(db, 'app_db_v2'); 
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    const loader = document.getElementById('loader');
    const table = document.getElementById('mainTable');
    
    if (data) {
        window.appData.contractors = data.contractors || {};
        window.appData.contracts = data.contracts || {};
        window.appData.monthNames = data.monthNames || [];
        
        renderTable(); // سيتم استدعاؤها تلقائياً عند إضافة أي عقد جديد
        updateStats();
        loader.style.display = 'none';
        table.style.display = 'table';
    } else {
        loader.innerHTML = "النظام جاهز. الرجاء تسجيل الدخول وتهيئة النظام.";
    }
});

onValue(ref(db, 'app_settings/passwords'), (s) => { if(s.exists()) window.appPasswords = s.val(); });

// --- Helper Functions ---
window.showToast = function(msg) {
    const t = document.getElementById("toast"); t.innerText = msg; t.className = "show";
    setTimeout(() => t.className = "", 2500);
}

// --- Modal Functions ---
window.openModal = function(id) {
    document.getElementById(id).style.display = 'flex';
    if(id === 'contractorModal') renderContractorsList();
    if(id === 'contractModal') fillContractorSelect();
}
window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
}

// --- Month Logic ---
window.refreshMonthsSystem = async function() {
    if (!window.userRole || window.userRole !== 'super') return;
    
    if(!(await Swal.fire({title:'تحديث الجدول الزمني؟', text:'سيتم ضبط الأعمدة من يناير للسنة الحالية حتى الشهر السابق.', icon:'warning', showCancelButton:true})).isConfirmed) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); 
    
    const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    let newMonthNames = [];

    for (let i = 0; i < currentMonth; i++) {
        newMonthNames.push(`${arabicMonths[i]} ${currentYear}`);
    }
    
    newMonthNames.reverse();

    const updates = {};
    updates['app_db_v2/monthNames'] = newMonthNames;

    Object.entries(window.appData.contracts).forEach(([id, contract]) => {
        let currentMonths = contract.months || [];
        // إعادة بناء مصفوفة الشهور لتناسب العدد الجديد (مع الحفاظ على البيانات القديمة قدر الإمكان)
        // ملاحظة: هذا المنطق بسيط، يفضل دائما تهيئة النظام في بداية السنة
        const adjustedMonths = new Array(newMonthNames.length).fill(null).map((_, idx) => {
            return currentMonths[idx] || { status: "late", financeStatus: "late", claimNum: "", letterNum: "", submissionDate: "", returnNotes: "" };
        });
        updates[`app_db_v2/contracts/${id}/months`] = adjustedMonths;
    });

    update(ref(db), updates).then(() => {
        showToast("تم تحديث الفترات الزمنية");
    });
};

// --- Contractor Management ---
window.saveNewContractor = function() {
    const name = document.getElementById('form-new-contractor').value;
    if(!name) return;
    push(ref(db, 'app_db_v2/contractors'), { name: name })
        .then(() => { 
            document.getElementById('form-new-contractor').value = ''; 
            renderContractorsList(); 
            showToast("تمت الإضافة"); 
        });
};

function renderContractorsList() {
    const list = document.getElementById('contractorsList');
    list.innerHTML = Object.entries(window.appData.contractors).map(([id, val]) => `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px;">
            <span>${val.name}</span>
            <button class="btn-danger" style="padding:2px 5px; font-size:10px;" onclick="deleteContractor('${id}')">حذف</button>
        </div>
    `).join('');
}

window.deleteContractor = function(id) {
    const hasContracts = Object.values(window.appData.contracts).some(c => c.contractorId === id);
    if(hasContracts) { Swal.fire('خطأ','مرتبط بعقود','error'); return; }
    remove(ref(db, `app_db_v2/contractors/${id}`)).then(() => renderContractorsList());
}

// --- Contract Management (تم التحديث لإضافة الحقول الجديدة) ---
function fillContractorSelect() {
    const sel = document.getElementById('form-contractor');
    sel.innerHTML = '<option value="">اختر المقاول...</option>';
    Object.entries(window.appData.contractors).forEach(([id, val]) => {
        sel.innerHTML += `<option value="${id}">${val.name}</option>`;
    });
}

window.saveNewContract = function() {
    // 1. جلب البيانات من النموذج
    const hosp = document.getElementById('form-hospital').value;
    const type = document.getElementById('form-type').value;
    const contId = document.getElementById('form-contractor').value;
    const contNum = document.getElementById('form-contract-num').value;
    const startDate = document.getElementById('form-start-date').value;
    const endDate = document.getElementById('form-end-date').value;
    const val = document.getElementById('form-value').value;

    // 2. التحقق من البيانات
    if(!hosp || !contId) { Swal.fire('نقص بيانات','يرجى تعبئة الحقول الأساسية (المستشفى والمقاول)','error'); return; }

    // 3. تجهيز بيانات الشهور
    const monthsCount = window.appData.monthNames.length;
    const emptyMonths = Array(monthsCount).fill().map(() => ({ 
        status: "late", financeStatus: "late", claimNum: "", letterNum: "", submissionDate: "", returnNotes: "" 
    }));

    // 4. إنشاء كائن العقد الجديد
    const newContract = {
        hospital: hosp,
        type: type,
        contractorId: contId,
        contractNumber: contNum,
        startDate: startDate, // جديد
        endDate: endDate,     // جديد
        value: val,           // جديد
        months: emptyMonths,
        notes: ""
    };

    // 5. الحفظ في الفيربيز
    push(ref(db, 'app_db_v2/contracts'), newContract).then(() => {
        showToast("تم حفظ العقد بنجاح");
        closeModal('contractModal');
        // تفريغ الحقول
        document.getElementById('form-hospital').value = '';
        document.getElementById('form-contract-num').value = '';
        document.getElementById('form-start-date').value = '';
        document.getElementById('form-end-date').value = '';
        document.getElementById('form-value').value = '';
    });
};

// --- Table Rendering (تم التحديث لإظهار الأعمدة الجديدة) ---
window.renderTable = function() {
    const { contracts, contractors, monthNames } = window.appData;
    const search = document.getElementById('searchBox').value.toLowerCase();
    const filter = document.getElementById('typeFilter').value;

    // Header
    const hRow = document.getElementById('headerRow');
    hRow.innerHTML = `
        <th class="sticky-col-1">الموقع / المستشفى</th>
        <th class="sticky-col-2">نوع العقد</th>
        <th class="sticky-col-3">المقاول</th>
        <th style="min-width:90px">البداية</th>
        <th style="min-width:90px">النهاية</th>
        <th style="min-width:100px">القيمة</th>
        <th style="min-width:50px">المتأخرات</th>
    `;
    monthNames.forEach(m => hRow.innerHTML += `<th style="min-width:110px">${m}</th>`);
    hRow.innerHTML += `<th style="min-width:200px">ملاحظات</th>`;

    // Body
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    Object.entries(contracts).map(([id, val])=>({...val, id})).forEach(row => {
        const cName = contractors[row.contractorId]?.name || "غير معروف";
        const txtMatch = row.hospital.toLowerCase().includes(search) || cName.toLowerCase().includes(search);
        const typeMatch = filter === 'all' || row.type === filter;

        if(txtMatch && typeMatch) {
            const tr = document.createElement('tr');
            tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
            
            const lateCount = (row.months||[]).filter(m => m.financeStatus === 'late').length;
            const badge = lateCount > 0 ? 'badge-red' : 'badge-green';

            // تنسيق العملة
            const formattedValue = row.value ? Number(row.value).toLocaleString() : '-';

            tr.innerHTML = `
                <td class="sticky-col-1">${row.hospital}</td>
                <td class="sticky-col-2" style="font-weight:bold; color:${row.type==='طبي'?'var(--primary)':'#d35400'}">${row.type}</td>
                <td class="sticky-col-3">${cName}</td>
                <td style="font-size:12px; color:#555;">${row.startDate || '-'}</td>
                <td style="font-size:12px; color:#555;">${row.endDate || '-'}</td>
                <td style="font-size:12px; font-weight:bold;">${formattedValue}</td>
                <td><span class="badge ${badge}">${lateCount}</span></td>
            `;

            (row.months||[]).forEach((m, idx) => {
                let icon='✘', cls='status-late', tit='لم يرفع';
                if(m.financeStatus === 'sent') { icon='✅'; cls='status-ok'; tit=`مطالبة: ${m.claimNum}\nخطاب: ${m.letterNum}\nتاريخ: ${m.submissionDate}`; }
                else if(m.financeStatus === 'returned') { icon='⚠️'; cls='status-returned'; tit=`إعادة: ${m.returnNotes}`; }
                
                tr.innerHTML += `<td class="${cls}" title="${tit}" onclick="handleCell('${row.id}', ${idx})">${icon}</td>`;
            });

            const editNote = canEdit(row.type) ? `onclick="editNote('${row.id}')"` : '';
            tr.innerHTML += `<td ${editNote} style="cursor:pointer; font-size:12px;">${row.notes||''}</td>`;
            tbody.appendChild(tr);
        }
    });
    updateStats();
};

window.handleCell = async function(cid, midx) {
    const c = window.appData.contracts[cid];
    if(!canEdit(c.type)) return;
    const mData = c.months[midx];
    const mName = window.appData.monthNames[midx];
    const curStatus = mData.financeStatus || 'late';

    const {value: v} = await Swal.fire({
        title: `${c.hospital} - ${mName}`,
        html: `
            <div style="text-align:right;">
                <label>رقم المطالبة</label><input id="sw-cl" class="swal2-input" value="${mData.claimNum||''}">
                <label>رقم الخطاب</label><input id="sw-le" class="swal2-input" value="${mData.letterNum||''}">
                <label>تاريخ الرفع</label><input id="sw-da" class="swal2-input" type="date" value="${mData.submissionDate||''}">
                <label>الحالة</label>
                <select id="sw-st" class="swal2-select">
                    <option value="late" ${curStatus==='late'?'selected':''}>لم يرفع (متأخر)</option>
                    <option value="sent" ${curStatus==='sent'?'selected':''}>تم الرفع للمالية</option>
                    <option value="returned" ${curStatus==='returned'?'selected':''}>إعادة للموقع</option>
                </select>
                <div id="note-area" style="display:${curStatus==='returned'?'block':'none'}">
                    <label style="color:orange">سبب الإعادة / ملاحظات</label>
                    <textarea id="sw-notes" class="swal2-textarea">${mData.returnNotes||''}</textarea>
                </div>
            </div>
        `,
        didOpen: () => document.getElementById('sw-status').addEventListener('change', (e) => document.getElementById('note-area').style.display = e.target.value==='returned'?'block':'none'),
        showCancelButton: true, confirmButtonText: 'حفظ',
        preConfirm: () => ({
            claimNum: document.getElementById('sw-cl').value,
            letterNum: document.getElementById('sw-le').value,
            submissionDate: document.getElementById('sw-da').value,
            financeStatus: document.getElementById('sw-st').value,
            returnNotes: document.getElementById('sw-notes').value
        })
    });

    if(v) {
        update(ref(db, `app_db_v2/contracts/${cid}/months/${midx}`), v).then(()=>showToast("تم التحديث"));
    }
};

window.editNote = async function(cid) {
    const {value:t} = await Swal.fire({title:'ملاحظات العقد', input:'textarea', inputValue:window.appData.contracts[cid].notes});
    if(t!==undefined) update(ref(db, `app_db_v2/contracts/${cid}`), {notes:t}).then(() => window.showToast("تم حفظ الملاحظة"));
};

// --- System ---
window.systemReset = async function() {
    if(!window.userRole || window.userRole !== 'super') return;
    if((await Swal.fire({title:'تهيئة كاملة؟', text:'سيتم مسح كل شيء!', icon:'warning', showCancelButton:true})).isConfirmed) {
        // إنشاء الشهور من بداية السنة
        const now = new Date();
        const mNames = [];
        const arM = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        // من يناير حتى الشهر الحالي
        for(let i=0; i<now.getMonth(); i++) mNames.push(`${arM[i]} ${now.getFullYear()}`);
        mNames.reverse();

        set(ref(db, 'app_db_v2'), { 
            monthNames: mNames,
            contractors: { "c1": { name: "شركة الخليجية" } }, contracts: {} 
        }).then(()=>location.reload());
    }
};

window.updateStats = function() {
    const cs = Object.values(window.appData.contracts);
    document.getElementById('countHospitals').innerText = new Set(cs.map(c=>c.hospital)).size;
    document.getElementById('countContractors').innerText = Object.keys(window.appData.contractors).length;
    document.getElementById('countContracts').innerText = cs.length;
    let l = 0; cs.forEach(c => c.months.forEach(m => {if(m.financeStatus==='late') l++}));
    document.getElementById('countLate').innerText = l;
};

window.adminLogin = async function() {
    const {value:p} = await Swal.fire({title:'كلمة المرور', input:'password'});
    if(p===window.appPasswords.super) window.userRole='super';
    else if(p===window.appPasswords.medical) window.userRole='medical';
    else if(p===window.appPasswords.non_medical) window.userRole='non_medical';
    else return Swal.fire('خطأ','','error');
    
    document.getElementById('loginSection').style.display='none';
    document.getElementById('adminControls').style.display='flex';
    document.getElementById('roleDisplay').innerText = window.userRole==='super' ? '(مدير عام)' : '(مشرف)';
    document.querySelectorAll('.super-admin-only').forEach(b => b.style.display = window.userRole==='super'?'inline-block':'none');
    window.renderTable();
};

function canEdit(type) {
    if(window.userRole === 'super') return true;
    if(window.userRole === 'medical' && type === 'طبي') return true;
    if(window.userRole === 'non_medical' && type === 'غير طبي') return true;
    return false;
}
