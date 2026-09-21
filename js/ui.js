// js/ui.js

// --- 0. Styles Injection ---
const style = document.createElement('style');
style.innerHTML = `
    .badge-purple { background-color: #9b59b6; color: white; }
    .badge-dark { background-color: #34495e; color: white; }
    #kpi-legend { display: flex; flex-wrap: wrap; gap: 20px; padding: 15px; background: #fff; border: 1px solid #eee; margin-top: 15px; margin-bottom: 30px; font-size: 13px; justify-content: center; border-radius: 8px; }
    .legend-item { display: flex; align-items: center; gap: 8px; font-weight: bold; color: #555; }
    .legend-box { width: 18px; height: 18px; border: 1px solid #ddd; border-radius: 4px; }
    .notif-item { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; color: #333; cursor: pointer; text-align: right;}
    .notif-item:hover { background: #f9f9f9; }
    .notif-urgent { border-right: 3px solid #e74c3c; } 
    .notif-warning { border-right: 3px solid #f39c12; }
    
    /* ستايل التلميح الذكي */
    #global-tooltip {
        position: fixed;
        background: rgba(44, 62, 80, 0.95);
        color: #fff;
        padding: 10px 15px;
        border-radius: 8px;
        font-size: 12px;
        z-index: 9999;
        pointer-events: none;
        display: none;
        white-space: pre-line;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        text-align: right;
        border: 1px solid rgba(255,255,255,0.1);
        line-height: 1.6;
    }

    @media print { 
        body * { visibility: hidden; } 
        #mainTable, #mainTable *, #printHeader, #printHeader * { visibility: visible; } 
        #printHeader { display: block !important; position: fixed; top: 0; left: 0; width: 100%; } 
        .table-wrapper { position: absolute; top: 120px; left: 0; width: 100%; overflow: visible !important; } 
        .navbar, .admin-panel, .toolbar-section, .card-actions, #loginScreen, .year-tabs-container, .nav-links { display: none !important; } 
        table { width: 100% !important; border-collapse: collapse; font-size: 10pt; } 
        th, td { border: 1px solid #000 !important; color: #000 !important; } 
        td { -webkit-print-color-adjust: exact; } 
    }
`;
document.head.appendChild(style);

// --- 1. Tooltip Logic ---
export function initTooltip() { 
    if (!document.getElementById('global-tooltip')) {
        const div = document.createElement('div'); 
        div.id = 'global-tooltip'; 
        document.body.appendChild(div);
    }
}

// دالة إظهار التلميح
window.showTooltip = function(e, text) { 
    const t = document.getElementById('global-tooltip'); 
    if (t && text) { 
        t.innerText = text; 
        t.style.display = 'block'; 
        
        // حساب المكان لضمان عدم خروجه من الشاشة
        let top = e.clientY + 15;
        let left = e.clientX + 15;
        if (left + 220 > window.innerWidth) left = e.clientX - 225; // إزاحة لليسار إذا كان في أقصى اليمين
        if (top + 150 > window.innerHeight) top = e.clientY - 150; // إزاحة للأعلى إذا كان في الأسفل

        t.style.top = top + 'px'; 
        t.style.left = left + 'px'; 
    } 
};

// دالة إخفاء التلميح
window.hideTooltip = function() { 
    const t = document.getElementById('global-tooltip'); 
    if (t) t.style.display = 'none'; 
};

// التأكد من تشغيل التلميح عند التحميل
initTooltip();

