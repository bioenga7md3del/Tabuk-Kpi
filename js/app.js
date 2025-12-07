import { ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { db } from "./config.js";

// --- الحالة العامة (Global State) ---
window.appData = { contractors: {}, contracts: {}, monthNames: [] };
window.userRole = null;
window.appPasswords = { super: '1234', medical: '1111', non_medical: '2222' };
let myChart = null;

// --- 1. تحميل البيانات من فيربيز ---
const dbRef = ref(db, 'app_db_v2'); 
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    const loader = document.getElementById('loader');
    const table = document.getElementById('mainTable');
    
    // إخفاء شاشة التحميل فوراً
    if (loader) loader.style.display = 'none';

    if (data) {
        window.appData.contractors = data.contractors || {};
        window.appData.contracts = data.contracts || {};
        window.appData.monthNames = data.monthNames || [];
        
        try {
            // تحديث العرض إذا كان هناك مستخدم مسجل أو للعرض العام
            renderTable();
            updateStats(); // تم تأمين هذه الدالة بالأسفل
            
            // تحديث كروت الإدارة فقط إذا لم يكن زائراً
            if (window.userRole && window.userRole !== 'viewer') {
                renderContractsCards();
                renderContractorsCards();
            }

            if (table) table.style.display = 'table';
        } catch (e) {
            console.error("خطأ في العرض:", e);
        }
    } else {
        // قاعدة بيانات جديدة
        window.appData = { contractors: {}, contracts: {}, monthNames: [] };
        if (table) table.style.display = 'table';
    }
}, (error) => {
    console.error("Firebase Error:", error);
    if(loader) loader.innerText = "خطأ في الاتصال";
});

// تحميل كلمات المرور
onValue(ref(db, 'app_settings/passwords'), (s) => { 
    if(s.exists()) window.appPasswords = s.val(); 
});

// --- 2. دوال التلميح العائم (Floating Tooltip Logic) ---
document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById('global-tooltip')) {
        const div = document.createElement('div');
        div.id = 'global-tooltip';
        div.style.position = 'fixed';
        div.style.background = 'rgba(44, 62, 80, 0.95)';
        div.style.color = '#fff';
        div.style.padding = '10px 15px';
        div.style.borderRadius = '8px';
        div.style.fontSize = '12px';
        div.style.zIndex = '9999';
        div.style.pointerEvents = 'none';
        div.style.display = 'none';
        div.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        div.style.whiteSpace = 'pre-line';
        document.body.appendChild(div);
    }
});

window.showTooltip = function(e, element) {
    const tooltip = document.getElementById('global-tooltip');
    const text = element.getAttribute('data-tip');
    
    if (tooltip && text) {
        tooltip.innerText = text;
        tooltip.style.display = 'block';
        let top = e.clientY + 15;
        let left = e.clientX + 15;

        if (left + 220 > window.innerWidth) {
            left = e.clientX - 225;
        }
        if (top + 100 > window.innerHeight) {
            top = e.clientY - 100;
        }

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
    }
};

window.hideTooltip = function() {
    const tooltip = document.getElementById('global-tooltip');
    if (tooltip) tooltip.style.display = 'none';
};

// --- 3. نظام التوجيه ---
window.switchView = function(viewId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(viewId);
    if(target) target.classList.add('active');
    
    const navMap = { 'dashboard-view': 0, 'contracts-view': 1, 'contractors-view': 2 };
    const navItems = document.querySelectorAll('.nav-item');
    if(navItems[navMap[viewId]]) navItems[navMap[viewId]].classList.add('active');
}

function refreshAllViews() {
    renderTable(); 
    updateStats();
    if (window.userRole !== 'viewer') {
        renderContractsCards(); 
        renderContractorsCards(); 
    }
}

