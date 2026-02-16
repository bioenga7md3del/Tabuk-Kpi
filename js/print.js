// js/print.js

export function openPrintPage(appData, selectedYear, userRole) {
    const { contracts, contractors, monthNames } = appData;

    // --- 1. جلب قيم الفلاتر من واجهة المستخدم الحالية ---
    // هذه الخطوة هي التي ستجعل الطباعة تحترم ما قمت بتحديده
    const sHosp = document.getElementById('searchHospital')?.value.toLowerCase() || "";
    const sCont = document.getElementById('searchContractor')?.value.toLowerCase() || "";
    const sClaim = document.getElementById('searchClaim')?.value.toLowerCase() || "";
    const filterType = document.getElementById('typeFilter')?.value || "all";

    // --- 2. تجهيز البيانات وتصفيتها ---
    let rows = Object.entries(contracts).map(([id, val]) => ({...val, id}));

    // أ) تصفية حسب الصلاحية (أمان)
    if (userRole === 'medical') rows = rows.filter(r => r.type === 'طبي');
    if (userRole === 'non_medical') rows = rows.filter(r => r.type === 'غير طبي');

    // ب) تصفية حسب مدخلات البحث (الفلاتر) - نفس منطق الجدول الرئيسي
    rows = rows.filter(r => {
        const cName = contractors[r.contractorId]?.name || "";
        const cTitle = r.contractName || r.hospital || "";
        
        // البحث في نص الاسم والمقاول
        const matchName = (cTitle).toLowerCase().includes(sHosp);
        const matchCont = cName.toLowerCase().includes(sCont);
        
        // البحث في النوع (Select Box)
        const matchType = (filterType === 'all' || r.type === filterType);

        // البحث برقم المطالبة (أكثر تعقيداً لأنه داخل المصفوفات)
        const matchClaim = sClaim === "" || (r.months || []).some(m => m && m.claimNum && m.claimNum.toString().includes(sClaim));
        
        // البحث بالسنة (إخفاء العقود المستقبلية)
        let showContract = true;
        if (r.startDate) { 
            const startYear = new Date(r.startDate).getFullYear(); 
            if (startYear > selectedYear) showContract = false; 
        }

        return matchName && matchCont && matchType && matchClaim && showContract;
    });
    
    // ترتيب أبجدي
    rows.sort((a, b) => (a.contractName||a.hospital||"").localeCompare(b.contractName||b.hospital||"", 'ar'));

    // --- 3. تجهيز الأعمدة ---
    const printColumns = [];
    if (monthNames) {
        monthNames.forEach((mName, i) => { 
            if (mName.includes(selectedYear)) printColumns.push({ name: mName, index: i }); 
        });
    }

    // --- 4. الإحصائيات (ستحسب بناءً على البيانات المفلترة فقط) ---
    const totalContracts = rows.length;
    // تجميع القيم المالية فقط للعقود الظاهرة
    const totalValue = rows.reduce((sum, r) => sum + Number(r.value || 0), 0).toLocaleString();

    // --- 5. بناء الصفحة ---
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <title>تقرير العقود ${selectedYear}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; margin: 0; }
            
            /* تنسيق الجدول */
            table { width: 100%; border-collapse: collapse; font-size: 10px; width: 100%; }
            thead { display: table-header-group; } 
            tfoot { display: table-footer-group; } 
            tr { page-break-inside: avoid; break-inside: avoid; } 

            th { background-color: #0056b3 !important; color: white !important; padding: 8px 4px; border: 1px solid #000; }
            td { border: 1px solid #000; padding: 4px; text-align: center; vertical-align: middle; height: 30px; }
            
            /* الترويسة */
            .header-container { width: 100%; margin-bottom: 20px; }
            .header-content { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0056b3; padding-bottom: 10px; }
            .header-right { text-align: right; }
            .header-left { text-align: left; }
            .header h1 { margin: 0; color: #0056b3; font-size: 24px; }
            .header p { margin: 5px 0 0; color: #555; font-size: 14px; }

            /* الملخص */
            .summary-box { display: flex; gap: 20px; margin-bottom: 15px; background: #f9f9f9; padding: 10px; border: 1px solid #ddd; border-radius: 5px; page-break-inside: avoid; }
            .sum-item { font-weight: bold; font-size: 12px; }

            /* التذييل الثابت */
            .fixed-footer { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 10px; color: #777; background: white; border-top: 1px solid #ccc; padding-top: 5px; height: 30px; }

            /* الألوان */
            .bg-ok { background-color: #d4edda !important; }
            .bg-late { background-color: #f8d7da !important; }
            .bg-return { background-color: #fff3cd !important; }
            .bg-closed { background-color: #eee !important; color: #aaa; }
            .bg-direct { background-color: #e3f2fd !important; }
        </style>
    </head>
    <body>
        <div class="header-container">
            <div class="header-content">
                <div class="header-right">
                    <h1>تجمع تبوك الصحي</h1>
                    <p>الإدارة التنفيذية للشئون المالية - إدارة العقود</p>
                </div>
                <div style="text-align:center;">
                    <h2>تقرير متابعة الأداء KPI</h2>
                    <p>السنة المالية: <b>${selectedYear}</b> ${sHosp ? `(بحث: ${sHosp})` : ''}</p>
                </div>
                <div class="header-left">
                    <img src="TabukCluster.jpeg" style="height: 60px;">
                    <p>تاريخ: ${new Date().toLocaleDateString('ar-SA')}</p>
                </div>
            </div>
        </div>

        <div class="summary-box">
            <div class="sum-item">عدد العقود الظاهرة: ${totalContracts}</div>
            <div class="sum-item">إجمالي القيمة: ${totalValue} ريال</div>
            <div class="sum-item">المستخدم: ${getRoleName(userRole)}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th width="15%">اسم العقد / المستشفى</th>
                    <th width="10%">المقاول</th>
                    ${printColumns.map(col => `<th>${col.name.split(' ')[0]}</th>`).join('')}
                    <th width="10%">ملاحظات</th>
                </tr>
            </thead>
            <tfoot><tr><td colspan="${printColumns.length + 3}" style="border:none; height: 40px;"></td></tr></tfoot>
            <tbody>
                ${generateTableBody(rows, printColumns, appData)}
            </tbody>
        </table>

        <div class="fixed-footer">
            تم استخراج هذا التقرير آلياً من نظام متابعة العقود والمستخلصات - تجمع تبوك الصحي | صفحة رسمية
        </div>

        <script>window.onload = function() { setTimeout(() => window.print(), 500); }</script>
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

function generateTableBody(rows, columns, appData) {
    if (rows.length === 0) return `<tr><td colspan="${columns.length + 3}">لا توجد بيانات تطابق البحث</td></tr>`;

    let html = '';
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    rows.forEach(row => {
        const cName = appData.contractors[row.contractorId]?.name || "-";
        const cTitle = row.contractName || row.hospital || "-";
        
        const contractStartDate = new Date(row.startDate); contractStartDate.setDate(1); contractStartDate.setHours(0,0,0,0);
        const contractEndDate = new Date(row.endDate); contractEndDate.setDate(1); contractEndDate.setHours(0,0,0,0);
        const extensionEndDate = new Date(contractEndDate); extensionEndDate.setMonth(extensionEndDate.getMonth() + 6);

        let rowHtml = `<tr>
            <td style="text-align:right; font-weight:bold;">${cTitle}</td>
            <td>${cName}</td>`;

        columns.forEach(col => {
            const md = (row.months && row.months[col.index]) ? row.months[col.index] : {financeStatus:'late'};
            const [mAr, mYear] = col.name.split(' ');
            const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
            const mIdx = arMonths.indexOf(mAr);
            const cellDate = new Date(parseInt(mYear), mIdx, 1);

            let cellClass = '';
            let cellContent = '';

            const isBefore = cellDate < contractStartDate;
            const isDirect = cellDate > extensionEndDate;
            
            if (isBefore) {
                cellClass = 'bg-closed';
                cellContent = '-';
            } else if (isDirect) {
                cellClass = 'bg-direct';
                cellContent = getStatusIcon(md.financeStatus);
            } else {
                if (md.financeStatus === 'sent') { cellClass = 'bg-ok'; cellContent = '✅'; }
                else if (md.financeStatus === 'returned') { cellClass = 'bg-return'; cellContent = '⚠️'; }
                else if (md.financeStatus === 'late' && cellDate < currentMonthStart) { cellClass = 'bg-late'; cellContent = '❌'; }
            }

            let detail = '';
            if(md.claimNum) detail = `<br><span style="font-size:8px">${md.claimNum}</span>`;

            rowHtml += `<td class="${cellClass}">${cellContent}${detail}</td>`;
        });

        rowHtml += `<td>${row.notes || ''}</td></tr>`;
        html += rowHtml;
    });

    return html;
}

function getStatusIcon(status) {
    if (status === 'sent') return '✅';
    if (status === 'returned') return '⚠️';
    return '';
}

function getRoleName(role) {
    if (role === 'super') return 'سوبر أدمن';
    if (role === 'medical') return 'مشرف طبي';
    if (role === 'non_medical') return 'مشرف غير طبي';
    return 'مطلع';
}
