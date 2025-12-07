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
        
        renderTable();
        updateStats();
        
        if (loader) loader.style.display = 'none';
        if (table) table.style.display = 'table';
    } else {
        if (loader) loader.innerHTML = "النظام جاهز. الرجاء تسجيل الدخول وتهيئة النظام.";
    }
});

onValue(ref(db, 'app_settings/passwords'), (s) => { if(s.exists()) window.appPasswords = s.val(); });

// --- Helper Functions ---
window.showToast = function(msg) {
    const t = document.getElementById("toast"); 
    if(t) { t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 2500); }
}

// --- Modals ---
window.openModal = function(id) {
    const m = document.getElementById(id); if(m) m.style.display = 'flex';
    if(id === 'contractorModal') renderContractorsList();
    if(id === 'contractModal') fillContractorSelect();
}
window.closeModal = function(id) {
    const m = document.getElementById(id); if(m) m.style.display = 'none';
}

// --- Month Logic ---
window.refreshMonthsSystem = async function() {
    if (!window.userRole || window.userRole !== 'super') return;
    if(!(await Swal.fire({title:'تحديث الجدول الزمني؟', text:'سيتم ضبط الأعمدة من يناير للسنة الحالية.', icon:'warning', showCancelButton:true})).isConfirmed) return;

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
        const adjustedMonths = new Array(newMonthNames.length).fill(null).map((_, idx) => {
            return currentMonths[idx] || { status: "late", financeStatus: "late", claimNum: "", letterNum: "", submissionDate: "", returnNotes: "" };
        });
        updates[`app_db_v2/contracts/${id}/months`] = adjustedMonths;
    });

    update(ref(db), updates).then(() => showToast("تم التحديث"));
};

// --- Contractors ---
window.saveNewContractor = function() {
    const name = document.getElementById('form-new-contractor').value;
    if(!name) return;
    push(ref(db, 'app_db_v2/contractors'), { name: name })
        .then(() => { 
            document.getElementById('form-new-contractor').value = ''; 
            renderContractorsList(); showToast("تمت الإضافة"); 
        });
};