// --- 4. رسم الجدول الرئيسي ---
window.renderTable = function() {
    const { contracts, contractors, monthNames } = window.appData;
    
    const searchHospEl = document.getElementById('searchHospital');
    if (!searchHospEl) return;

    const searchHosp = searchHospEl.value.toLowerCase();
    const searchCont = document.getElementById('searchContractor').value.toLowerCase();
    const filter = document.getElementById('typeFilter').value;

    const hRow = document.getElementById('headerRow');
    const tbody = document.getElementById('tableBody');
    if(!hRow || !tbody) return;

    // Header
    let headerHTML = `
        <th class="sticky-col-1">الموقع</th>
        <th class="sticky-col-2">النوع</th>
        <th class="sticky-col-3">المقاول</th>
        <th style="min-width:40px">تأخير</th>
    `;
    
    if (Array.isArray(monthNames) && monthNames.length > 0) {
        monthNames.forEach(m => headerHTML += `<th style="min-width:100px">${m}</th>`);
    } else {
        headerHTML += `<th>-</th>`;
    }
    
    headerHTML += `<th style="min-width:150px">ملاحظات</th>`;
    hRow.innerHTML = headerHTML;

    // Body
    tbody.innerHTML = '';
    const rowsArr = Object.entries(contracts).map(([id, val]) => ({...val, id}));

    if (rowsArr.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" style="padding:20px; color:#777;">لا توجد بيانات للعرض</td></tr>`;
        return;
    }

    rowsArr.forEach(row => {
        const cName = (contractors[row.contractorId]?.name) || "غير معروف";
        const hospName = row.hospital || "بدون اسم";
        
        const match = hospName.toLowerCase().includes(searchHosp) && 
                      cName.toLowerCase().includes(searchCont) && 
                      (filter === 'all' || row.type === filter);

        if(match) {
            const tr = document.createElement('tr');
            tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
            
            const late = (row.months||[]).filter(m => m && m.financeStatus === 'late').length;
            const badge = late > 0 ? 'badge-red' : 'badge-green';
            
            let valFmt = '-';
            if(row.value) valFmt = Number(row.value).toLocaleString();
            
            const tipData = `📄 رقم العقد: ${row.contractNumber || '-'}
💰 القيمة: ${valFmt} ريال
📅 البداية: ${row.startDate || '-'}
📅 النهاية: ${row.endDate || '-'}`;

            tr.innerHTML = `
                <td class="sticky-col-1">${hospName}</td>
                <td class="sticky-col-2" 
                    data-tip="${tipData}"
                    onmousemove="showTooltip(event, this)" 
                    onmouseleave="hideTooltip()"
                    style="cursor: help;">
                    <span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span>
                </td>
                <td class="sticky-col-3">${cName}</td>
                <td><span class="badge ${badge}">${late}</span></td>
            `;

            if (Array.isArray(monthNames) && monthNames.length > 0) {
                monthNames.forEach((mName, idx) => {
                    const md = (row.months && row.months[idx]) ? row.months[idx] : {financeStatus:'late'};
                    
                    let ic='✘', cl='status-late', ti='لم يرفع';
                    if(md.financeStatus === 'sent') { 
                        ic='✅'; cl='status-ok'; 
                        ti=`مطالبة: ${md.claimNum||'-'}\nخطاب: ${md.letterNum||'-'}\nتاريخ: ${md.submissionDate||'-'}`; 
                    }
                    else if(md.financeStatus === 'returned') { 
                        ic='⚠️'; cl='status-returned'; 
                        ti=`إعادة للموقع!\nالسبب: ${md.returnNotes||'-'}`; 
                    }
                    
                    tr.innerHTML += `<td class="${cl}" style="${canEdit(row.type)?'cursor:pointer':''}">
                        <div data-tip="${ti}" 
                             onmousemove="showTooltip(event, this)" 
                             onmouseleave="hideTooltip()"
                             onclick="handleKpiCell('${row.id}', ${idx})">
                            ${ic}
                        </div>
                    </td>`;
                });
            } else { 
                tr.innerHTML += `<td style="color:#999;">-</td>`; 
            }

            const en = canEdit(row.type) ? `onclick="editNote('${row.id}')"` : '';
            const noteCursor = canEdit(row.type) ? "cursor:pointer" : "cursor:default";
            tr.innerHTML += `<td ${en} style="${noteCursor}; font-size:11px;">${row.notes||''}</td>`;
            tbody.appendChild(tr);
        }
    });
    
    // تمرير الصفوف المفلترة لتحديث الإحصائيات بناءً عليها
    updateDashboard(rowsArr.filter(row => {
        const cName = (contractors[row.contractorId]?.name) || "";
        return row.hospital.toLowerCase().includes(searchHosp) && 
               cName.toLowerCase().includes(searchCont) && 
               (filter === 'all' || row.type === filter);
    }));
};

