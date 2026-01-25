// js/ui.js

// --- 0. إضافة ألوان جديدة (CSS Injection) ---
const style = document.createElement('style');
style.innerHTML = `
  .badge-purple { background-color: #9b59b6; color: white; } /* شارة تمديد */
  .badge-dark { background-color: #34495e; color: white; }   /* شارة شراء مباشر */
`;
document.head.appendChild(style);


// --- 1. Tooltip ---
export function initTooltip() {
    if (!document.getElementById('global-tooltip')) {
        const div = document.createElement('div');
        div.id = 'global-tooltip';
        div.style.cssText = "position:fixed; background:rgba(44,62,80,0.95); color:#fff; padding:10px 15px; border-radius:8px; font-size:12px; z-index:9999; pointer-events:none; display:none; white-space:pre-line; box-shadow:0 4px 15px rgba(0,0,0,0.3); text-align:right; border:1px solid rgba(255,255,255,0.1);";
        document.body.appendChild(div);
    }
}
export function showTooltip(e, text) {
    const t = document.getElementById('global-tooltip');
    if (t && text) {
        t.innerText = text; t.style.display = 'block';
        let top = e.clientY + 15, left = e.clientX + 15;
        if (left + 220 > window.innerWidth) left = e.clientX - 225;
        if (top + 100 > window.innerHeight) top = e.clientY - 100;
        t.style.top = top + 'px'; t.style.left = left + 'px';
    }
}
export function hideTooltip() { const t = document.getElementById('global-tooltip'); if (t) t.style.display = 'none'; }

// --- 2. Contract Status (المنطق الزمني: ساري / تمديد / شراء مباشر) ---
function getContractStatus(start, end) {
    if(!start || !end) return { text: "غير محدد", badge: "badge-grey" };
    
    const today = new Date(); today.setHours(0,0,0,0);
    const sDate = new Date(start); 
    const eDate = new Date(end);
    
    // تاريخ نهاية التمديد (6 أشهر)
    const extensionEndDate = new Date(eDate);
    extensionEndDate.setMonth(extensionEndDate.getMonth() + 6);

    // 1. لم يبدأ
    if (today < sDate) return { text: "لم يبدأ", badge: "badge-orange" };
    
    // 2. ساري (الفترة الأصلية)
    if (today <= eDate) {
        const diffTime = eDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 365) return { text: "على وشك الانتهاء", badge: "badge-yellow" };
        return { text: "ساري", badge: "badge-green" };
    }
    
    // 3. فترة التمديد (بعد النهاية وحتى 6 أشهر)
    if (today <= extensionEndDate) {
        return { text: "تمديد 10%", badge: "badge-purple" };
    }

    // 4. شراء مباشر (بعد التمديد)
    return { text: "شراء مباشر", badge: "badge-dark" };
}

// --- 3. Render Year Tabs ---
export function renderYearTabs(contracts, selectedYear) {
    const container = document.getElementById('yearTabs');
    if (!container) return;

    const currentYear = new Date().getFullYear();
    let minYear = 2024; 

    if (contracts) {
        Object.values(contracts).forEach(c => {
            if (c.startDate) {
                const y = new Date(c.startDate).getFullYear();
                if (y < minYear) minYear = y;
            }
        });
    }

    const sortedYears = [];
    for (let y = minYear; y <= currentYear; y++) {
        sortedYears.push(y);
    }

    let html = `<span class="year-label">السنة المالية:</span>`;
    sortedYears.forEach(y => {
        const activeClass = (y == selectedYear) ? 'active' : '';
        html += `<div class="year-tab ${activeClass}" onclick="window.selectYear(${y})">${y}</div>`;
    });

    container.innerHTML = html;
    container.style.display = 'flex';
}

