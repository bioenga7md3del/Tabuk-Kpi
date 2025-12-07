import { ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { db } from "./config.js";

// Global
window.appData = { contractors: {}, contracts: {}, monthNames: [] };
window.userRole = null;
window.appPasswords = { super: '1234', medical: '1111', non_medical: '2222' };
let myChart = null;

// --- Load Data ---
const dbRef = ref(db, 'app_db_v2'); 
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    const loader = document.getElementById('loader');
    const table = document.getElementById('mainTable');
    
    if (data) {
        window.appData.contractors = data.contractors || {};
        window.appData.contracts = data.contracts || {};
        window.appData.monthNames = data.monthNames || [];
        
        populateFilters(); // ملء قوائم الفلترة
        renderTable();
        
        if (loader) loader.style.display = 'none';
        if (table) table.style.display = 'table';
    } else {
        if (loader) loader.innerHTML = "النظام جديد. يرجى التهيئة.";
    }
});

onValue(ref(db, 'app_settings/passwords'), (s) => { if(s.exists()) window.appPasswords = s.val(); });

// --- Populating Filters (New Feature) ---
function populateFilters() {
    const hospitalSet = new Set();
    const contractorSet = new Set();
    
    Object.values(window.appData.contracts).forEach(c => {
        if(c.hospital) hospitalSet.add(c.hospital);
        const cName = window.appData.contractors[c.contractorId]?.name;
        if(cName) contractorSet.add(cName);
    });

    // Fill Hospital Dropdown
    const hospSelect = document.getElementById('filterHospital');
    const currentHosp = hospSelect.value;
    hospSelect.innerHTML = '<option value="all">كل المواقع</option>';
    hospitalSet.forEach(h => hospSelect.innerHTML += `<option value="${h}">${h}</option>`);
    hospSelect.value = currentHosp; // Keep selection if exists

    // Fill Contractor Dropdown
    const contSelect = document.getElementById('filterContractor');
    const currentCont = contSelect.value;
    contSelect.innerHTML = '<option value="all">كل المقاولين</option>';
    contractorSet.forEach(c => contSelect.innerHTML += `<option value="${c}">${c}</option>`);
    contSelect.value = currentCont;
}

// --- Render Table & Stats (Updated) ---
window.renderTable = function() {
    const { contracts, contractors, monthNames } = window.appData;
    
    // Get Filter Values
    const fHosp = document.getElementById('filterHospital').value;
    const fCont = document.getElementById('filterContractor').value;
    const fType = document.getElementById('filterType').value;

    const hRow = document.getElementById('headerRow');
    if(!hRow) return;

    hRow.innerHTML = `
        <th class="sticky-col-1">الموقع / المستشفى</th>
        <th class="sticky-col-2">النوع</th>
        <th class="sticky-col-3">المقاول</th>
        <th style="min-width:30px">تأخير</th>
    `;
    
    if (Array.isArray(monthNames) && monthNames.length > 0) {
        monthNames.forEach(m => hRow.innerHTML += `<th style="min-width:90px">${m}</th>`);
    } else {
        hRow.innerHTML += `<th style="background:var(--danger)">يرجى التحديث</th>`;
    }
    hRow.innerHTML += `<th style="min-width:150px">ملاحظات</th>`;

    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    // Filter Logic
    const filteredRows = Object.entries(contracts).map(([id, val])=>({...val, id})).filter(row => {
        const cName = contractors[row.contractorId]?.name || "";
        
        const matchHosp = fHosp === 'all' || row.hospital === fHosp;
        const matchCont = fCont === 'all' || cName === fCont;
        const matchType = fType === 'all' || row.type === fType;
        
        return matchHosp && matchCont && matchType;
    });

    // Render Rows
    filteredRows.forEach(row => {
        const cName = contractors[row.contractorId]?.name || "غير معروف";
        const tr = document.createElement('tr');
        tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
        
        const lateCount = (row.months||[]).filter(m => m.financeStatus === 'late').length;
        const badge = lateCount > 0 ? 'badge-red' : 'badge-green';
        
        let valFormatted = '-';
        if (row.value) try { valFormatted = Number(row.value).toLocaleString(); } catch(e) {}
        const details = `البداية: ${row.startDate||'-'}\nالنهاية: ${row.endDate||'-'}\nالقيمة: ${valFormatted}\nالرقم: ${row.contractNumber||'-'}`;

        tr.innerHTML = `
            <td class="sticky-col-1">${row.hospital}</td>
            <td class="sticky-col-2" title="${details}" style="cursor:help;">
                <span class="${row.type==='طبي' ? 'type-medical' : 'type-non-medical'}">${row.type}</span>
            </td>
            <td class="sticky-col-3">${cName}</td>
            <td><span class="badge ${badge}">${lateCount}</span></td>
        `;

        if (Array.isArray(monthNames) && monthNames.length > 0) {
            monthNames.forEach((mName, idx) => {
                const m = (row.months && row.months[idx]) ? row.months[idx] : {financeStatus: 'late'};
                
                let icon='✘', cls='status-late', tit='لم يرفع';
                if(m.financeStatus === 'sent') { icon='✅'; cls='status-ok'; tit=`مطالبة: ${m.claimNum||'-'}\nخطاب: ${m.letterNum||'-'}\nتاريخ: ${m.submissionDate||'-'}`; }
                else if(m.financeStatus === 'returned') { icon='⚠️'; cls='status-returned'; tit=`إعادة: ${m.returnNotes||'-'}`; }
                
                tr.innerHTML += `<td class="${cls}" title="${tit}" onclick="handleCell('${row.id}', ${idx})">${icon}</td>`;
            });
        } else { tr.innerHTML += `<td>-</td>`; }

        const editNote = canEdit(row.type) ? `onclick="editNote('${row.id}')"` : '';
        tr.innerHTML += `<td ${editNote} style="cursor:pointer; font-size:11px;">${row.notes||''}</td>`;
        tbody.appendChild(tr);
    });

    // Pass filtered rows to dashboard update
    updateDashboard(filteredRows);
};