function renderContractorsList() {
    const list = document.getElementById('contractorsList');
    if(!list) return;
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

// --- Contracts ---
function fillContractorSelect() {
    const sel = document.getElementById('form-contractor');
    if(!sel) return;
    sel.innerHTML = '<option value="">اختر المقاول...</option>';
    Object.entries(window.appData.contractors).forEach(([id, val]) => {
        sel.innerHTML += `<option value="${id}">${val.name}</option>`;
    });
}

window.saveNewContract = function() {
    const hosp = document.getElementById('form-hospital').value;
    const type = document.getElementById('form-type').value;
    const contId = document.getElementById('form-contractor').value;
    const contNum = document.getElementById('form-contract-num').value;
    const startDate = document.getElementById('form-start-date').value;
    const endDate = document.getElementById('form-end-date').value;
    const val = document.getElementById('form-value').value;

    if(!hosp || !contId) { Swal.fire('نقص بيانات','المستشفى والمقاول مطلوبان','error'); return; }

    const monthsCount = window.appData.monthNames ? window.appData.monthNames.length : 0;
    const emptyMonths = Array(monthsCount).fill().map(() => ({ 
        status: "late", financeStatus: "late", claimNum: "", letterNum: "", submissionDate: "", returnNotes: "" 
    }));

    const newContract = {
        hospital: hosp, type: type, contractorId: contId, contractNumber: contNum,
        startDate: startDate, endDate: endDate, value: val,
        months: emptyMonths, notes: ""
    };

    push(ref(db, 'app_db_v2/contracts'), newContract).then(() => {
        showToast("تم الحفظ"); closeModal('contractModal');
        document.getElementById('form-hospital').value = '';
        document.getElementById('form-contract-num').value = '';
        document.getElementById('form-value').value = '';
    });
};

// --- Table Rendering (تم حذف الأعمدة وإضافة التلميح) ---
window.renderTable = function() {
    const { contracts, contractors, monthNames } = window.appData;
    
    const searchHospEl = document.getElementById('searchHospital');
    const searchContEl = document.getElementById('searchContractor');
    if (!searchHospEl || !searchContEl) return;

    const searchHosp = searchHospEl.value.toLowerCase();
    const searchCont = searchContEl.value.toLowerCase();
    const filter = document.getElementById('typeFilter').value;

    const hRow = document.getElementById('headerRow');
    if(!hRow) return;

    // تم حذف أعمدة البداية والنهاية والقيمة من هنا
    hRow.innerHTML = `
        <th class="sticky-col-1">الموقع / المستشفى</th>
        <th class="sticky-col-2">نوع العقد</th>
        <th class="sticky-col-3">المقاول</th>
        <th style="min-width:50px">المتأخرات</th>
    `;
    
    if (Array.isArray(monthNames) && monthNames.length > 0) {
        monthNames.forEach(m => hRow.innerHTML += `<th style="min-width:110px">${m}</th>`);
    }
    
    hRow.innerHTML += `<th style="min-width:200px">ملاحظات</th>`;

    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    Object.entries(contracts).map(([id, val])=>({...val, id})).forEach(row => {
        const cName = contractors[row.contractorId]?.name || "غير معروف";
        const txtMatch = row.hospital.toLowerCase().includes(searchHosp) && cName.toLowerCase().includes(searchCont);
        const typeMatch = filter === 'all' || row.type === filter;

        if(txtMatch && typeMatch) {
            const tr = document.createElement('tr');
            tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
            
            const lateCount = (row.months||[]).filter(m => m.financeStatus === 'late').length;
            const badge = lateCount > 0 ? 'badge-red' : 'badge-green';
            
            // تجهيز نص التلميح (Tooltip)
            const formattedValue = row.value ? Number(row.value).toLocaleString() : '-';
            const contractDetails = `بداية العقد: ${row.startDate || '-'}\nنهاية العقد: ${row.endDate || '-'}\nالقيمة: ${formattedValue} ريال`;

            tr.innerHTML = `
                <td class="sticky-col-1">${row.hospital}</td>
                <td class="sticky-col-2" title="${contractDetails}" style="cursor:help;">
                    <span class="${row.type==='طبي' ? 'type-medical' : 'type-non-medical'}">${row.type}</span>
                </td>
                <td class="sticky-col-3">${cName}</td>
                <td><span class="badge ${badge}">${lateCount}</span></td>
            `;

            const rowMonths = row.months || [];
            if (Array.isArray(monthNames)) {
                monthNames.forEach((mName, idx) => {
                    const m = rowMonths[idx];
                    if (m) {
                        let icon='✘', cls='status-late', tit='لم يرفع';
                        if(m.financeStatus === 'sent') { icon='✅'; cls='status-ok'; tit=`مطالبة: ${m.claimNum}\nخطاب: ${m.letterNum}\nتاريخ: ${m.submissionDate}`; }
                        else if(m.financeStatus === 'returned') { icon='⚠️'; cls='status-returned'; tit=`إعادة: ${m.returnNotes}`; }
                        tr.innerHTML += `<td class="${cls}" title="${tit}" onclick="handleCell('${row.id}', ${idx})">${icon}</td>`;
                    } else {
                        tr.innerHTML += `<td>-</td>`;
                    }
                });
            }

            const editNote = canEdit(row.type) ? `onclick="editNote('${row.id}')"` : '';
            tr.innerHTML += `<td ${editNote} style="cursor:pointer; font-size:12px;">${row.notes||''}</td>`;
            tbody.appendChild(tr);
        }
    });
    updateStats();
};

// --- FIX: Cell Handling (التحديث وإغلاق النافذة) ---
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
                <select id="sw-status" class="swal2-select">
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
            financeStatus: document.getElementById('sw-status').value,
            returnNotes: document.getElementById('sw-notes').value
        })
    });

    if(v) {
        // تحديث الفيربيز
        update(ref(db, `app_db_v2/contracts/${cid}/months/${midx}`), v).then(() => {
            // **إصلاح هام:** تحديث البيانات المحلية وإعادة رسم الجدول فوراً ليظهر التغيير
            window.appData.contracts[cid].months[midx] = v;
            renderTable(); 
            showToast("تم تحديث الحالة بنجاح");
        });
    }
};

window.editNote = async function(cid) {
    const {value:t} = await Swal.fire({title:'ملاحظات العقد', input:'textarea', inputValue:window.appData.contracts[cid].notes});
    if(t!==undefined) update(ref(db, `app_db_v2/contracts/${cid}`), {notes:t}).then(() => window.showToast("تم حفظ الملاحظة"));
};

window.systemReset = async function() {
    if(!window.userRole || window.userRole !== 'super') return;
    if((await Swal.fire({title:'تهيئة؟', text:'سيتم مسح البيانات!', icon:'warning', showCancelButton:true})).isConfirmed) {
        set(ref(db, 'app_db_v2'), { monthNames:[], contractors:{}, contracts:{} }).then(()=>location.reload());
    }
};

window.updateStats = function() {
    const cs = Object.values(window.appData.contracts);
    document.getElementById('countHospitals').innerText = new Set(cs.map(c=>c.hospital)).size;
    document.getElementById('countContractors').innerText = Object.keys(window.appData.contractors).length;
    document.getElementById('countContracts').innerText = cs.length;
    let l = 0; cs.forEach(c => (c.months||[]).forEach(m => {if(m.financeStatus==='late') l++}));
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
    renderTable();
};

function canEdit(type) {
    if(window.userRole === 'super') return true;
    if(window.userRole === 'medical' && type === 'طبي') return true;
    if(window.userRole === 'non_medical' && type === 'غير طبي') return true;
    return false;
}
