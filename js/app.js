import { ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { db } from "./config.js";

// Global State
window.appData = { contractors: {}, contracts: {}, monthNames: [] };
window.userRole = null;
window.appPasswords = { super: '1234', medical: '1111', non_medical: '2222' };

// --- Init ---
const dbRef = ref(db, 'app_db_v2'); 
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    const loader = document.getElementById('loader');
    
    if (data) {
        window.appData.contractors = data.contractors || {};
        window.appData.contracts = data.contracts || {};
        window.appData.monthNames = data.monthNames || [];
        
        refreshAllViews();
        if (loader) loader.style.display = 'none';
        document.getElementById('mainTable').style.display = 'table';
    } else {
        if (loader) loader.innerHTML = "النظام جاهز. يرجى تهيئة النظام.";
    }
});

onValue(ref(db, 'app_settings/passwords'), (s) => { if(s.exists()) window.appPasswords = s.val(); });

// --- Navigation & View Logic ---
window.switchView = function(viewId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    // Highlight Nav
    if(viewId === 'dashboard-view') document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(viewId === 'contracts-view') document.querySelectorAll('.nav-item')[1].classList.add('active');
    if(viewId === 'contractors-view') document.querySelectorAll('.nav-item')[2].classList.add('active');
}

function refreshAllViews() {
    renderTable(); // KPI Table
    renderContractsCards(); // Contract Cards
    renderContractorsCards(); // Contractor Cards
    updateStats();
}

// --- Dashboard Render ---
window.renderTable = function() {
    const { contracts, contractors, monthNames } = window.appData;
    const searchHosp = document.getElementById('searchHospital').value.toLowerCase();
    const searchCont = document.getElementById('searchContractor').value.toLowerCase();
    const filter = document.getElementById('typeFilter').value;

    const hRow = document.getElementById('headerRow');
    hRow.innerHTML = `<th class="sticky-col-1">الموقع</th><th class="sticky-col-2">النوع</th><th class="sticky-col-3">المقاول</th><th style="min-width:40px">تأخير</th>`;
    if(monthNames.length) monthNames.forEach(m => hRow.innerHTML += `<th style="min-width:100px">${m}</th>`);
    else hRow.innerHTML += `<th>تحديث الشهور</th>`;
    hRow.innerHTML += `<th style="min-width:150px">ملاحظات</th>`;

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    Object.entries(contracts).map(([id, val])=>({...val, id})).forEach(row => {
        const cName = contractors[row.contractorId]?.name || "غير معروف";
        const match = row.hospital.toLowerCase().includes(searchHosp) && cName.toLowerCase().includes(searchCont) && (filter === 'all' || row.type === filter);

        if(match) {
            const tr = document.createElement('tr');
            tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
            const late = (row.months||[]).filter(m => m.financeStatus === 'late').length;
            const badge = late > 0 ? 'badge-red' : 'badge-green';
            let valFmt = row.value ? Number(row.value).toLocaleString() : '-';
            const tip = `البداية: ${row.startDate||'-'}\nالنهاية: ${row.endDate||'-'}\nالقيمة: ${valFmt}`;

            tr.innerHTML = `
                <td class="sticky-col-1">${row.hospital}</td>
                <td class="sticky-col-2" title="${tip}"><span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span></td>
                <td class="sticky-col-3">${cName}</td>
                <td><span class="badge ${badge}">${late}</span></td>
            `;

            if (monthNames.length) {
                monthNames.forEach((m, idx) => {
                    const md = (row.months && row.months[idx]) ? row.months[idx] : {financeStatus:'late'};
                    let ic='✘', cl='status-late', ti='لم يرفع';
                    if(md.financeStatus === 'sent') { ic='✅'; cl='status-ok'; ti=`مطالبة: ${md.claimNum||'-'}\nخطاب: ${md.letterNum||'-'}`; }
                    else if(md.financeStatus === 'returned') { ic='⚠️'; cl='status-returned'; ti=`إعادة: ${md.returnNotes||'-'}`; }
                    tr.innerHTML += `<td class="${cl}" title="${ti}" onclick="handleKpiCell('${row.id}', ${idx})">${ic}</td>`;
                });
            } else { tr.innerHTML += `<td>-</td>`; }

            const en = canEdit(row.type) ? `onclick="editNote('${row.id}')"` : '';
            tr.innerHTML += `<td ${en} style="cursor:pointer; font-size:11px;">${row.notes||''}</td>`;
            tbody.appendChild(tr);
        }
    });
};

