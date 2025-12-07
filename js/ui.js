// --- تهيئة التلميح العائم ---
export function initTooltip() {
    if (!document.getElementById('global-tooltip')) {
        const div = document.createElement('div');
        div.id = 'global-tooltip';
        div.style.cssText = "position:fixed; background:rgba(44,62,80,0.95); color:#fff; padding:10px 15px; border-radius:8px; font-size:12px; z-index:9999; pointer-events:none; display:none; white-space:pre-line; box-shadow:0 4px 15px rgba(0,0,0,0.3);";
        document.body.appendChild(div);
    }
}

export function showTooltip(e, text) {
    const t = document.getElementById('global-tooltip');
    if (t && text) {
        t.innerText = text;
        t.style.display = 'block';
        let top = e.clientY + 15, left = e.clientX + 15;
        if (left + 220 > window.innerWidth) left = e.clientX - 225;
        if (top + 100 > window.innerHeight) top = e.clientY - 100;
        t.style.top = top + 'px'; t.style.left = left + 'px';
    }
}

export function hideTooltip() {
    const t = document.getElementById('global-tooltip');
    if (t) t.style.display = 'none';
}

// --- رسم الجدول الرئيسي ---
export function renderTable(appData, userRole, canEditFunc) {
    const { contracts, contractors, monthNames } = appData;
    const sHosp = document.getElementById('searchHospital')?.value.toLowerCase() || "";
    const sCont = document.getElementById('searchContractor')?.value.toLowerCase() || "";
    const filter = document.getElementById('typeFilter')?.value || "all";
    const tbody = document.getElementById('tableBody');
    const hRow = document.getElementById('headerRow');

    if (!tbody || !hRow) return;

    // Header
    let hHTML = `<th class="sticky-col-1">الموقع</th><th class="sticky-col-2">النوع</th><th class="sticky-col-3">المقاول</th><th style="min-width:40px">تأخير</th>`;
    if (monthNames.length) monthNames.forEach(m => hHTML += `<th style="min-width:100px">${m}</th>`);
    else hHTML += `<th>-</th>`;
    hHTML += `<th style="min-width:150px">ملاحظات</th>`;
    hRow.innerHTML = hHTML;

    // Body
    tbody.innerHTML = '';
    const rows = Object.entries(contracts).map(([id, val]) => ({...val, id}));
    
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" style="padding:20px;color:#777">لا توجد بيانات</td></tr>`;
        return;
    }

    const filtered = rows.filter(r => {
        const cName = contractors[r.contractorId]?.name || "";
        return (r.hospital||"").toLowerCase().includes(sHosp) && 
               cName.toLowerCase().includes(sCont) && 
               (filter === 'all' || r.type === filter);
    });

    filtered.forEach(row => {
        const cName = contractors[row.contractorId]?.name || "غير معروف";
        const late = (row.months||[]).filter(m => m && m.financeStatus === 'late').length;
        const badge = late > 0 ? 'badge-red' : 'badge-green';
        
        let valFmt = row.value ? Number(row.value).toLocaleString() : '-';
        const tip = `📄 رقم العقد: ${row.contractNumber||'-'}\n💰 القيمة: ${valFmt} ريال\n📅 البداية: ${row.startDate||'-'}\n📅 النهاية: ${row.endDate||'-'}`;

        const tr = document.createElement('tr');
        tr.className = row.type === 'طبي' ? 'row-medical' : 'row-non-medical';
        
        tr.innerHTML = `
            <td class="sticky-col-1">${row.hospital}</td>
            <td class="sticky-col-2" onmousemove="window.showTooltip(event, '${tip.replace(/\n/g, '\\n')}')" onmouseleave="window.hideTooltip()" style="cursor:help">
                <span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span>
            </td>
            <td class="sticky-col-3">${cName}</td>
            <td><span class="badge ${badge}">${late}</span></td>
        `;

        if (monthNames.length) {
            monthNames.forEach((m, idx) => {
                const md = (row.months && row.months[idx]) ? row.months[idx] : {financeStatus:'late'};
                let ic='✘', cl='status-late', ti='لم يرفع';
                if(md.financeStatus === 'sent') { ic='✅'; cl='status-ok'; ti=`مطالبة: ${md.claimNum||'-'}\nخطاب: ${md.letterNum||'-'}`; }
                else if(md.financeStatus === 'returned') { ic='⚠️'; cl='status-returned'; ti=`إعادة: ${md.returnNotes||'-'}`; }
                
                // Click Event
                const clickAttr = canEditFunc(userRole, row.type) ? `onclick="window.handleKpiCell('${row.id}', ${idx})"` : '';
                const cursor = canEditFunc(userRole, row.type) ? 'pointer' : 'default';

                tr.innerHTML += `<td class="${cl}" style="cursor:${cursor}" ${clickAttr} onmousemove="window.showTooltip(event, '${ti.replace(/\n/g, '\\n')}')" onmouseleave="window.hideTooltip()">${ic}</td>`;
            });
        } else { tr.innerHTML += `<td>-</td>`; }

        const en = canEditFunc(userRole, row.type) ? `onclick="window.editNote('${row.id}')"` : '';
        tr.innerHTML += `<td ${en} style="cursor:${canEditFunc(userRole, row.type)?'pointer':'default'}; font-size:11px;">${row.notes||''}</td>`;
        tbody.appendChild(tr);
    });

    return filtered; // Return for stats
}

