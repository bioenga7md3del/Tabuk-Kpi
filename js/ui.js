// js/ui.js

// --- 0. Print styles (بقية التنسيقات في style.css) ---
const style = document.createElement('style');
style.innerHTML = `
    @media print { 
        body * { visibility: hidden; } 
        #mainTable, #mainTable *, #printHeader, #printHeader * { visibility: visible; } 
        #printHeader { display: block !important; position: fixed; top: 0; left: 0; width: 100%; } 
        .table-wrapper { position: absolute; top: 120px; left: 0; width: 100%; overflow: visible !important; max-height: none !important; } 
        table { width: 100% !important; border-collapse: collapse; font-size: 10pt; } 
        th, td { border: 1px solid #000 !important; color: #000 !important; } 
        td, .pill { -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
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

// --- أيقونات (SVG) ---
const ICONS = {
    site: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    maint: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    returned: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    dash: '<line x1="6" y1="12" x2="18" y2="12"/>'
};
export function svg(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }

// أسماء الأشهر بالعربية + مساعد لمعرفة هل اسم شهر معين هو الشهر الجاري (لقفل التعديل فيه)
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export function isCurrentMonthName(name) {
    const now = new Date();
    return name === `${AR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

// --- مراحل المستخلص: مكانه الآن ---
// الترتيب: عند الموقع ← تحت المراجعة ← استلام شحنة ← مرفوع للمالية، والمرتجع يرجع للموقع بعد المراجعة
export const STAGES = {
    at_site:        { label: 'عند الموقع',        icon: 'site',    color: '#c2410c' },
    at_maintenance: { label: 'تحت المراجعة',      icon: 'eye',     color: '#1d5fa8' },
    received:       { label: 'تم استلام الشحنة',  icon: 'package', color: '#0f766e' },
    at_finance:     { label: 'مرفوع للمالية',     icon: 'check',   color: '#1a7f4b' },
    returned:       { label: 'مرتجع للموقع',      icon: 'returned', color: '#a16207' }
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
// ملاحظة: "استلام الشحنة" أصبحت قبل "الرفع للمالية"، فلا تُحتسب "مرفوعة" فعلاً
// إلا لو مرّت بالفعل بمرحلة "مرفوع للمالية" (نتأكد من ذلك عبر سجل الحركة، لتوافق البيانات القديمة)
export function deriveFinanceStatus(stage, history) {
    if (stage === 'at_finance') return 'sent';
    if (stage === 'received') {
        const hist = history ? Object.values(history) : [];
        return hist.some(h => h && h.to === 'at_finance') ? 'sent' : 'late';
    }
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
    const lines = [S.label];
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
    const chip = k => { const S = STAGES[k];
        return `<div class="stage-chip ${active === k ? 'active' : ''}" onclick="window.setStageFilter('${k}')">
            <span class="pill st-${k}">${svg(S.icon)}</span><span>${S.label}</span><b style="background:${S.color}">${counts[k]}</b></div>`; };
    const arrow = '<span class="stage-arrow">←</span>';
    box.innerHTML = `<span class="year-label">مسار المستخلص</span>` +
        ['at_site', 'at_maintenance', 'received', 'at_finance'].map(chip).join(arrow) +
        `<span class="stage-arrow" style="margin:0 8px">|</span>` + chip('returned');
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
    const pill = (cls, icon, label) => `<div class="legend-item"><span class="pill ${cls}">${svg(icon)}</span><span>${label}</span></div>`;
    div.innerHTML =
        Object.entries(STAGES).map(([k, S]) => pill('st-' + k, S.icon, S.label)).join('') +
        pill('st-late', 'x', 'لم يُرفع (متأخر)') + pill('st-pending', 'lock', 'الشهر الجاري (مقفل للتعديل)') +
        `<div style="flex-basis:100%;height:0"></div>` +
        `<div class="legend-item"><div class="legend-box" style="background:#fff3e0;border-bottom:3px solid #f2a65a"></div><span>فترة ختامية (آخر 5 شهور)</span></div>` +
        `<div class="legend-item"><div class="legend-box" style="background:#f6eefb;border-bottom:3px solid #a66bc4"></div><span>تمديد 10%</span></div>` +
        `<div class="legend-item"><div class="legend-box" style="background:#eaf3fd;border-bottom:3px solid #4f7aa8"></div><span>شراء مباشر</span></div>` +
        `<div class="legend-item"><div class="legend-box" style="background:#f8fafc;border:1px solid #e4e8ef"></div><span>قبل بداية العقد</span></div>`;
    table.parentNode.parentNode.insertBefore(div, table.parentNode.nextSibling);
}

// --- Render Table ---
export function renderTable(appData, userRole, canEditFunc, selectedYear) {
    const { contracts, contractors, monthNames } = appData;
    const sHosp = document.getElementById('searchHospital')?.value.trim().toLowerCase() || "";
    const sCont = document.getElementById('searchContractor')?.value.trim().toLowerCase() || "";
    const sClaim = document.getElementById('searchClaim')?.value.trim().toLowerCase() || "";
    const filter = document.getElementById('typeFilter')?.value || "all";
    const sStage = document.getElementById('stageFilter')?.value || "all";
    const tbody = document.getElementById('tableBody');
    const hRow = document.getElementById('headerRow');

    if (!tbody || !hRow) return;
    renderLegend();

    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const now = new Date(); const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthName = `${arMonths[now.getMonth()]} ${now.getFullYear()}`;

    const filteredColumns = []; 
    if (monthNames) monthNames.forEach((mName, i) => { if (mName.includes(selectedYear)) filteredColumns.push({ name: mName, index: i }); });

    let hHTML = `<th class="sticky-col-1">اسم العقد</th><th class="sticky-col-2">النوع</th><th class="sticky-col-3">المقاول</th><th style="min-width:56px">تأخير</th>`;
    if (filteredColumns.length > 0) filteredColumns.forEach(col => hHTML += `<th class="${col.name === currentMonthName ? 'th-current' : ''}" style="min-width:90px">${col.name}</th>`); else hHTML += `<th>-</th>`;
    hHTML += `<th style="min-width:160px">ملاحظات</th>`;
    hRow.innerHTML = hHTML;

    tbody.innerHTML = '';
    let rows = Object.entries(contracts).map(([id, val]) => ({...val, id}));

    if (userRole === 'medical') rows = rows.filter(r => r.type === 'طبي');
    if (userRole === 'non_medical') rows = rows.filter(r => r.type === 'غير طبي');

    const countEl = document.getElementById('resultCount');
    if (rows.length === 0) { tbody.innerHTML = `<tr><td colspan="15" class="empty-state">لا توجد عقود بعد</td></tr>`; if (countEl) countEl.innerText = ''; return []; }

    const filtered = rows.filter(r => {
        const cName = contractors[r.contractorId]?.name || "";
        const cTitle = r.contractName || r.hospital || "";
        const hasClaim = sClaim === "" || (r.months || []).some(m => m && [m.claimNum, m.extractNo, m.reviewerName].some(v => v && v.toString().toLowerCase().includes(sClaim)));
        const hasStage = sStage === "all" || yearCells(r, monthNames, selectedYear).some(m => getStage(m) === sStage);
        let showContract = true;
        if (r.startDate) { const startYear = new Date(r.startDate).getFullYear(); if (startYear > selectedYear) showContract = false; }
        return (cTitle).toLowerCase().includes(sHosp) && cName.toLowerCase().includes(sCont) && (filter === 'all' || r.type === filter) && hasClaim && hasStage && showContract;
    });

    if (countEl) countEl.innerText = `عرض ${filtered.length} من ${rows.length} عقد`;
    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="15" class="empty-state">لا توجد نتائج مطابقة للفلاتر — جرّب "مسح الفلاتر"</td></tr>`; return []; }

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
        
        const st = getContractStatus(row.startDate, row.endDate);
        const valFmt = row.value ? Number(row.value).toLocaleString() : '-';
        const contractTip = `رقم العقد: ${row.contractNumber||'-'}\nالقيمة: ${valFmt}\nالبداية: ${row.startDate||'-'}\nالنهاية: ${row.endDate||'-'}\nالحالة: ${st.text}`;

        const tr = document.createElement('tr');
        tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
        
        let html = `
            <td class="sticky-col-1">${esc(cTitle)}<div style="margin-top:3px"><span class="badge ${st.badge}" style="font-size:9.5px;">${st.text}</span></div></td>
            <td class="sticky-col-2" data-tip="${esc(contractTip)}" onmousemove="window.showTooltip(event, this.dataset.tip)" onmouseleave="window.hideTooltip()">
                <span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${esc(row.type)}</span>
            </td>
            <td class="sticky-col-3">${esc(cName)}</td>
            <td><span class="late-badge ${late > 0 ? 'some' : 'zero'}">${late}</span></td>
        `;

        if (filteredColumns.length > 0) {
            filteredColumns.forEach(col => {
                const originalIndex = col.index;
                const md = (row.months && row.months[originalIndex]) ? row.months[originalIndex] : {financeStatus:'late'};
                const [mAr, mYear] = col.name.split(' '); const mIdx = arMonths.indexOf(mAr);
                const cellDate = new Date(parseInt(mYear), mIdx, 1);
                
                const isBeforeContract = cellDate < contractStartDate;
                const isDirectPurchase = cellDate > extensionEndDate;
                const isDuringExtension = cellDate > contractEndDate && cellDate <= extensionEndDate;
                const isClosingPeriod = cellDate > closingPeriodStart && cellDate <= contractEndDate;
                const isCurrentMonth = cellDate.getTime() === currentMonthStart.getTime();

                let periodLabel = "";
                if (isDirectPurchase) periodLabel = "\n(شراء مباشر)";
                else if (isDuringExtension) periodLabel = "\n(فترة تمديد 10%)";
                else if (isClosingPeriod) periodLabel = "\n(فترة ختامية)";

                const stage = getStage(md);
                let pillCls = 'st-late', icon = 'x', sub = '', ti = 'لم يرفع' + periodLabel;
                if (stage) {
                    pillCls = 'st-' + stage; icon = STAGES[stage].icon;
                    sub = md.claimNum || md.extractNo || '';
                    ti = cellTip(md, stage) + periodLabel;
                } else if (isBeforeContract) {
                    pillCls = 'st-closed'; icon = 'dash'; ti = 'قبل بداية العقد (مغلق)';
                }
                if (isCurrentMonth) {
                    ti += (ti ? '\n' : '') + 'الشهر الجاري — القيد مقفل للتعديل حتى نهايته';
                    if (!sub) sub = 'مقفل';
                }

                const classes = ['cell'];
                if (isBeforeContract) classes.push('per-before');
                else if (isDirectPurchase) classes.push('per-direct');
                else if (isDuringExtension) classes.push('per-ext');
                else if (isClosingPeriod) classes.push('per-closing');
                if (isCurrentMonth) classes.push('cur-month');
                if (sClaim !== "" && [md.claimNum, md.extractNo, md.reviewerName].some(v => v && v.toString().toLowerCase().includes(sClaim))) classes.push('hl-claim');

                const canClick = (userRole !== 'viewer') && canEditFunc(userRole, row.type) && !isBeforeContract && !isCurrentMonth;
                if (canClick) classes.push('clickable');
                const outline = (sStage !== "all" && stage === sStage) ? ` style="box-shadow: inset 0 0 0 2px ${STAGES[sStage].color}"` : '';
                const clickAttr = canClick ? `onclick="window.handleKpiCell('${row.id}', ${originalIndex})"` : '';

                html += `<td class="${classes.join(' ')}"${outline} ${clickAttr} data-tip="${esc(ti)}" onmousemove="window.showTooltip(event, this.dataset.tip)" onmouseleave="window.hideTooltip()">` +
                        `<span class="pill ${pillCls}">${svg(icon)}</span>${sub ? `<span class="cell-sub">${esc(sub)}</span>` : ''}</td>`;
            });
        } else { html += `<td>-</td>`; }
        
        const canEditNote = (userRole !== 'viewer') && canEditFunc(userRole, row.type);
        html += `<td onclick="${canEditNote ? `window.editNote('${row.id}')` : ''}" style="cursor:${canEditNote?'pointer':'default'}; font-size:11.5px; text-align:right; color:#4a5568;">${esc(row.notes||'')}</td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
    return filtered;
}

// --- Render Cards ---
// شريط تقدم مدة العقد
function contractProgress(row) {
    if (!row.startDate || !row.endDate) return '';
    const s = new Date(row.startDate), e = new Date(row.endDate), t = new Date();
    if (!(e > s)) return '';
    const pct = Math.max(0, Math.min(100, Math.round(((t - s) / (e - s)) * 100)));
    const days = Math.ceil((e - t) / 86400000);
    const cls = days < 0 ? 'over' : (pct >= 85 ? 'warn' : '');
    const cap = days < 0 ? `انتهى منذ ${Math.abs(days)} يوم` : (t < s ? 'لم يبدأ بعد' : `متبقي ${days} يوم`);
    return `<div class="progress ${cls}"><i style="width:${pct}%"></i></div><div class="progress-cap"><span>${cap}</span><span>${pct}%</span></div>`;
}

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
            div.innerHTML = `<div class="card-header"><div><div class="card-title">${esc(row.contractName||row.hospital)}</div><span class="badge ${st.badge}" style="font-size:10px">${st.text}</span></div><span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span></div><div class="card-body"><div class="row"><span>المقاول:</span><b>${esc(cName)}</b></div><div class="row"><span>القيمة:</span><b>${valFmt}</b></div><div class="row"><span>البداية:</span><b>${row.startDate||'-'}</b></div><div class="row"><span>النهاية:</span><b>${row.endDate||'-'}</b></div>${contractProgress(row)}</div>
            <div class="card-actions" style="display:${actionDisplay}"><button class="btn-primary btn-sm" onclick="window.prepareEditContract('${id}')">تعديل</button><button class="btn-danger btn-sm" onclick="window.deleteContract('${id}')">حذف</button></div>`;
            grid.appendChild(div);
        });
    } else {
        Object.entries(appData.contractors).forEach(([id, row]) => {
            const div = document.createElement('div'); div.className = 'data-card';
            div.innerHTML = `<div class="card-header" style="border:none"><div class="card-title">${esc(row.name)}</div></div>
            <div class="card-actions" style="display:${actionDisplay}"><button class="btn-primary btn-sm" data-name="${esc(row.name)}" onclick="window.prepareEditContractor('${id}', this.dataset.name)">تعديل</button><button class="btn-danger btn-sm" onclick="window.deleteContractor('${id}')">حذف</button></div>`;
            grid.appendChild(div);
        });
    }
}