// --- Dashboard Logic (Linked to Filters) ---
function updateDashboard(rows) {
    if(!rows) return;
    
    const uniqueHospitals = new Set(rows.map(r => r.name || r.hospital)).size;
    const totalLate = rows.reduce((sum, row) => sum + ((row.months||[]).filter(m => m.financeStatus === 'late').length), 0);
    
    // Total cells in current view
    const totalCells = rows.length * (window.appData.monthNames.length || 1);
    let totalSubmitted = 0;
    rows.forEach(r => { (r.months||[]).forEach(m => { if(m.financeStatus === 'sent') totalSubmitted++; }); });
    
    const compliance = totalCells > 0 ? Math.round((totalSubmitted / totalCells) * 100) : 0;

    document.getElementById('countHospitals').innerText = uniqueHospitals;
    document.getElementById('countContracts').innerText = rows.length;
    document.getElementById('countLate').innerText = totalLate;
    document.getElementById('complianceRate').innerText = compliance + "%";

    // Chart
    const ctx = document.getElementById('kpiChart').getContext('2d');
    const notSubmitted = totalCells - totalSubmitted;
    
    if(myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['مرفوع', 'متأخر/إعادة'],
            datasets: [{ data: [totalSubmitted, notSubmitted], backgroundColor: ['#27ae60', '#c0392b'], borderWidth: 0 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { position: 'bottom', labels: { font: { family: 'Tajawal', size: 10 } } } } 
        }
    });
}

// --- Excel Export (Linked to Filters) ---
window.exportToExcel = function() {
    const fHosp = document.getElementById('filterHospital').value;
    const fCont = document.getElementById('filterContractor').value;
    const fType = document.getElementById('filterType').value;
    const { contracts, contractors } = window.appData;

    const filteredRows = Object.values(contracts).filter(row => {
        const cName = contractors[row.contractorId]?.name || "";
        return (fHosp === 'all' || row.hospital === fHosp) &&
               (fCont === 'all' || cName === fCont) &&
               (fType === 'all' || row.type === fType);
    });

    const headers = ["الموقع", "النوع", "المقاول", "عدد المتأخرات", ...window.appData.monthNames, "ملاحظات"];
    const excelData = [headers];

    filteredRows.forEach(row => {
        const cName = contractors[row.contractorId]?.name || "";
        const late = (row.months||[]).filter(m=>m.financeStatus==='late').length;
        let rowData = [row.hospital, row.type, cName, late];
        
        (row.months||[]).forEach(m => {
            let cell = 'متأخر';
            if(m.financeStatus==='sent') cell = `تم (${m.letterNum})`;
            if(m.financeStatus==='returned') cell = `إعادة: ${m.returnNotes}`;
            rowData.push(cell);
        });
        rowData.push(row.notes);
        excelData.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI Report");
    XLSX.writeFile(wb, "Maintenance_Contracts_KPI.xlsx");
};

// --- Standard Functions (Login, Modals, etc.) ---
window.showToast = function(msg) {
    const t = document.getElementById("toast"); 
    if(t) { t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 2500); }
}

window.openModal = function(id) {
    document.getElementById(id).style.display = 'flex';
    if(id === 'contractorModal') renderContractorsList();
    if(id === 'contractModal') fillContractorSelect();
}
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; }

// Month Refresh
window.refreshMonthsSystem = async function() {
    if (!window.userRole || window.userRole !== 'super') return;
    if(!(await Swal.fire({title:'تحديث؟', icon:'warning', showCancelButton:true})).isConfirmed) return;
    const now = new Date();
    const arM = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    let mNames = [];
    for (let i = 0; i < now.getMonth(); i++) mNames.push(`${arM[i]} ${now.getFullYear()}`);
    mNames.reverse();
    const u = {'app_db_v2/monthNames': mNames};
    Object.entries(window.appData.contracts).forEach(([id, c]) => {
        const adj = new Array(mNames.length).fill(null).map((_,i) => (c.months||[])[i] || {status:"late", financeStatus:"late", claimNum:"", letterNum:"", submissionDate:"", returnNotes:""});
        u[`app_db_v2/contracts/${id}/months`] = adj;
    });
    update(ref(db), u).then(() => showToast("تم التحديث"));
};