// --- Contracts Management (Cards Layout) ---
function renderContractsCards() {
    const grid = document.getElementById('contractsGrid');
    grid.innerHTML = '';
    
    Object.entries(window.appData.contracts).forEach(([id, row]) => {
        const cName = window.appData.contractors[row.contractorId]?.name || "غير معروف";
        const valFmt = row.value ? Number(row.value).toLocaleString() : '-';
        
        const card = document.createElement('div');
        card.className = 'data-card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${row.hospital}</div>
                    <div class="card-subtitle">رقم العقد: ${row.contractNumber || '-'}</div>
                </div>
                <span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span>
            </div>
            <div class="card-body">
                <div class="card-row"><span class="card-label">المقاول:</span><span class="card-value">${cName}</span></div>
                <div class="card-row"><span class="card-label">القيمة:</span><span class="card-value">${valFmt} ريال</span></div>
                <div class="card-row"><span class="card-label">البداية:</span><span class="card-value">${row.startDate || '-'}</span></div>
                <div class="card-row"><span class="card-label">النهاية:</span><span class="card-value">${row.endDate || '-'}</span></div>
            </div>
            <div class="card-actions">
                <button class="btn-icon btn-primary" onclick="prepareEditContract('${id}')">✏️ تعديل</button>
                <button class="btn-icon btn-danger" onclick="deleteContract('${id}')">🗑 حذف</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- Contractors Management (Cards Layout) ---
function renderContractorsCards() {
    const grid = document.getElementById('contractorsGrid');
    grid.innerHTML = '';
    
    Object.entries(window.appData.contractors).forEach(([id, row]) => {
        const card = document.createElement('div');
        card.className = 'data-card';
        card.innerHTML = `
            <div class="card-header" style="border:none; margin:0; padding:0;">
                <div class="card-title">${row.name}</div>
            </div>
            <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;" class="card-actions">
                <button class="btn-icon btn-primary" onclick="prepareEditContractor('${id}', '${row.name}')">✏️ تعديل</button>
                <button class="btn-icon btn-danger" onclick="deleteContractor('${id}')">🗑 حذف</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- CRUD Functions ---
window.saveContract = function() {
    const id = document.getElementById('form-contract-id').value;
    const hosp = document.getElementById('form-hospital').value;
    const contId = document.getElementById('form-contractor').value;
    const type = document.getElementById('form-type').value;
    
    if(!hosp || !contId) { Swal.fire('نقص بيانات','المستشفى والمقاول مطلوبان','error'); return; }

    const data = {
        hospital: hosp, type: type, contractorId: contId,
        startDate: document.getElementById('form-start-date').value,
        endDate: document.getElementById('form-end-date').value,
        value: document.getElementById('form-value').value,
        contractNumber: document.getElementById('form-contract-num').value
    };

    if (id) { // Edit
        // Preserve existing months and notes
        const existing = window.appData.contracts[id];
        data.months = existing.months;
        data.notes = existing.notes;
        update(ref(db, `app_db_v2/contracts/${id}`), data).then(() => { showToast("تم التعديل"); closeModal('contractModal'); });
    } else { // New
        const mCount = window.appData.monthNames.length;
        data.months = Array(mCount).fill().map(() => ({ status: "late", financeStatus: "late", claimNum: "", letterNum: "", submissionDate: "", returnNotes: "" }));
        data.notes = "";
        push(ref(db, 'app_db_v2/contracts'), data).then(() => { showToast("تم الحفظ"); closeModal('contractModal'); });
    }
};

window.prepareEditContract = function(id) {
    const c = window.appData.contracts[id];
    fillContractorSelect();
    document.getElementById('form-contract-id').value = id;
    document.getElementById('form-hospital').value = c.hospital;
    document.getElementById('form-type').value = c.type;
    document.getElementById('form-contractor').value = c.contractorId;
    document.getElementById('form-start-date').value = c.startDate;
    document.getElementById('form-end-date').value = c.endDate;
    document.getElementById('form-value').value = c.value;
    document.getElementById('form-contract-num').value = c.contractNumber;
    openModal('contractModal');
};

window.saveContractor = function() {
    const id = document.getElementById('form-contractor-id').value;
    const name = document.getElementById('form-new-contractor').value;
    if(!name) return;

    if (id) update(ref(db, `app_db_v2/contractors/${id}`), {name}).then(() => { showToast("تم التعديل"); closeModal('contractorModal'); });
    else push(ref(db, 'app_db_v2/contractors'), {name}).then(() => { showToast("تم الحفظ"); closeModal('contractorModal'); });
};

window.prepareEditContractor = function(id, name) {
    document.getElementById('form-contractor-id').value = id;
    document.getElementById('form-new-contractor').value = name;
    openModal('contractorModal');
};

window.deleteContract = async function(id) {
    if ((await Swal.fire({title:'حذف العقد؟', icon:'warning', showCancelButton:true})).isConfirmed) {
        remove(ref(db, `app_db_v2/contracts/${id}`)).then(() => showToast("تم الحذف"));
    }
};

window.deleteContractor = function(id) {
    const has = Object.values(window.appData.contracts).some(c => c.contractorId === id);
    if(has) { Swal.fire('خطأ','المقاول مرتبط بعقود','error'); return; }
    remove(ref(db, `app_db_v2/contractors/${id}`));
};

// --- Helpers ---
window.openModal = function(id) {
    document.getElementById(id).style.display = 'flex';
    if(id === 'contractModal') fillContractorSelect();
    if(id === 'contractModal' && !document.getElementById('form-contract-id').value) {
        // Clear form for new entry
        document.getElementById('form-hospital').value = '';
        document.getElementById('form-contract-num').value = '';
        document.getElementById('form-value').value = '';
        document.getElementById('form-start-date').value = '';
        document.getElementById('form-end-date').value = '';
    }
    if(id === 'contractorModal' && !document.getElementById('form-contractor-id').value) {
        document.getElementById('form-new-contractor').value = '';
    }
};

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
    if(id==='contractModal') document.getElementById('form-contract-id').value = '';
    if(id==='contractorModal') document.getElementById('form-contractor-id').value = '';
};

function fillContractorSelect() {
    const s = document.getElementById('form-contractor');
    const curr = s.value;
    s.innerHTML = '<option value="">اختر...</option>';
    Object.entries(window.appData.contractors).forEach(([id,v])=> s.innerHTML+=`<option value="${id}">${v.name}</option>`);
    s.value = curr;
}

window.handleKpiCell = async function(cid, midx) {
    const c = window.appData.contracts[cid];
    if(!canEdit(c.type)) return;
    const m = c.months[midx];
    const {value:v} = await Swal.fire({
        title: 'تحديث الحالة',
        html: `<select id="sw-st" class="swal2-select"><option value="late" ${m.financeStatus==='late'?'selected':''}>متأخر</option><option value="sent" ${m.financeStatus==='sent'?'selected':''}>تم الرفع</option><option value="returned" ${m.financeStatus==='returned'?'selected':''}>إعادة</option></select><input id="sw-cn" class="swal2-input" placeholder="رقم المطالبة" value="${m.claimNum||''}"><input id="sw-ln" class="swal2-input" placeholder="رقم الخطاب" value="${m.letterNum||''}"><input id="sw-dt" class="swal2-input" type="date" value="${m.submissionDate||''}"><input id="sw-nt" class="swal2-input" placeholder="ملاحظات" value="${m.returnNotes||''}">`,
        preConfirm: () => ({ financeStatus:document.getElementById('sw-st').value, claimNum:document.getElementById('sw-cn').value, letterNum:document.getElementById('sw-ln').value, submissionDate:document.getElementById('sw-dt').value, returnNotes:document.getElementById('sw-nt').value })
    });
    if(v) update(ref(db, `app_db_v2/contracts/${cid}/months/${midx}`), v).then(()=>showToast("تم"));
};

window.editNote = async function(cid) {
    const {value:t} = await Swal.fire({input:'textarea', inputValue:window.appData.contracts[cid].notes});
    if(t!==undefined) update(ref(db, `app_db_v2/contracts/${cid}`), {notes:t});
}

// --- System & Auth ---
window.adminLogin = async function() {
    const {value:p} = await Swal.fire({title:'كلمة المرور', input:'password'});
    if(p===window.appPasswords.super) window.userRole='super';
    else if(p===window.appPasswords.medical) window.userRole='medical';
    else if(p===window.appPasswords.non_medical) window.userRole='non_medical';
    
    if(window.userRole) {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('dashboardControls').classList.remove('hidden');
        document.getElementById('loginBtn').classList.add('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.getElementById('roleDisplay').innerText = window.userRole==='super'?'(مدير عام)':'(مشرف)';
        
        document.querySelectorAll('.super-admin-only').forEach(b => b.style.display = window.userRole==='super'?'inline-block':'none');
        document.querySelectorAll('.restricted-tab').forEach(t => t.style.display = window.userRole==='super'?'block':'none');
        refreshAllViews();
    } else Swal.fire('خطأ','','error');
};

window.refreshMonthsSystem = async function() {
    if(!window.userRole) return;
    if(!(await Swal.fire({title:'تحديث الشهور؟', icon:'warning', showCancelButton:true})).isConfirmed) return;
    const now = new Date();
    const arM = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    let mNames = [];
    for(let i=0; i<now.getMonth(); i++) mNames.push(`${arM[i]} ${now.getFullYear()}`);
    mNames.reverse();
    const u = {'app_db_v2/monthNames': mNames};
    Object.entries(window.appData.contracts).forEach(([id, c]) => {
        const adj = new Array(mNames.length).fill(null).map((_,i) => (c.months||[])[i] || {status:"late", financeStatus:"late"});
        u[`app_db_v2/contracts/${id}/months`] = adj;
    });
    update(ref(db), u).then(() => showToast("تم التحديث"));
};

window.systemReset = async function() {
    if(window.userRole!=='super')return;
    if((await Swal.fire({title:'مسح الكل؟', icon:'warning', showCancelButton:true})).isConfirmed) set(ref(db, 'app_db_v2'), {monthNames:[], contractors:{}, contracts:{}}).then(()=>location.reload());
};

window.exportToExcel = function() {
    const ws = XLSX.utils.table_to_sheet(document.getElementById('mainTable'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI");
    XLSX.writeFile(wb, "KPI_Report.xlsx");
}

function updateStats() {
    const cs = Object.values(window.appData.contracts);
    document.getElementById('countHospitals').innerText = new Set(cs.map(c=>c.hospital)).size;
    document.getElementById('countContractors').innerText = Object.keys(window.appData.contractors).length;
    document.getElementById('countContracts').innerText = cs.length;
    let late = 0, total = cs.length * window.appData.monthNames.length;
    let submitted = 0;
    cs.forEach(c => (c.months||[]).forEach(m => {
        if(m.financeStatus==='late') late++;
        if(m.financeStatus==='sent') submitted++;
    }));
    document.getElementById('countLate').innerText = late;
    document.getElementById('complianceRate').innerText = total > 0 ? Math.round((submitted/total)*100)+'%' : '0%';
    
    const ctx = document.getElementById('kpiChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels:['مرفوع','متأخر'], datasets:[{data:[submitted, total-submitted], backgroundColor:['#27ae60','#c0392b']}] },
        options: { maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
    });
}

function canEdit(type) {
    if(window.userRole==='super') return true;
    if(window.userRole==='medical' && type==='طبي') return true;
    if(window.userRole==='non_medical' && type==='غير طبي') return true;
    return false;
}

window.showToast = function(msg) {
    const t = document.getElementById("toast"); t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 2500);
}