// --- 4. Render Table (الجدول مع التمييز اللوني) ---
export function renderTable(appData, userRole, canEditFunc, selectedYear) {
    const { contracts, contractors, monthNames } = appData;
    const sHosp = document.getElementById('searchHospital')?.value.toLowerCase() || "";
    const sCont = document.getElementById('searchContractor')?.value.toLowerCase() || "";
    const sClaim = document.getElementById('searchClaim')?.value.toLowerCase() || "";
    const filter = document.getElementById('typeFilter')?.value || "all";
    const tbody = document.getElementById('tableBody');
    const hRow = document.getElementById('headerRow');

    if (!tbody || !hRow) return;

    const filteredColumns = []; 
    if (monthNames && monthNames.length) {
        monthNames.forEach((mName, originalIndex) => {
            if (mName.includes(selectedYear)) filteredColumns.push({ name: mName, index: originalIndex });
        });
    }

    let hHTML = `<th class="sticky-col-1">اسم العقد</th><th class="sticky-col-2">النوع</th><th class="sticky-col-3">المقاول</th><th style="min-width:40px">تأخير</th>`;
    if (filteredColumns.length > 0) filteredColumns.forEach(col => hHTML += `<th style="min-width:100px">${col.name}</th>`);
    else hHTML += `<th>-</th>`;
    hHTML += `<th style="min-width:150px">ملاحظات</th>`;
    hRow.innerHTML = hHTML;

    tbody.innerHTML = '';
    const rows = Object.entries(contracts).map(([id, val]) => ({...val, id}));
    if (rows.length === 0) { tbody.innerHTML = `<tr><td colspan="15" style="padding:20px;color:#777">لا توجد بيانات</td></tr>`; return []; }

    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = rows.filter(r => {
        const cName = contractors[r.contractorId]?.name || "";
        const cTitle = r.contractName || r.hospital || "";
        const hasClaim = sClaim === "" || (r.months || []).some(m => m.claimNum && m.claimNum.toLowerCase().includes(sClaim));
        
        let showContract = true;
        if (r.startDate) {
            const startYear = new Date(r.startDate).getFullYear();
            if (startYear > selectedYear) showContract = false;
        }

        return (cTitle).toLowerCase().includes(sHosp) && cName.toLowerCase().includes(sCont) && (filter === 'all' || r.type === filter) && hasClaim && showContract;
    });

    filtered.sort((a, b) => (a.contractName||a.hospital||"").localeCompare(b.contractName||b.hospital||"", 'ar'));

    filtered.forEach(row => {
        const cName = contractors[row.contractorId]?.name || "غير معروف";
        const cTitle = row.contractName || row.hospital || "بدون اسم";
        
        // حساب التواريخ الفاصلة
        const contractStartDate = new Date(row.startDate);
        contractStartDate.setDate(1); contractStartDate.setHours(0,0,0,0);
        
        const contractEndDate = new Date(row.endDate);
        contractEndDate.setDate(1); contractEndDate.setHours(0,0,0,0);

        const extensionEndDate = new Date(contractEndDate);
        extensionEndDate.setMonth(extensionEndDate.getMonth() + 6); // نهاية التمديد

        let late = 0;
        if (row.months && monthNames) {
            row.months.forEach((m, idx) => {
                const mName = monthNames[idx];
                if (!mName || !m) return;
                const [mAr, mYear] = mName.split(' ');
                const mIdx = arMonths.indexOf(mAr);
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
        let valFmt = row.value ? Number(row.value).toLocaleString() : '-';
        const st = getContractStatus(row.startDate, row.endDate);
        const tip = `📄 رقم العقد: ${row.contractNumber||'-'}\n💰 القيمة: ${valFmt}\n⏳ المدة: ${row.duration||'-'}\n📅 البداية: ${row.startDate||'-'}\n📅 النهاية: ${row.endDate||'-'}\n📊 الحالة: ${st.text}`;

        const tr = document.createElement('tr');
        tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
        
        tr.innerHTML = `
            <td class="sticky-col-1">${cTitle} <span class="badge ${st.badge}" style="font-size:9px; margin-right:5px;">${st.text}</span></td>
            <td class="sticky-col-2" onmousemove="window.showTooltip(event, '${tip.replace(/\n/g, '\\n')}')" onmouseleave="window.hideTooltip()" style="cursor:help"><span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span></td>
            <td class="sticky-col-3">${cName}</td>
            <td><span class="badge ${badge}">${late}</span></td>
        `;

        if (filteredColumns.length > 0) {
            filteredColumns.forEach(col => {
                const originalIndex = col.index;
                const md = (row.months && row.months[originalIndex]) ? row.months[originalIndex] : {financeStatus:'late'};
                
                const mName = col.name;
                const [mAr, mYear] = mName.split(' ');
                const mIdx = arMonths.indexOf(mAr);
                const cellDate = new Date(parseInt(mYear), mIdx, 1);
                
                // --- 🔥 تحديد نوع الفترة 🔥 ---
                const isBeforeContract = cellDate < contractStartDate;
                // الفترة الأصلية: من البداية حتى النهاية
                const isDuringOriginal = cellDate >= contractStartDate && cellDate <= contractEndDate;
                // فترة التمديد: بعد النهاية وحتى 6 أشهر
                const isDuringExtension = cellDate > contractEndDate && cellDate <= extensionEndDate;
                // الشراء المباشر: ما بعد التمديد
                const isDirectPurchase = cellDate > extensionEndDate;
                
                const isCurrentMonth = cellDate.getTime() === currentMonthStart.getTime();

                let ic='✘', cl='status-late', ti='لم يرفع';
                
                // نصوص إضافية للتلميح
                let periodLabel = "";
                if (isDuringExtension) periodLabel = "\n(فترة تمديد 10%)";
                if (isDirectPurchase) periodLabel = "\n(شراء مباشر)";

                if(md.financeStatus === 'sent') { 
                    ic='✅'; cl='status-ok'; ti=`مطالبة: ${md.claimNum||'-'}\nخطاب: ${md.letterNum||'-'}${periodLabel}`; 
                }
                else if(md.financeStatus === 'returned') { 
                    ic='⚠️'; cl='status-returned'; ti=`إعادة: ${md.returnNotes||'-'}${periodLabel}`; 
                }
                else if (isBeforeContract) { 
                    ic='-'; cl=''; ti='قبل بداية العقد';
                }
                else if (isCurrentMonth) {
                    ic='⏳'; cl=''; ti='الشهر الجاري (لم ينتهِ بعد)'; 
                }
                else {
                    ti += periodLabel; // إضافة التصنيف لحالة التأخير أيضاً
                }

                const highlight = (sClaim !== "" && md.claimNum && md.claimNum.toLowerCase().includes(sClaim)) ? "border: 2px solid blue;" : "";
                const clickAttr = canEditFunc(userRole, row.type) ? `onclick="window.handleKpiCell('${row.id}', ${originalIndex})"` : '';
                const cursor = canEditFunc(userRole, row.type) ? 'pointer' : 'default';

                // --- 🔥🔥 التمييز اللوني (الخلفيات) 🔥🔥 ---
                let bgStyle = '';
                
                if (isBeforeContract) {
                    bgStyle = 'background:#f9f9f9; color:#ccc;'; // رمادي باهت
                } 
                else if (isDuringExtension) {
                    // لون بنفسجي فاتح جداً للتمديد
                    bgStyle = 'background:#f3e5f5; border-bottom: 2px solid #9b59b6;'; 
                } 
                else if (isDirectPurchase) {
                    // لون أزرق سماوي للشراء المباشر
                    bgStyle = 'background:#e3f2fd; border-bottom: 2px solid #34495e;'; 
                }
                
                // تمييز خاص للشهر الجاري (فوق أي لون آخر)
                if (isCurrentMonth && md.financeStatus === 'late') {
                    bgStyle = 'background:#fffbf0; color:#f39c12; border: 2px dashed #f39c12;';
                }

                tr.innerHTML += `<td class="${cl}" style="cursor:${cursor}; ${highlight}; ${bgStyle}" ${clickAttr}>
                    <div onmousemove="window.showTooltip(event, '${ti.replace(/\n/g, '\\n')}')" onmouseleave="window.hideTooltip()">${ic}</div>
                </td>`;
            });
        } else { tr.innerHTML += `<td>-</td>`; }
        
        const en = canEditFunc(userRole, row.type) ? `onclick="window.editNote('${row.id}')"` : '';
        tr.innerHTML += `<td ${en} style="cursor:${canEditFunc(userRole, row.type)?'pointer':'default'}; font-size:11px;">${row.notes||''}</td>`;
        tbody.appendChild(tr);
    });

    return filtered;
}

// --- 5. Render Cards (كما هي) ---
export function renderCards(appData, type) {
    const grid = document.getElementById(type === 'contract' ? 'contractsGrid' : 'contractorsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    // ... نفس الكود السابق ...
    // اختصاراً للمساحة، ضع الكود الخاص بالكروت هنا (لم يتغير)
    // سأضع لك الكود الأساسي لضمان عمله
    if (type === 'contract') {
        const fName = document.getElementById('filterContractName')?.value.toLowerCase() || "";
        const fStatus = document.getElementById('filterContractStatus')?.value || "all";
        const fType = document.getElementById('filterContractType2')?.value || "all";
        let activeCount = 0, soonCount = 0, expiredCount = 0, totalMed = 0, totalNonMed = 0;
        const allContracts = Object.entries(appData.contracts);
        allContracts.forEach(([, row]) => {
            const st = getContractStatus(row.startDate, row.endDate);
            if(st.text === 'ساري') activeCount++;
            if(st.text === 'على وشك الانتهاء') soonCount++;
            if(st.text === 'منتهي') expiredCount++;
            const val = parseFloat(row.value) || 0;
            if(row.type === 'طبي') totalMed += val;
            if(row.type === 'غير طبي') totalNonMed += val;
        });
        if(document.getElementById('cardActiveContracts')) {
            document.getElementById('cardActiveContracts').innerText = activeCount;
            document.getElementById('cardSoonContracts').innerText = soonCount;
            document.getElementById('cardExpiredContracts').innerText = expiredCount;
            document.getElementById('cardTotalMedical').innerText = totalMed.toLocaleString() + ' ريال';
            document.getElementById('cardTotalNonMedical').innerText = totalNonMed.toLocaleString() + ' ريال';
        }
        const filtered = allContracts.filter(([, row]) => {
            const name = row.contractName || row.hospital || "";
            const st = getContractStatus(row.startDate, row.endDate);
            const matchName = name.toLowerCase().includes(fName);
            let matchStatus = false;
            if (fStatus === 'all') matchStatus = true;
            else if (fStatus === 'active' && st.text === 'ساري') matchStatus = true;
            else if (fStatus === 'soon' && st.text === 'على وشك الانتهاء') matchStatus = true;
            else if (fStatus === 'expired' && st.text === 'منتهي') matchStatus = true;
            const matchType = fType === 'all' || row.type === fType;
            return matchName && matchStatus && matchType;
        });
        filtered.sort(([,a], [,b]) => (a.contractName||a.hospital||"").localeCompare(b.contractName||b.hospital||"", 'ar'));
        filtered.forEach(([id, row]) => {
            const cName = appData.contractors[row.contractorId]?.name || "-";
            const st = getContractStatus(row.startDate, row.endDate);
            const name = row.contractName || row.hospital;
            const valFmt = row.value ? Number(row.value).toLocaleString() : '-';
            const div = document.createElement('div'); div.className = 'data-card';
            div.innerHTML = `<div class="card-header"><div><div class="card-title">${name}</div><span class="badge ${st.badge}" style="font-size:10px">${st.text}</span></div><span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span></div><div class="card-body"><div class="row"><span>المقاول:</span><b>${cName}</b></div><div class="row"><span>القيمة:</span><b>${valFmt}</b></div><div class="row"><span>النهاية:</span><b>${row.endDate||'-'}</b></div></div><div class="card-actions"><button class="btn-primary" onclick="window.prepareEditContract('${id}')">تعديل</button><button class="btn-danger" onclick="window.deleteContract('${id}')">حذف</button></div>`;
            grid.appendChild(div);
        });
    } else {
        Object.entries(appData.contractors).forEach(([id, row]) => {
            const div = document.createElement('div'); div.className = 'data-card';
            div.innerHTML = `<div class="card-header" style="border:none"><div class="card-title">${row.name}</div></div><div class="card-actions"><button class="btn-primary" onclick="window.prepareEditContractor('${id}','${row.name}')">تعديل</button><button class="btn-danger" onclick="window.deleteContractor('${id}')">حذف</button></div>`;
            grid.appendChild(div);
        });
    }
}

// --- 6. Update Stats ---
export function updateStats(rows, appData, selectedYear) {
    if (!rows || !appData) return;
    const validIndices = [];
    if (appData.monthNames) {
        appData.monthNames.forEach((m, i) => {
            if (m.includes(selectedYear)) validIndices.push(i);
        });
    }
    let totalLate = 0, totalSubmitted = 0;
    
    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    let effectiveTotalCells = 0;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    rows.forEach(r => {
        const contractStartDate = new Date(r.startDate);
        contractStartDate.setDate(1); contractStartDate.setHours(0,0,0,0);

        if (r.months) {
            validIndices.forEach(idx => {
                const mName = appData.monthNames[idx];
                const [mAr, mYear] = mName.split(' ');
                const mIdx = arMonths.indexOf(mAr);
                const cellDate = new Date(parseInt(mYear), mIdx, 1);
                
                const isEnded = cellDate < currentMonthStart;

                if (cellDate >= contractStartDate && isEnded) {
                    effectiveTotalCells++;
                    const m = r.months[idx];
                    if (m) {
                        if (m.financeStatus === 'late') totalLate++;
                        if (m.financeStatus === 'sent') totalSubmitted++;
                    }
                } else if (cellDate >= contractStartDate && !isEnded) {
                    const m = r.months[idx];
                    if (m && m.financeStatus === 'sent') {
                        effectiveTotalCells++;
                        totalSubmitted++;
                    }
                }
            });
        }
    });

    let active = 0, expired = 0;
    rows.forEach(r => {
        const st = getContractStatus(r.startDate, r.endDate);
        if(st.text === 'ساري' || st.text === 'على وشك الانتهاء' || st.text === 'تمديد 10%') active++;
        if(st.text === 'منتهي' || st.text === 'شراء مباشر') expired++;
    });

    const elHosp = document.getElementById('countHospitals'); if (elHosp) elHosp.innerText = new Set(rows.map(r=>r.hospital)).size;
    const elCont = document.getElementById('countContracts'); if (elCont) elCont.innerText = rows.length;
    const elLate = document.getElementById('countLate'); if (elLate) elLate.innerText = totalLate;
    const elActive = document.getElementById('countActive'); if (elActive) elActive.innerText = active;
    const elExpired = document.getElementById('countExpired'); if (elExpired) elExpired.innerText = expired;
    
    const elComp = document.getElementById('complianceRate'); if(elComp) elComp.innerText = effectiveTotalCells > 0 ? Math.round((totalSubmitted/effectiveTotalCells)*100)+'%' : '0%';
    
    const ctx = document.getElementById('kpiChart')?.getContext('2d');
    if (ctx) {
        if(window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, { type: 'doughnut', data: { labels:['مرفوع','متأخر'], datasets:[{data:[totalSubmitted, effectiveTotalCells-totalSubmitted], backgroundColor:['#27ae60','#c0392b']}] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
    }
}

// --- Helpers ---
export function showToast(msg) { const t = document.getElementById("toast"); if(t) { t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 2500); } }
export function toggleModal(id, show) { const m = document.getElementById(id); if(m) m.style.display = show ? 'flex' : 'none'; }
export function exportToExcel() {
    const ws = XLSX.utils.table_to_sheet(document.getElementById('mainTable'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI");
    XLSX.writeFile(wb, "KPI_Report.xlsx");
}