function getContractStatus(start, end) {
    if(!start || !end) return { text: "غير محدد", badge: "badge-grey" };
    const today = new Date(); today.setHours(0,0,0,0);
    const sDate = new Date(start); const eDate = new Date(end);
    const extensionEndDate = new Date(eDate); extensionEndDate.setMonth(extensionEndDate.getMonth() + 6);
    if (today < sDate) return { text: "لم يبدأ", badge: "badge-orange" };
    if (today <= eDate) {
        const diffDays = Math.ceil((eDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 365) return { text: "على وشك الانتهاء", badge: "badge-yellow" };
        return { text: "ساري", badge: "badge-green" };
    }
    if (today <= extensionEndDate) return { text: "تمديد 10%", badge: "badge-purple" };
    return { text: "شراء مباشر", badge: "badge-dark" };
}

// --- مراحل المستخلص: مكانه الآن ---
export const STAGES = {
    at_site:        { label: 'عند الموقع',        icon: '🏗️', cls: 'status-site',  color: '#e67e22' },
    at_maintenance: { label: 'في إدارة الصيانة',  icon: '🛠️', cls: 'status-maint', color: '#2980b9' },
    at_finance:     { label: 'مرفوع للمالية',     icon: '✅', cls: 'status-ok',    color: '#27ae60' },
    returned:       { label: 'مرتجع',             icon: '⚠️', cls: 'status-returned', color: '#f39c12' },
    received:       { label: 'تم استلام الشحنة',  icon: '📦', cls: 'status-recv',  color: '#16a085' }
};

// يقرأ مرحلة الخلية، مع دعم البيانات القديمة (financeStatus فقط)
export function getStage(md) {
    if (!md) return '';
    if (md.stage && STAGES[md.stage]) return md.stage;
    if (md.financeStatus === 'sent') return 'at_finance';
    if (md.financeStatus === 'returned') return 'returned';
    return '';
}

// financeStatus القديم يُشتق من المرحلة حتى تظل الإحصائيات والطباعة تعمل
export function deriveFinanceStatus(stage) {
    if (stage === 'at_finance' || stage === 'received') return 'sent';
    if (stage === 'returned') return 'returned';
    return 'late';
}

// حماية من كسر HTML / حقن أكواد في النصوص المدخلة
export function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function fmtDate(ts) {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
}

function cellTip(md, stage) {
    const S = STAGES[stage];
    const lines = [`${S.icon} ${S.label}`];
    if (md.extractNo) lines.push(`رقم المستخلص: ${md.extractNo}`);
    if (md.claimNum) lines.push(`رقم الشحنة/المطالبة: ${md.claimNum}`);
    if (md.invoiceNo) lines.push(`رقم الفاتورة: ${md.invoiceNo}`);
    if (md.letterNum) lines.push(`رقم الخطاب: ${md.letterNum}`);
    if (md.reviewerName) lines.push(`المراجع: ${md.reviewerName}`);
    if (stage === 'returned' && md.returnNotes) lines.push(`سبب الإعادة: ${md.returnNotes}`);
    if (md.updatedAt) lines.push(`آخر تحديث: ${fmtDate(md.updatedAt)}${md.updatedBy ? ' (' + md.updatedBy + ')' : ''}`);
    return lines.join('\n');
}

// خلايا العقد داخل السنة المختارة
function yearCells(row, monthNames, selectedYear) {
    const out = [];
    (monthNames || []).forEach((n, i) => { if (n.includes(selectedYear) && row.months && row.months[i]) out.push(row.months[i]); });
    return out;
}

// شريط ملخص المراحل (قابل للضغط للفلترة)
export function updateStageSummary(rows, appData, selectedYear) {
    const box = document.getElementById('stageSummary'); if (!box) return;
    const counts = {}; Object.keys(STAGES).forEach(k => counts[k] = 0);
    (rows || []).forEach(r => yearCells(r, appData.monthNames, selectedYear).forEach(m => { const st = getStage(m); if (st) counts[st]++; }));
    const active = document.getElementById('stageFilter')?.value || 'all';
    box.innerHTML = `<span class="year-label">أين المستخلصات الآن؟</span>` + Object.entries(STAGES).map(([k, S]) =>
        `<div class="stage-chip ${active === k ? 'active' : ''}" style="border-color:${S.color}" onclick="window.setStageFilter('${k}')">
            <span>${S.icon} ${S.label}</span><b style="background:${S.color}">${counts[k]}</b></div>`).join('');
}

export function renderYearTabs(contracts, selectedYear) {
    const container = document.getElementById('yearTabs'); if (!container) return;
    const currentYear = new Date().getFullYear(); let minYear = 2024;
    if (contracts) Object.values(contracts).forEach(c => { if (c.startDate) { const y = new Date(c.startDate).getFullYear(); if (y < minYear) minYear = y; } });
    const sortedYears = []; for (let y = minYear; y <= currentYear; y++) sortedYears.push(y);
    let html = `<span class="year-label">السنة المالية:</span>`;
    sortedYears.forEach(y => { html += `<div class="year-tab ${y==selectedYear?'active':''}" onclick="window.selectYear(${y})">${y}</div>`; });
    container.innerHTML = html;
}

function renderLegend() {
    const table = document.getElementById('mainTable'); if (!table || document.getElementById('kpi-legend')) return;
    const div = document.createElement('div'); div.id = 'kpi-legend';
    div.innerHTML = `<div class="legend-item"><div class="legend-box" style="background:#fff"></div><span>فترة أساسية</span></div><div class="legend-item"><div class="legend-box" style="background:#ffe0b2; border-color:#e67e22"></div><span>فترة ختامية (5 شهور)</span></div><div class="legend-item"><div class="legend-box" style="background:#f3e5f5; border-color:#9b59b6"></div><span>تمديد 10%</span></div><div class="legend-item"><div class="legend-box" style="background:#e3f2fd; border-color:#34495e"></div><span>شراء مباشر</span></div><div class="legend-item"><div class="legend-box" style="background:#f9f9f9"></div><span>ما قبل العقد (مغلق)</span></div><div style="flex-basis:100%;height:0"></div>${Object.values(STAGES).map(S => `<div class="legend-item"><span style="font-size:15px">${S.icon}</span><span>${S.label}</span></div>`).join('')}<div class="legend-item"><span style="font-size:15px;color:#c0392b">✘</span><span>لم يُرفع</span></div>`;
    table.parentNode.insertBefore(div, table.nextSibling);
}

// --- Render Table ---
export function renderTable(appData, userRole, canEditFunc, selectedYear) {
    const { contracts, contractors, monthNames } = appData;
    const sHosp = document.getElementById('searchHospital')?.value.toLowerCase() || "";
    const sCont = document.getElementById('searchContractor')?.value.toLowerCase() || "";
    const sClaim = document.getElementById('searchClaim')?.value.toLowerCase() || "";
    const filter = document.getElementById('typeFilter')?.value || "all";
    const sStage = document.getElementById('stageFilter')?.value || "all";
    const tbody = document.getElementById('tableBody');
    const hRow = document.getElementById('headerRow');

    if (!tbody || !hRow) return;
    renderLegend();

    const filteredColumns = []; 
    if (monthNames) monthNames.forEach((mName, i) => { if (mName.includes(selectedYear)) filteredColumns.push({ name: mName, index: i }); });

    let hHTML = `<th class="sticky-col-1">اسم العقد</th><th class="sticky-col-2">النوع</th><th class="sticky-col-3">المقاول</th><th style="min-width:40px">تأخير</th>`;
    if (filteredColumns.length > 0) filteredColumns.forEach(col => hHTML += `<th style="min-width:100px">${col.name}</th>`); else hHTML += `<th>-</th>`;
    hHTML += `<th style="min-width:150px">ملاحظات</th>`;
    hRow.innerHTML = hHTML;

    tbody.innerHTML = '';
    let rows = Object.entries(contracts).map(([id, val]) => ({...val, id}));

    if (userRole === 'medical') rows = rows.filter(r => r.type === 'طبي');
    if (userRole === 'non_medical') rows = rows.filter(r => r.type === 'غير طبي');

    if (rows.length === 0) { tbody.innerHTML = `<tr><td colspan="15" style="padding:20px;color:#777">لا توجد بيانات</td></tr>`; return []; }

    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const now = new Date(); const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = rows.filter(r => {
        const cName = contractors[r.contractorId]?.name || "";
        const cTitle = r.contractName || r.hospital || "";
        const hasClaim = sClaim === "" || (r.months || []).some(m => m && [m.claimNum, m.extractNo, m.reviewerName].some(v => v && v.toString().toLowerCase().includes(sClaim)));
        const hasStage = sStage === "all" || yearCells(r, monthNames, selectedYear).some(m => getStage(m) === sStage);
        let showContract = true;
        if (r.startDate) { const startYear = new Date(r.startDate).getFullYear(); if (startYear > selectedYear) showContract = false; }
        return (cTitle).toLowerCase().includes(sHosp) && cName.toLowerCase().includes(sCont) && (filter === 'all' || r.type === filter) && hasClaim && hasStage && showContract;
    });

    filtered.sort((a, b) => (a.contractName||a.hospital||"").localeCompare(b.contractName||b.hospital||"", 'ar'));

    filtered.forEach(row => {
        const cName = contractors[row.contractorId]?.name || "غير معروف";
        const cTitle = row.contractName || row.hospital || "بدون اسم";
        const contractStartDate = new Date(row.startDate); contractStartDate.setDate(1); contractStartDate.setHours(0,0,0,0);
        const contractEndDate = new Date(row.endDate); contractEndDate.setDate(1); contractEndDate.setHours(0,0,0,0);
        const closingPeriodStart = new Date(contractEndDate); closingPeriodStart.setMonth(closingPeriodStart.getMonth() - 5);
        const extensionEndDate = new Date(contractEndDate); extensionEndDate.setMonth(extensionEndDate.getMonth() + 6);

        let late = 0;
        if (row.months && monthNames) {
             row.months.forEach((m, idx) => {
                const mName = monthNames[idx]; if (!mName || !m) return;
                const [mAr, mYear] = mName.split(' '); const mIdx = arMonths.indexOf(mAr);
                if (mIdx > -1) {
                    const cellDate = new Date(parseInt(mYear), mIdx, 1);
                    const isEnded = cellDate < currentMonthStart;
                    if (cellDate >= contractStartDate && isEnded && m.financeStatus === 'late') {
                        late++;
                    }
                }
            });
        }
        
        const badge = late > 0 ? 'badge-red' : 'badge-green';
        const st = getContractStatus(row.startDate, row.endDate);
        const valFmt = row.value ? Number(row.value).toLocaleString() : '-';
        
        // --- 1. إعداد نص التلميح لنوع العقد ---
        const contractTip = `📄 رقم العقد: ${row.contractNumber||'-'}\n💰 القيمة: ${valFmt}\n⏳ المدة: ${row.duration||'-'}\n📅 البداية: ${row.startDate||'-'}\n📅 النهاية: ${row.endDate||'-'}\n📊 الحالة: ${st.text}`;

        const tr = document.createElement('tr');
        tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
        
        // تطبيق التلميح على خلية "النوع"
        tr.innerHTML = `
            <td class="sticky-col-1">${esc(cTitle)} <span class="badge ${st.badge}" style="font-size:9px;">${st.text}</span></td>
            <td class="sticky-col-2" data-tip="${esc(contractTip)}" onmousemove="window.showTooltip(event, this.dataset.tip)" onmouseleave="window.hideTooltip()" style="cursor:help">
                <span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span>
            </td>
            <td class="sticky-col-3">${esc(cName)}</td>
            <td><span class="badge ${badge}">${late}</span></td>
        `;

        if (filteredColumns.length > 0) {
            filteredColumns.forEach(col => {
                const originalIndex = col.index;
                const md = (row.months && row.months[originalIndex]) ? row.months[originalIndex] : {financeStatus:'late'};
                const mName = col.name;
                const [mAr, mYear] = mName.split(' '); const mIdx = arMonths.indexOf(mAr);
                const cellDate = new Date(parseInt(mYear), mIdx, 1);
                
                const isBeforeContract = cellDate < contractStartDate;
                const isDirectPurchase = cellDate > extensionEndDate;
                const isDuringExtension = cellDate > contractEndDate && cellDate <= extensionEndDate;
                const isClosingPeriod = cellDate > closingPeriodStart && cellDate <= contractEndDate;
                const isCurrentMonth = cellDate.getTime() === currentMonthStart.getTime();

                let ic='✘', cl='status-late';
                // --- 2. إعداد نص التلميح للشهر (المطالبة، الخطاب، الفترة) ---
                let ti = 'لم يرفع'; // النص الأساسي

                // تحديد نص الفترة
                let periodLabel = "";
                if (isDirectPurchase) periodLabel = "\n(شراء مباشر)";
                else if (isDuringExtension) periodLabel = "\n(فترة تمديد 10%)";
                else if (isClosingPeriod) periodLabel = "\n(فترة ختامية)";

                const stage = getStage(md);
                if (stage) {
                    ic = STAGES[stage].icon; cl = STAGES[stage].cls;
                    ti = cellTip(md, stage) + periodLabel;
                }
                else if (isBeforeContract) { 
                    ic='-'; cl=''; ti='قبل بداية العقد (مغلق)'; 
                }
                else if (isCurrentMonth) { 
                    ic='⏳'; cl=''; ti='الشهر الجاري (لم ينتهِ بعد)'; 
                }
                else {
                    ti += periodLabel; // متأخر
                }

                let highlightStyle = "";
                if (sClaim !== "" && [md.claimNum, md.extractNo, md.reviewerName].some(v => v && v.toString().toLowerCase().includes(sClaim))) {
                    highlightStyle = "border: 3px solid #0056b3 !important; background-color: #d6eaf8 !important; transform: scale(1.05); z-index: 100;";
                }

                if (sStage !== "all" && stage === sStage) highlightStyle += " outline: 3px solid " + STAGES[sStage].color + "; outline-offset:-3px;";
                let bgStyle = '';
                if (isBeforeContract) bgStyle = 'background:#f9f9f9; color:#ccc;';
                else if (isDirectPurchase) bgStyle = 'background:#e3f2fd; border-bottom: 2px solid #34495e;';
                else if (isDuringExtension) bgStyle = 'background:#f3e5f5; border-bottom: 2px solid #9b59b6;';
                else if (isClosingPeriod) bgStyle = 'background:#ffe0b2; border-bottom: 2px solid #e67e22;';

                const canClick = (userRole !== 'viewer') && canEditFunc(userRole, row.type) && !isBeforeContract;
                const clickAttr = canClick ? `onclick="window.handleKpiCell('${row.id}', ${originalIndex})"` : '';
                
                // تطبيق التلميح على الخلية باستخدام onmousemove
                tr.innerHTML += `<td class="${cl}" style="cursor:${canClick?'pointer':'default'}; ${bgStyle}; ${highlightStyle}" ${clickAttr} 
                    data-tip="${esc(ti)}" onmousemove="window.showTooltip(event, this.dataset.tip)" 
                    onmouseleave="window.hideTooltip()">
                    ${ic}
                </td>`;
            });
        } else { tr.innerHTML += `<td>-</td>`; }
        
        const canEditNote = (userRole !== 'viewer') && canEditFunc(userRole, row.type);
        tr.innerHTML += `<td onclick="${canEditNote ? `window.editNote('${row.id}')` : ''}" style="cursor:${canEditNote?'pointer':'default'}; font-size:11px;">${esc(row.notes||'')}</td>`;
        tbody.appendChild(tr);
    });
    return filtered;
}

// --- Render Cards ---
export function renderCards(appData, type) {
    const grid = document.getElementById(type === 'contract' ? 'contractsGrid' : 'contractorsGrid'); if (!grid) return;
    grid.innerHTML = '';
    
    const isViewer = (window.userRole === 'viewer');
    const actionDisplay = isViewer ? 'none' : 'flex';

    if (type === 'contract') {
        const fName = document.getElementById('filterContractName')?.value.toLowerCase() || "";
        const fStatus = document.getElementById('filterContractStatus')?.value || "all";
        let allContracts = Object.entries(appData.contracts);

        if (window.userRole === 'medical') allContracts = allContracts.filter(([, r]) => r.type === 'طبي');
        if (window.userRole === 'non_medical') allContracts = allContracts.filter(([, r]) => r.type === 'غير طبي');

        const filtered = allContracts.filter(([, row]) => {
            const name = row.contractName || row.hospital || "";
            const st = getContractStatus(row.startDate, row.endDate);
            const matchName = name.toLowerCase().includes(fName);
            let matchStatus = false;
            if (fStatus === 'all') matchStatus = true;
            else if (fStatus === 'active' && st.text === 'ساري') matchStatus = true;
            else if (fStatus === 'soon' && st.text === 'على وشك الانتهاء') matchStatus = true;
            else if (fStatus === 'expired' && st.text === 'منتهي') matchStatus = true;
            return matchName && matchStatus;
        });

        filtered.sort(([,a], [,b]) => (a.contractName||a.hospital||"").localeCompare(b.contractName||b.hospital||"", 'ar'));
        filtered.forEach(([id, row]) => {
            const cName = appData.contractors[row.contractorId]?.name || "-";
            const st = getContractStatus(row.startDate, row.endDate);
            const valFmt = row.value ? Number(row.value).toLocaleString() : '-';
            const div = document.createElement('div'); div.className = 'data-card';
            div.innerHTML = `<div class="card-header"><div><div class="card-title">${esc(row.contractName||row.hospital)}</div><span class="badge ${st.badge}" style="font-size:10px">${st.text}</span></div><span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span></div><div class="card-body"><div class="row"><span>المقاول:</span><b>${esc(cName)}</b></div><div class="row"><span>القيمة:</span><b>${valFmt}</b></div><div class="row"><span>النهاية:</span><b>${row.endDate||'-'}</b></div></div>
            <div class="card-actions" style="display:${actionDisplay}"><button class="btn-primary" onclick="window.prepareEditContract('${id}')">تعديل</button><button class="btn-danger" onclick="window.deleteContract('${id}')">حذف</button></div>`;
            grid.appendChild(div);
        });
    } else {
        Object.entries(appData.contractors).forEach(([id, row]) => {
            const div = document.createElement('div'); div.className = 'data-card';
            div.innerHTML = `<div class="card-header" style="border:none"><div class="card-title">${esc(row.name)}</div></div>
            <div class="card-actions" style="display:${actionDisplay}"><button class="btn-primary" data-name="${esc(row.name)}" onclick="window.prepareEditContractor('${id}', this.dataset.name)">تعديل</button><button class="btn-danger" onclick="window.deleteContractor('${id}')">حذف</button></div>`;
            grid.appendChild(div);
        });
    }
}

export function showToast(msg) { const t = document.getElementById("toast"); if(t) { t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 2500); } }
export function exportToExcel() { const ws = XLSX.utils.table_to_sheet(document.getElementById('mainTable')); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "KPI"); XLSX.writeFile(wb, "KPI_Report.xlsx"); }
export function toggleNotifications() { const menu = document.getElementById('notifDropdown'); menu.style.display = (menu.style.display === 'none') ? 'block' : 'none'; }
export function printReport() { const d = new Date(); document.getElementById('printDate').innerText = d.toLocaleDateString('ar-SA'); window.print(); }