// --- 5. لوحة الإحصائيات (تحديث آمن) ---
function updateDashboard(rows) {
    if(!rows) return;
    
    const uniqueHospitals = new Set(rows.map(r => r.hospital)).size;
    const totalLate = rows.reduce((sum, row) => sum + ((row.months||[]).filter(m => m && m.financeStatus === 'late').length), 0);
    
    const totalCells = rows.length * (window.appData.monthNames.length || 1);
    let totalSubmitted = 0;
    rows.forEach(r => { (r.months||[]).forEach(m => { if(m && m.financeStatus === 'sent') totalSubmitted++; }); });
    
    const compliance = totalCells > 0 ? Math.round((totalSubmitted / totalCells) * 100) : 0;

    // Safety Checks: Only update if element exists
    const elHosp = document.getElementById('countHospitals'); if(elHosp) elHosp.innerText = uniqueHospitals;
    const elCont = document.getElementById('countContracts'); if(elCont) elCont.innerText = rows.length;
    const elLate = document.getElementById('countLate'); if(elLate) elLate.innerText = totalLate;
    const elComp = document.getElementById('complianceRate'); if(elComp) elComp.innerText = compliance + '%';

    const canvas = document.getElementById('kpiChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if(window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, {
            type: 'doughnut',
            data: { 
                labels: ['مرفوع', 'متأخر/إعادة'], 
                datasets: [{data: [totalSubmitted, (totalCells - totalSubmitted)], backgroundColor: ['#27ae60', '#c0392b'], borderWidth: 0}] 
            },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { family: 'Tajawal', size: 10 } } } } }
        });
    }
}

// دالة updateStats العامة للنداء من أماكن أخرى بأمان
window.updateStats = function() {
    // نستخدم نفس المنطق الموجود في updateDashboard ولكن على كل البيانات إذا لم يتم تمرير صفوف محددة
    if (window.appData && window.appData.contracts) {
        const allRows = Object.values(window.appData.contracts);
        updateDashboard(allRows);
    }
};


