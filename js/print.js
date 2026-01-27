// js/print.js

export function openPrintPage(appData, selectedYear, userRole) {
    const { contracts, contractors, monthNames } = appData;

    // 1. تصفية العقود حسب الصلاحية (نفس منطق الجدول الرئيسي)
    let rows = Object.entries(contracts).map(([id, val]) => ({...val, id}));
    if (userRole === 'medical') rows = rows.filter(r => r.type === 'طبي');
    if (userRole === 'non_medical') rows = rows.filter(r => r.type === 'غير طبي');
    
    // ترتيب أبجدي
    rows.sort((a, b) => (a.contractName||a.hospital||"").localeCompare(b.contractName||b.hospital||"", 'ar'));

    // 2. تجهيز أعمدة الشهور للسنة المحددة
    const printColumns = [];
    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    
    if (monthNames) {
        monthNames.forEach((mName, i) => { 
            if (mName.includes(selectedYear)) printColumns.push({ name: mName, index: i }); 
        });
    }

    // 3. حساب الإحصائيات السريعة للتقرير
    const totalContracts = rows.length;
    const totalValue = rows.reduce((sum, r) => sum + Number(r.value || 0), 0).toLocaleString();

    // 4. بناء صفحة الطباعة (HTML & CSS)
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <title>تقرير العقود ${selectedYear}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; padding: 0; margin: 0; }
            
            /* الترويسة */
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
            .header-right { text-align: right; }
            .header-left { text-align: left; }
            .header h1 { margin: 0; color: #0056b3; font-size: 24px; }
            .header p { margin: 5px 0 0; color: #555; font-size: 14px; }
            
            /* ملخص سريع */
            .summary-box { display: flex; gap: 20px; margin-bottom: 20px; background: #f9f9f9; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
            .sum-item { font-weight: bold; font-size: 12px; }
            
            /* الجدول */
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background-color: #0056b3; color: white; padding: 8px 4px; border: 1px solid #000; }
            td { border: 1px solid #000; padding: 4px; text-align: center; vertical-align: middle; height: 30px; }
            
            /* ألوان الخلايا */
            .bg-ok { background-color: #d4edda; } /* أخضر فاتح */
            .bg-late { background-color: #f8d7da; } /* أحمر فاتح */
            .bg-return { background-color: #fff3cd; } /* أصفر فاتح */
            .bg-closed { background-color: #eee; color: #aaa; }
            .bg-direct { background-color: #e3f2fd; } /* شراء مباشر */
            
            /* التذييل */
            .footer { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 10px; color: #777; border-top: 1px solid #ccc; padding-top: 5px; }
        </style>
    </head>
    <body>
        
        <div class="header">
            <div class="header-right">
                <h1>تجمع تبوك الصحي</h1>
                <p>الإدارة التنفيذية للشئون المالية - إدارة العقود</p>
            </div>
            <div style="text-align:center;">
                <h2>تقرير متابعة الأداء KPI</h2>
                <p>السنة المالية: <b>${selectedYear}</b></p>
            </div>
            <div class="header-left">
                <img src="TabukCluster.jpeg" style="height: 60px;">
                <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</p>
            </div>
        </div>

        <div class="summary-box">
            <div class="sum-item">عدد العقود: ${totalContracts}</div>
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
            <tbody>
                ${generateTableBody(rows, printColumns, appData)}
            </tbody>
        </table>

        <div class="footer">
            تم استخراج هذا التقرير آلياً من نظام متابعة العقود والمستخلصات - تجمع تبوك الصحي
        </div>

        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// دالة مساعدة لبناء جسم الجدول
function generateTableBody(rows, columns, appData) {
    if (rows.length === 0) return `<tr><td colspan="${columns.length + 3}">لا توجد بيانات</td></tr>`;

    let html = '';
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    rows.forEach(row => {
        const cName = appData.contractors[row.contractorId]?.name || "-";
        const cTitle = row.contractName || row.hospital || "-";
        
        // تواريخ العقد
        const contractStartDate = new Date(row.startDate); contractStartDate.setDate(1); contractStartDate.setHours(0,0,0,0);
        const contractEndDate = new Date(row.endDate); contractEndDate.setDate(1); contractEndDate.setHours(0,0,0,0);
        const extensionEndDate = new Date(contractEndDate); extensionEndDate.setMonth(extensionEndDate.getMonth() + 6);

        let rowHtml = `<tr>
            <td style="text-align:right; font-weight:bold;">${cTitle}</td>
            <td>${cName}</td>`;

        // حلقات الشهور
        columns.forEach(col => {
            const md = (row.months && row.months[col.index]) ? row.months[col.index] : {financeStatus:'late'};
            
            // تحليل تاريخ العمود
            const [mAr, mYear] = col.name.split(' ');
            const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
            const mIdx = arMonths.indexOf(mAr);
            const cellDate = new Date(parseInt(mYear), mIdx, 1);

            // تحديد الحالة واللون
            let cellClass = '';
            let cellContent = '';

            const isBefore = cellDate < contractStartDate;
            const isDirect = cellDate > extensionEndDate;
            const isCurrent = cellDate.getTime() === currentMonthStart.getTime();

            if (isBefore) {
                cellClass = 'bg-closed';
                cellContent = '-';
            } else if (isDirect) {
                cellClass = 'bg-direct';
                // نفس منطق الحالة
                cellContent = getStatusIcon(md.financeStatus);
            } else {
                // الفترات العادية
                if (md.financeStatus === 'sent') { cellClass = 'bg-ok'; cellContent = '✅'; }
                else if (md.financeStatus === 'returned') { cellClass = 'bg-return'; cellContent = '⚠️'; }
                else if (md.financeStatus === 'late' && cellDate < currentMonthStart) { cellClass = 'bg-late'; cellContent = '❌'; }
                else { cellContent = ''; }
            }

            // إضافة تفاصيل نصية صغيرة للطباعة (رقم مطالبة)
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
