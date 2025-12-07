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
        // حماية البيانات من الـ null
        window.appData.contractors = data.contractors || {};
        window.appData.contracts = data.contracts || {};
        window.appData.monthNames = data.monthNames || []; // مهم جداً: مصفوفة فارغة إذا لم توجد شهور
        
        renderTable();
        updateStats();
        
        if (loader) loader.style.display = 'none';
        if (table) table.style.display = 'table';
    } else {
        if (loader) loader.innerHTML = "قاعدة البيانات جديدة. يرجى تهيئة النظام وتسجيل الدخول.";
    }
});

onValue(ref(db, 'app_settings/passwords'), (s) => { if(s.exists()) window.appPasswords = s.val(); });

// --- Helpers ---
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
    if(!(await Swal.fire({title:'تحديث الجدول الزمني؟', text:'سيتم إنشاء الشهور من يناير للسنة الحالية.', icon:'warning', showCancelButton:true})).isConfirmed) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); 
    const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    let newMonthNames = [];

    // من يناير (0) إلى الشهر السابق (currentMonth - 1)
    // إذا كنا في يناير (0)، فلن يتم إنشاء شيء (وهذا صحيح)
    for (let i = 0; i < currentMonth; i++) {
        newMonthNames.push(`${arabicMonths[i]} ${currentYear}`);
    }
    newMonthNames.reverse(); // الأحدث أولاً

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

    // التحقق من وجود شهور، إذا لم توجد، ننشئ مصفوفة فارغة
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
        // Clear fields
        document.getElementById('form-hospital').value = '';
        document.getElementById('form-contract-num').value = '';
        document.getElementById('form-value').value = '';
    });
};