export function updateStats(rows, appData, selectedYear) {
    if (!rows || !appData) return;
    let totalLate = 0, totalSubmitted = 0, effectiveTotalCells = 0;
    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const now = new Date(); const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    rows.forEach(r => {
        const contractStartDate = new Date(r.startDate); contractStartDate.setDate(1); contractStartDate.setHours(0,0,0,0);
        if (r.months) {
            appData.monthNames.forEach((mName, idx) => {
                 if (mName.includes(selectedYear)) {
                    const [mAr, mYear] = mName.split(' '); const mIdx = arMonths.indexOf(mAr);
                    const cellDate = new Date(parseInt(mYear), mIdx, 1);
                    const isEnded = cellDate < currentMonthStart;
                    if (cellDate >= contractStartDate && isEnded) {
                        effectiveTotalCells++;
                        const m = r.months[idx];
                        if (m) { if (m.financeStatus === 'late') totalLate++; if (m.financeStatus === 'sent') totalSubmitted++; }
                    } else if (cellDate >= contractStartDate && !isEnded) {
                         const m = r.months[idx]; if (m && m.financeStatus === 'sent') { effectiveTotalCells++; totalSubmitted++; }
                    }
                 }
            });
        }
    });

    let active = 0, expired = 0;
    rows.forEach(r => { const st = getContractStatus(r.startDate, r.endDate); if(st.text.includes('ساري') || st.text.includes('تمديد') || st.text.includes('وشك')) active++; else expired++; });

    const elHosp = document.getElementById('countHospitals'); if (elHosp) elHosp.innerText = new Set(rows.map(r=>r.hospital)).size;
    const elCont = document.getElementById('countContracts'); if (elCont) elCont.innerText = rows.length;
    const elLate = document.getElementById('countLate'); if (elLate) elLate.innerText = totalLate;
    const elActive = document.getElementById('countActive'); if (elActive) elActive.innerText = active;
    const elExpired = document.getElementById('countExpired'); if (elExpired) elExpired.innerText = expired;
    const elComp = document.getElementById('complianceRate'); if(elComp) elComp.innerText = effectiveTotalCells > 0 ? Math.round((totalSubmitted/effectiveTotalCells)*100)+'%' : '0%';
    const ctx = document.getElementById('kpiChart')?.getContext('2d');
    if (ctx) { if(window.myChart) window.myChart.destroy(); window.myChart = new Chart(ctx, { type: 'doughnut', data: { labels:['مرفوع','متأخر'], datasets:[{data:[totalSubmitted, effectiveTotalCells-totalSubmitted], backgroundColor:['#27ae60','#c0392b']}] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } }); }
}