// CRUD
window.saveNewContractor = function() {
    const name = document.getElementById('form-new-contractor').value;
    if(name) push(ref(db, 'app_db_v2/contractors'), {name}).then(()=>{ document.getElementById('form-new-contractor').value=''; renderContractorsList(); });
};
function renderContractorsList() {
    document.getElementById('contractorsList').innerHTML = Object.entries(window.appData.contractors).map(([id,v])=>`<div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:5px;"><span>${v.name}</span><button class="btn-red" style="padding:2px 5px;" onclick="deleteContractor('${id}')">x</button></div>`).join('');
}
window.deleteContractor = function(id) { remove(ref(db, `app_db_v2/contractors/${id}`)).then(()=>renderContractorsList()); }

function fillContractorSelect() {
    const s = document.getElementById('form-contractor');
    s.innerHTML = '<option value="">اختر...</option>';
    Object.entries(window.appData.contractors).forEach(([id,v])=> s.innerHTML+=`<option value="${id}">${v.name}</option>`);
}

window.saveNewContract = function() {
    const h=document.getElementById('form-hospital').value, t=document.getElementById('form-type').value, c=document.getElementById('form-contractor').value;
    if(!h||!c) return;
    const ms = Array(window.appData.monthNames.length).fill().map(()=>({status:"late", financeStatus:"late", claimNum:"", letterNum:"", submissionDate:"", returnNotes:""}));
    push(ref(db, 'app_db_v2/contracts'), {
        hospital:h, type:t, contractorId:c, 
        startDate:document.getElementById('form-start-date').value,
        endDate:document.getElementById('form-end-date').value,
        value:document.getElementById('form-value').value,
        contractNumber:document.getElementById('form-contract-num').value,
        months:ms, notes:""
    }).then(()=>{ closeModal('contractModal'); showToast("تم الحفظ"); });
};

window.handleCell = async function(cid, midx) {
    const c = window.appData.contracts[cid];
    if(!canEdit(c.type)) return;
    const m = c.months[midx];
    const {value:v} = await Swal.fire({
        title: 'تحديث الحالة',
        html: `<select id="sw-st" class="swal2-select"><option value="late" ${m.financeStatus==='late'?'selected':''}>متأخر</option><option value="sent" ${m.financeStatus==='sent'?'selected':''}>تم الرفع</option><option value="returned" ${m.financeStatus==='returned'?'selected':''}>إعادة</option></select><input id="sw-ln" class="swal2-input" placeholder="رقم الخطاب" value="${m.letterNum||''}"><input id="sw-cn" class="swal2-input" placeholder="رقم المطالبة" value="${m.claimNum||''}"><input id="sw-dt" class="swal2-input" type="date" value="${m.submissionDate||''}"><input id="sw-nt" class="swal2-input" placeholder="ملاحظات" value="${m.returnNotes||''}">`,
        preConfirm: () => ({ financeStatus:document.getElementById('sw-st').value, letterNum:document.getElementById('sw-ln').value, claimNum:document.getElementById('sw-cn').value, submissionDate:document.getElementById('sw-dt').value, returnNotes:document.getElementById('sw-nt').value })
    });
    if(v) update(ref(db, `app_db_v2/contracts/${cid}/months/${midx}`), v).then(()=>showToast("تم"));
};

window.editNote = async function(cid) {
    const {value:t} = await Swal.fire({input:'textarea', inputValue:window.appData.contracts[cid].notes});
    if(t!==undefined) update(ref(db, `app_db_v2/contracts/${cid}`), {notes:t});
}

window.adminLogin = async function() {
    const {value:p} = await Swal.fire({title:'كلمة المرور', input:'password'});
    if(p===window.appPasswords.super) window.userRole='super';
    else if(p===window.appPasswords.medical) window.userRole='medical';
    else if(p===window.appPasswords.non_medical) window.userRole='non_medical';
    if(window.userRole) {
        document.getElementById('loginSection').style.display='none';
        document.getElementById('adminControls').style.display='flex';
        document.querySelectorAll('.super-admin-only').forEach(b => b.style.display = window.userRole==='super'?'inline-block':'none');
        document.getElementById('roleDisplay').innerText = window.userRole;
        renderTable();
    }
};

window.systemReset = async function() {
    if(window.userRole!=='super')return;
    if((await Swal.fire({title:'مسح الكل؟', icon:'warning', showCancelButton:true})).isConfirmed) set(ref(db, 'app_db_v2'), {monthNames:[], contractors:{}, contracts:{}}).then(()=>location.reload());
};

function canEdit(type) {
    if(window.userRole==='super') return true;
    if(window.userRole==='medical' && type==='طبي') return true;
    if(window.userRole==='non_medical' && type==='غير طبي') return true;
    return false;
}