export function showToast(msg) { const t = document.getElementById("toast"); if(t) { t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 2500); } }
// تصدير تفصيلي: صف لكل عقد × شهر (للسنة المختارة) بكل بيانات المستخلص
export function exportToExcel(appData, userRole, selectedYear) {
    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const now = new Date(); const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const out = [];
    Object.values(appData.contracts).forEach(c => {
        if (userRole === 'medical' && c.type !== 'طبي') return;
        if (userRole === 'non_medical' && c.type !== 'غير طبي') return;
        const start = new Date(c.startDate); start.setDate(1); start.setHours(0,0,0,0);
        (appData.monthNames || []).forEach((mName, idx) => {
            if (!mName.includes(selectedYear)) return;
            const [mAr, mYear] = mName.split(' '); const cellDate = new Date(parseInt(mYear), arMonths.indexOf(mAr), 1);
            if (cellDate < start || cellDate > currentMonthStart) return;
            const md = (c.months && c.months[idx]) || {};
            const stage = getStage(md);
            out.push({
                'العقد': c.contractName || c.hospital || '',
                'النوع': c.type || '',
                'المقاول': appData.contractors[c.contractorId]?.name || '',
                'الشهر': mName,
                'المرحلة': stage ? STAGES[stage].label : (cellDate.getTime() === currentMonthStart.getTime() ? 'الشهر الجاري' : 'لم يُرفع'),
                'رقم المستخلص': md.extractNo || '',
                'رقم الشحنة (المطالبة)': md.claimNum || '',
                'رقم الفاتورة': md.invoiceNo || md.invoiceNum || '',
                'رقم الخطاب': md.letterNum || '',
                'المراجع': md.reviewerName || '',
                'ملاحظات / سبب الإعادة': md.returnNotes || '',
                'رابط المستند': md.docLink || '',
                'آخر تحديث': md.updatedAt ? new Date(md.updatedAt).toLocaleString('ar-SA') : '',
                'بواسطة': md.updatedBy || ''
            });
        });
    });
    if (!out.length) { showToast('لا توجد بيانات للتصدير'); return; }
    const ws = XLSX.utils.json_to_sheet(out);
    ws['!cols'] = [34, 10, 26, 14, 16, 16, 20, 16, 14, 18, 30, 30, 20, 14].map(w => ({ wch: w }));
    ws['!views'] = [{ rightToLeft: true }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "المستخلصات");
    XLSX.writeFile(wb, `تتبع_المستخلصات_${selectedYear}.xlsx`);
}
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

    const elHosp = document.getElementById('countHospitals'); if (elHosp) elHosp.innerText = new Set(rows.map(r => (r.contractName || r.hospital || '').trim()).filter(Boolean)).size;
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