export function checkNotifications(contracts) {
    const list = document.getElementById('notifList'); const badge = document.getElementById('notifBadge');
    if (!list || !badge) return;
    list.innerHTML = ''; let count = 0; const today = new Date(); today.setHours(0,0,0,0);
    Object.values(contracts).forEach(c => {
        if (window.userRole === 'medical' && c.type !== 'طبي') return;
        if (window.userRole === 'non_medical' && c.type !== 'غير طبي') return;

        if (!c.endDate) return;
        const eDate = new Date(c.endDate); const diffDays = Math.ceil((eDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 90) { count++; list.innerHTML += `<div class="notif-item notif-urgent"><strong>⏳ قرب انتهاء:</strong> ${c.contractName || c.hospital}<br><span style="color:gray">باقي ${diffDays} يوم.</span></div>`; }
        const extEndDate = new Date(eDate); extEndDate.setMonth(extEndDate.getMonth() + 6);
        if (today > eDate && today <= extEndDate) { count++; list.innerHTML += `<div class="notif-item notif-warning"><strong>📈 تمديد:</strong> ${c.contractName || c.hospital}<br><span style="color:gray">فترة 10%</span></div>`; }
    });
    if (count > 0) { badge.innerText = count; badge.style.display = 'block'; } else { badge.style.display = 'none'; list.innerHTML = `<div style="padding:15px; text-align:center; color:#777">لا توجد تنبيهات</div>`; }
}