// --- Table Rendering (Safety Fixes) ---
window.renderTable = function() {
    const { contracts, contractors, monthNames } = window.appData;
    
    // Safety check for search elements
    const searchHospEl = document.getElementById('searchHospital');
    const searchContEl = document.getElementById('searchContractor');
    
    // If elements don't exist yet (DOM loading), exit
    if (!searchHospEl || !searchContEl) return;

    const searchHosp = searchHospEl.value.toLowerCase();
    const searchCont = searchContEl.value.toLowerCase();
    const filter = document.getElementById('typeFilter').value;

    const hRow = document.getElementById('headerRow');
    if(!hRow) return;

    // Build Header
    hRow.innerHTML = `
        <th class="sticky-col-1">الموقع / المستشفى</th>
        <th class="sticky-col-2">نوع العقد</th>
        <th class="sticky-col-3">المقاول</th>
        <th style="min-width:90px">البداية</th>
        <th style="min-width:90px">النهاية</th>
        <th style="min-width:100px">القيمة</th>
        <th style="min-width:50px">المتأخرات</th>
    `;
    
    // Check if monthNames exists and is array
    if (Array.isArray(monthNames) && monthNames.length > 0) {
        monthNames.forEach(m => hRow.innerHTML += `<th style="min-width:110px">${m}</th>`);
    } else {
        // If no months, maybe show a placeholder or nothing
        // This prevents the table from "crashing" visually
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

            // Ensure we handle case where row.months might be undefined or shorter than monthNames
            const rowMonths = row.months || [];
            
            // Loop based on monthNames to ensure columns align
            if (Array.isArray(monthNames)) {
                monthNames.forEach((mName, idx) => {
                    const m = rowMonths[idx];
                    if (m) {
                        let icon='✘', cls='status-late', tit='لم يرفع';
                        if(m.financeStatus === 'sent') { icon='✅'; cls='status-ok'; tit=`مطالبة: ${m.claimNum}\nخطاب: ${m.letterNum}\nتاريخ: ${m.submissionDate}`; }
                        else if(m.financeStatus === 'returned') { icon='⚠️'; cls='status-returned'; tit=`إعادة: ${m.returnNotes}`; }
                        tr.innerHTML += `<td class="${cls}" title="${tit}" onclick="handleCell('${row.id}', ${idx})">${icon}</td>`;
                    } else {
                        // Cell exists in header but data missing in row (safe fallback)
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

window.handleCell = async function(cid, midx) {
    const c = window.appData.contracts[cid];
    if(!canEdit(c.type)) return;
    const mData = c.months[midx];
    
    const {value: v} = await Swal.fire({
        title: 'بيانات المستخلص',
        html: `
            <input id="sw-cl" class="swal2-input" placeholder="رقم المطالبة" value="${mData.claimNum||''}">
            <input id="sw-le" class="swal2-input" placeholder="رقم الخطاب" value="${mData.letterNum||''}">
            <input id="sw-da" class="swal2-input" type="date" value="${mData.submissionDate||''}">
            <select id="sw-st" class="swal2-select">
                <option value="late" ${mData.financeStatus==='late'?'selected':''}>لم يرفع (متأخر)</option>
                <option value="sent" ${mData.financeStatus==='sent'?'selected':''}>تم الرفع للمالية</option>
                <option value="returned" ${mData.financeStatus==='returned'?'selected':''}>إعادة للموقع</option>
            </select>
            <input id="sw-no" class="swal2-input" placeholder="سبب الإعادة" value="${mData.returnNotes||''}">
        `,
        preConfirm: () => ({
            claimNum: document.getElementById('sw-cl').value,
            letterNum: document.getElementById('sw-le').value,
            submissionDate: document.getElementById('sw-date').value,
            financeStatus: document.getElementById('sw-st').value,
            returnNotes: document.getElementById('sw-no').value
        })
    });

    if(v) update(ref(db, `app_db_v2/contracts/${cid}/months/${midx}`), v).then(()=>showToast("تم"));
};

window.editNote = async function(cid) {
    const {value:t} = await Swal.fire({input:'textarea', inputValue:window.appData.contracts[cid].notes});
    if(t!==undefined) update(ref(db, `app_db_v2/contracts/${cid}`), {notes:t});
};

window.systemReset = async function() {
    if(!window.userRole || window.userRole !== 'super') return;
    if((await Swal.fire({title:'تهيئة؟', text:'سيتم مسح البيانات!', icon:'warning', showCancelButton:true})).isConfirmed) {
        set(ref(db, 'app_db_v2'), { monthNames:[], contractors:{}, contracts:{} }).then(()=>location.reload());
    }
};

window.updateStats = function() {
    const cs = Object.values(window.appData.contracts);
    const countHospitals = document.getElementById('countHospitals');
    if(countHospitals) countHospitals.innerText = new Set(cs.map(c=>c.hospital)).size;
    
    const countContractors = document.getElementById('countContractors');
    if(countContractors) countContractors.innerText = Object.keys(window.appData.contractors).length;
    
    const countContracts = document.getElementById('countContracts');
    if(countContracts) countContracts.innerText = cs.length;
    
    let l = 0; cs.forEach(c => (c.months||[]).forEach(m => {if(m.financeStatus==='late') l++}));
    const countLate = document.getElementById('countLate');
    if(countLate) countLate.innerText = l;
};

window.adminLogin = async function() {
    const {value:p} = await Swal.fire({title:'كلمة المرور', input:'password'});
    if(p===window.appPasswords.super) window.userRole='super';
    else if(p===window.appPasswords.medical) window.userRole='medical';
    else if(p===window.appPasswords.non_medical) window.userRole='non_medical';
    else return Swal.fire('خطأ','','error');
    
    document.getElementById('loginSection').style.display='none';
    document.getElementById('adminControls').style.display='flex';
    document.getElementById('roleDisplay').innerText = window.userRole;
    document.querySelectorAll('.super-admin-only').forEach(b => b.style.display = window.userRole==='super'?'inline-block':'none');
    renderTable();
};

function canEdit(type) {
    if(window.userRole === 'super') return true;
    if(window.userRole === 'medical' && type === 'طبي') return true;
    if(window.userRole === 'non_medical' && type === 'غير طبي') return true;
    return false;
}