// --- 6. تسجيل الدخول ---
window.adminLogin = async function() {
    const { value: pass } = await Swal.fire({
        title: 'تسجيل الدخول',
        input: 'password',
        inputLabel: 'أدخل كلمة المرور (أو 0000 للمشاهدة)',
        confirmButtonText: 'دخول',
        confirmButtonColor: '#3498db'
    });

    if (!pass) return;

    const cleanPass = String(pass).trim();
    let roleName = "";

    if (cleanPass === '0000') { window.userRole = 'viewer'; roleName = "(زائر)"; } 
    else if (cleanPass == window.appPasswords.super) { window.userRole = 'super'; roleName = "(مدير عام)"; } 
    else if (cleanPass == window.appPasswords.medical) { window.userRole = 'medical'; roleName = "(مشرف طبي)"; } 
    else if (cleanPass == window.appPasswords.non_medical) { window.userRole = 'non_medical'; roleName = "(مشرف غير طبي)"; } 
    else { Swal.fire('خطأ', 'كلمة المرور غير صحيحة', 'error'); return; }

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardControls').classList.remove('hidden');
    document.getElementById('loginBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    
    if(document.getElementById('roleDisplay')) document.getElementById('roleDisplay').innerText = roleName;

    if (window.userRole === 'viewer') {
        document.querySelectorAll('.super-admin-only').forEach(b => b.style.display = 'none');
        document.querySelectorAll('.restricted-tab').forEach(t => t.style.display = 'none');
    } else {
        document.querySelectorAll('.super-admin-only').forEach(b => b.style.display = window.userRole === 'super' ? 'inline-block' : 'none');
        document.querySelectorAll('.restricted-tab').forEach(t => t.style.display = window.userRole === 'super' ? 'block' : 'none');
    }
    
    refreshAllViews();
    Swal.fire({ icon: 'success', title: 'تم الدخول', text: roleName, timer: 1500, showConfirmButton: false });
};

// --- 7. إدارة الكروت (Cards Management) ---
function renderContractsCards() {
    const grid = document.getElementById('contractsGrid');
    if(!grid) return; grid.innerHTML = '';
    
    Object.entries(window.appData.contracts).forEach(([id, row]) => {
        const cName = window.appData.contractors[row.contractorId]?.name || "غير معروف";
        const valFmt = row.value ? Number(row.value).toLocaleString() : '-';
        const card = document.createElement('div'); card.className = 'data-card';
        card.innerHTML = `
            <div class="card-header"><div><div class="card-title">${row.hospital}</div><div style="font-size:11px;color:#777">${row.contractNumber||'-'}</div></div><span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span></div>
            <div class="card-body">
                <div class="row"><span>المقاول:</span><b>${cName}</b></div>
                <div class="row"><span>القيمة:</span><b>${valFmt}</b></div>
                <div class="row"><span>النهاية:</span><b>${row.endDate||'-'}</b></div>
            </div>
            <div class="card-actions"><button class="btn-primary" onclick="prepareEditContract('${id}')">تعديل</button><button class="btn-danger" onclick="deleteContract('${id}')">حذف</button></div>
        `;
        grid.appendChild(card);
    });
}

function renderContractorsCards() {
    const grid = document.getElementById('contractorsGrid');
    if(!grid) return; grid.innerHTML = '';
    Object.entries(window.appData.contractors).forEach(([id, row]) => {
        const card = document.createElement('div'); card.className = 'data-card';
        card.innerHTML = `
            <div class="card-header" style="border:none;"><div class="card-title">${row.name}</div></div>
            <div class="card-actions"><button class="btn-primary" onclick="prepareEditContractor('${id}','${row.name}')">تعديل</button><button class="btn-danger" onclick="deleteContractor('${id}')">حذف</button></div>
        `;
        grid.appendChild(card);
    });
}

// --- 8. CRUD Operations ---
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

    if (id) { 
        const existing = window.appData.contracts[id];
        data.months = existing.months || []; data.notes = existing.notes || "";
        update(ref(db, `app_db_v2/contracts/${id}`), data).then(() => { showToast("تم التعديل"); closeModal('contractModal'); });
    } else { 
        const mCount = window.appData.monthNames ? window.appData.monthNames.length : 0;
        data.months = Array(mCount).fill().map(() => ({ status: "late", financeStatus: "late" }));
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

window.deleteContract = async function(id) {
    if((await Swal.fire({title:'حذف العقد؟', icon:'warning', showCancelButton:true})).isConfirmed) {
        remove(ref(db, `app_db_v2/contracts/${id}`)).then(() => showToast("تم الحذف"));
    }
};

window.saveContractor = function() {
    const id = document.getElementById('form-contractor-id').value;
    const name = document.getElementById('form-new-contractor').value;
    if(!name) return;
    if(id) update(ref(db, `app_db_v2/contractors/${id}`), {name}).then(()=>{showToast("تم"); closeModal('contractorModal');});
    else push(ref(db, 'app_db_v2/contractors'), {name}).then(()=>{showToast("تم"); closeModal('contractorModal');});
};

window.prepareEditContractor = function(id, name) {
    document.getElementById('form-contractor-id').value = id;
    document.getElementById('form-new-contractor').value = name;
    openModal('contractorModal');
};

window.deleteContractor = function(id) {
    const has = Object.values(window.appData.contracts).some(c => c.contractorId === id);
    if(has) { Swal.fire('خطأ','المقاول مرتبط بعقود','error'); return; }
    remove(ref(db, `app_db_v2/contractors/${id}`));
};

// --- 9. Workflow & Logic ---
window.handleKpiCell = async function(cid, midx) {
    if(!window.userRole || window.userRole === 'viewer') return;
    const c = window.appData.contracts[cid];
    if(!canEdit(c.type)) return;
    
    if(!c.months || !c.months[midx]) { showToast("حدث الشهور أولاً"); return; }
    const m = c.months[midx];
    const curStatus = m.financeStatus || 'late';

    const {value:v} = await Swal.fire({
        title: window.appData.monthNames[midx],
        html: `
            <select id="sw-st" class="form-control" onchange="document.getElementById('note-area').style.display = this.value==='returned'?'block':'none'">
                <option value="late" ${curStatus==='late'?'selected':''}>متأخر</option>
                <option value="sent" ${curStatus==='sent'?'selected':''}>تم الرفع</option>
                <option value="returned" ${curStatus==='returned'?'selected':''}>إعادة</option>
            </select>
            <input id="sw-cn" class="form-control" placeholder="رقم المطالبة" value="${m.claimNum||''}" style="margin-top:5px;">
            <input id="sw-ln" class="form-control" placeholder="رقم الخطاب" value="${m.letterNum||''}" style="margin-top:5px;">
            <input id="sw-dt" class="form-control" type="date" value="${m.submissionDate||''}" style="margin-top:5px;">
            
            <div id="note-area" style="display:${curStatus==='returned'?'block':'none'}; margin-top:5px;">
                <input id="sw-nt" class="form-control" placeholder="سبب الإعادة/ملاحظات" value="${m.returnNotes||''}">
            </div>
        `,
        preConfirm: () => ({ financeStatus:document.getElementById('sw-st').value, claimNum:document.getElementById('sw-cn').value, letterNum:document.getElementById('sw-ln').value, submissionDate:document.getElementById('sw-dt').value, returnNotes:document.getElementById('sw-nt').value })
    });
    
    if(v) {
        update(ref(db, `app_db_v2/contracts/${cid}/months/${midx}`), v).then(() => {
            window.appData.contracts[cid].months[midx] = v;
            renderTable(); showToast("تم");
        });
    }
};

window.editNote = async function(cid) {
    if(!window.userRole || window.userRole === 'viewer') return;
    if(!canEdit(window.appData.contracts[cid].type)) return;
    const {value:t} = await Swal.fire({input:'textarea', inputValue:window.appData.contracts[cid].notes});
    if(t!==undefined) update(ref(db, `app_db_v2/contracts/${cid}`), {notes:t});
}

// --- Helpers ---
window.refreshMonthsSystem = async function() {
    if(!window.userRole) return;
    if(!(await Swal.fire({title:'تحديث الشهور؟', text:'سيتم إنشاء الشهور من يناير للسنة الحالية.', icon:'warning', showCancelButton:true})).isConfirmed) return;
    
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
    if(window.userRole!=='super') return;
    if((await Swal.fire({title:'مسح الكل؟', text:'سيتم مسح جميع البيانات!', icon:'warning', showCancelButton:true})).isConfirmed) {
        set(ref(db, 'app_db_v2'), {monthNames:[], contractors:{}, contracts:{}});
        set(ref(db, 'app_settings/passwords'), { super: '1234', medical: '1111', non_medical: '2222' })
        .then(()=>location.reload());
    }
};

window.changePasswords = async function() {
    if (!window.userRole || window.userRole !== 'super') return;
    const { value: f } = await Swal.fire({
        title: 'تغيير كلمات المرور',
        html:
            '<label>المدير العام</label><input id="p1" class="swal2-input" value="' + window.appPasswords.super + '">' +
            '<label>مشرف طبي</label><input id="p2" class="swal2-input" value="' + window.appPasswords.medical + '">' +
            '<label>مشرف غير الطبي</label><input id="p3" class="swal2-input" value="' + window.appPasswords.non_medical + '">',
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'حفظ',
        preConfirm: () => ({ super: document.getElementById('p1').value, medical: document.getElementById('p2').value, non_medical: document.getElementById('p3').value })
    });
    if (f) {
        set(ref(db, 'app_settings/passwords'), f).then(() => { window.appPasswords = f; window.showToast('تم الحفظ'); });
    }
}

window.exportToExcel = function() {
    const ws = XLSX.utils.table_to_sheet(document.getElementById('mainTable'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI Report");
    XLSX.writeFile(wb, "KPI_Report.xlsx");
}

window.showToast = function(msg) {
    const t = document.getElementById("toast"); t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 2500);
}

function canEdit(type) {
    if(window.userRole==='viewer') return false;
    if(window.userRole==='super') return true;
    if(window.userRole==='medical' && type==='طبي') return true;
    if(window.userRole==='non_medical' && type==='غير طبي') return true;
    return false;
}

window.openModal = function(id) {
    document.getElementById(id).style.display = 'flex';
    if(id === 'contractModal') fillContractorSelect();
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