// --- رسم البطاقات الإدارية ---
export function renderCards(appData, type) {
    const grid = document.getElementById(type === 'contract' ? 'contractsGrid' : 'contractorsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (type === 'contract') {
        Object.entries(appData.contracts).forEach(([id, row]) => {
            const cName = appData.contractors[row.contractorId]?.name || "-";
            const div = document.createElement('div'); div.className = 'data-card';
            div.innerHTML = `
                <div class="card-header"><div><div class="card-title">${row.hospital}</div><div style="font-size:11px;color:#777">${row.contractNumber||'-'}</div></div><span class="contract-tag ${row.type==='طبي'?'tag-med':'tag-non'}">${row.type}</span></div>
                <div class="card-body">
                    <div class="row"><span>المقاول:</span><b>${cName}</b></div>
                    <div class="row"><span>النهاية:</span><b>${row.endDate||'-'}</b></div>
                </div>
                <div class="card-actions"><button class="btn-primary" onclick="window.prepareEditContract('${id}')">تعديل</button><button class="btn-danger" onclick="window.deleteContract('${id}')">حذف</button></div>
            `;
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

// --- تحديث الإحصائيات ---
export function updateStats(rows, appData) {
    if (!rows) return;
    const totalLate = rows.reduce((s, r) => s + ((r.months||[]).filter(m => m && m.financeStatus === 'late').length), 0);
    const totalCells = rows.length * (appData.monthNames.length || 1);
    let totalSubmitted = 0;
    rows.forEach(r => (r.months||[]).forEach(m => { if(m && m.financeStatus === 'sent') totalSubmitted++; }));
    
    document.getElementById('countHospitals').innerText = new Set(rows.map(r=>r.hospital)).size;
    document.getElementById('countContracts').innerText = rows.length;
    document.getElementById('countLate').innerText = totalLate;
    document.getElementById('complianceRate').innerText = totalCells > 0 ? Math.round((totalSubmitted/totalCells)*100)+'%' : '0%';

    const ctx = document.getElementById('kpiChart')?.getContext('2d');
    if (ctx) {
        if(window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, { type: 'doughnut', data: { labels:['مرفوع','متأخر'], datasets:[{data:[totalSubmitted, totalCells-totalSubmitted], backgroundColor:['#27ae60','#c0392b']}] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
    }
}

export function showToast(msg) {
    const t = document.getElementById("toast"); t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 2500);
}
export function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'flex' : 'none'; }
