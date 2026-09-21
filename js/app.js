// js/app.js
import * as DB from './db.js';
import * as UI from './ui.js';
// أضف السطر ده في الأول مع الـ imports
import * as PrintSystem from './print.js';

let appData = { contracts: {}, contractors: {}, monthNames: [] };
window.userRole = null; // 'super', 'medical', 'non_medical', 'viewer'
window.selectedYear = new Date().getFullYear();

// --- 1. Login Logic (Updated for 4 Roles) ---
window.adminLogin = async function() {
    const btn = document.getElementById('loginBtn');
    const pwInput = document.getElementById('adminPassword').value;
    if (!pwInput) { document.getElementById('adminPassword').focus(); return; }
    if (btn) { btn.disabled = true; btn.innerText = 'جاري التحقق...'; }

    let stored = {};
    try { stored = await DB.getPasswords(); } catch (e) { stored = {}; }
    const passwords = {
        super: stored.super || 'super123',
        medical: stored.medical || 'med123',
        non_medical: stored.non_medical || 'nonmed123',
        viewer: stored.viewer || 'view123'
    };

    let role = null;
    if (pwInput === passwords.super) role = 'super';
    else if (pwInput === passwords.medical) role = 'medical';
    else if (pwInput === passwords.non_medical) role = 'non_medical';
    else if (pwInput === passwords.viewer) role = 'viewer';

    if (!role) {
        if (btn) { btn.disabled = false; btn.innerText = 'دخول للنظام'; }
        Swal.fire('خطأ', 'كلمة المرور غير صحيحة', 'error');
        return;
    }
    try { sessionStorage.setItem('kpi_role', role); } catch (e) {}
    await startSession(role);
};

// بدء الجلسة (بعد التحقق من كلمة المرور، أو عند استعادة الجلسة بعد تحديث الصفحة)
async function startSession(role) {
    window.userRole = role;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    updateUIForRole();
    setLoading(true);
    try { await loadData(); } finally { setLoading(false); }
    refreshView();
    if (window.userRole === 'super') checkAutoBackup();
}

function setLoading(on) { const o = document.getElementById('loadingOverlay'); if (o) o.style.display = on ? 'flex' : 'none'; }

function updateUIForRole() {
    const role = window.userRole;
    const roleDisplay = document.getElementById('userRoleDisplay');
    
    // نصوص العرض
    let roleName = "غير معروف";
    if (role === 'super') roleName = "👑 سوبر أدمن";
    if (role === 'medical') roleName = "🩺 مشرف طبي";
    if (role === 'non_medical') roleName = "🏢 مشرف غير طبي";
    if (role === 'viewer') roleName = "👀 مطلع فقط";
    roleDisplay.innerText = roleName;

    // 1. أزرار السوبر أدمن (النسخ الاحتياطي، الإعدادات، التهيئة)
    const superBtns = document.querySelectorAll('.super-admin-only');
    superBtns.forEach(btn => btn.style.display = (role === 'super') ? 'inline-flex' : 'none');

    // 2. أزرار التعديل والإضافة (تختفي للمطلع)
    const editBtns = document.querySelectorAll('.edit-permission-only');
    editBtns.forEach(btn => btn.style.display = (role === 'viewer') ? 'none' : 'inline-flex');
    
    // 3. قفل فلتر الأنواع للمشرفين
    const typeFilter = document.getElementById('typeFilter');
    if (role === 'medical') {
        typeFilter.value = 'طبي';
        typeFilter.disabled = true;
    } else if (role === 'non_medical') {
        typeFilter.value = 'غير طبي';
        typeFilter.disabled = true;
    } else {
        typeFilter.disabled = false;
        typeFilter.value = 'all';
    }
}

window.logout = function() { try { sessionStorage.removeItem('kpi_role'); } catch (e) {} location.reload(); };

// --- 2. Data Loading ---
async function loadData() {
    const data = await DB.getData('app_db_v2');
    if (data) {
        appData = data;
        if (!appData.contracts) appData.contracts = {};
        if (!appData.contractors) appData.contractors = {};
        if (!appData.monthNames) appData.monthNames = [];
    } else {
        appData = { contracts: {}, contractors: {}, monthNames: [] };
    }
    const lu = document.getElementById('lastUpdated');
    if (lu) lu.innerText = 'آخر تحميل للبيانات: ' + new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

window.refreshView = function() {
    // تمرير userRole لـ renderTable للفلترة
    const filteredRows = UI.renderTable(appData, window.userRole, canEdit, window.selectedYear);
    UI.updateStats(filteredRows, appData, window.selectedYear);
    UI.updateStageSummary(filteredRows, appData, window.selectedYear);
    UI.renderYearTabs(appData.contracts, window.selectedYear);
    
    // تحديث الكروت إذا كان التاب نشطاً
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'tab-contracts') window.renderCards('contract');
    if (activeTab && activeTab.id === 'tab-contractors') window.renderCards('contractor');

    UI.checkNotifications(appData.contracts);
};

window.selectYear = function(year) {
    window.selectedYear = year;
    refreshView();
};

// دالة التحقق من صلاحية التعديل
function canEdit(role, contractType) {
    if (role === 'viewer') return false; // المطلع لا يعدل أبداً
    if (role === 'super') return true; // السوبر يعدل كل شيء
    if (role === 'medical' && contractType === 'طبي') return true;
    if (role === 'non_medical' && contractType === 'غير طبي') return true;
    return false;
}

// --- 3. Popup Handling ---
function roleLabel() {
    return { super: 'سوبر أدمن', medical: 'مشرف طبي', non_medical: 'مشرف غير طبي', viewer: 'مطلع' }[window.userRole] || '-';
}

window.setStageFilter = function(stage) {
    const sel = document.getElementById('stageFilter'); if (!sel) return;
    sel.value = (sel.value === stage) ? 'all' : stage;
    refreshView();
};

window.clearFilters = function() {
    ['searchHospital', 'searchContractor', 'searchClaim'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const sf = document.getElementById('stageFilter'); if (sf) sf.value = 'all';
    const tf = document.getElementById('typeFilter'); if (tf && !tf.disabled) tf.value = 'all';
    refreshView();
};

let _debounceTimer = null;
window.debouncedRefresh = function() { clearTimeout(_debounceTimer); _debounceTimer = setTimeout(() => refreshView(), 200); };

// إزالة الحقول الفارغة (Firebase لا يحتاجها) وإرجاع كائن نظيف
function cleanRecord(obj) {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) out[k] = v; });
    return out;
}

function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// هل رقم المطالبة مستخدم في خلية أخرى؟
function findDuplicateClaim(claimNum, exceptContractId, exceptIndex) {
    for (const [cid, c] of Object.entries(appData.contracts)) {
        const months = c.months || [];
        for (let i = 0; i < months.length; i++) {
            const m = months[i];
            if (!m || !m.claimNum) continue;
            if (cid === exceptContractId && i === exceptIndex) continue;
            if (String(m.claimNum).trim() === claimNum) return `${c.contractName || c.hospital || cid} - ${appData.monthNames[i] || i}`;
        }
    }
    return null;
}

const STAGE_FLOW = ['', 'at_site', 'at_maintenance', 'at_finance', 'received'];
const NEEDS_REVIEWER = ['at_maintenance', 'at_finance', 'returned', 'received'];
const NEEDS_NUMBERS = ['at_finance', 'received'];

function nextStageOf(cur) {
    if (cur === 'returned') return 'at_maintenance';
    const i = STAGE_FLOW.indexOf(cur);
    return (i > -1 && i < STAGE_FLOW.length - 1) ? STAGE_FLOW[i + 1] : '';
}

// --- 3. نافذة تتبع المستخلص ---
window.handleKpiCell = async function(contractId, monthIndex) {
    const row = appData.contracts[contractId];
    if (!row || !canEdit(window.userRole, row.type)) return;

    const cur = (row.months && row.months[monthIndex]) ? row.months[monthIndex] : {};
    const curStage = UI.getStage(cur);
    const E = UI.esc;
    const monthName = appData.monthNames[monthIndex] || '';

    const stepHtml = (key, label, icon, cls) =>
        `<div class="step ${curStage === key ? 'selected current-mark' : ''}" data-stage="${key}"><span class="pill ${cls}">${UI.svg(icon)}</span>${label}</div>`;
    const stepper = stepHtml('', 'لم يُرفع', 'x', 'st-late') +
        ['at_site', 'at_maintenance', 'at_finance', 'received', 'returned'].map(k => stepHtml(k, UI.STAGES[k].label, UI.STAGES[k].icon, 'st-' + k)).join('');

    // سجل الحركة (آخر 6)
    const hist = Object.values(cur.history || {}).sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, 6);
    const stageName = k => k ? UI.STAGES[k].label : 'لم يُرفع';
    const histHtml = hist.length ? `<div class="popup-full-width claim-history"><label class="popup-label">سجل الحركة</label>${hist.map(h =>
        `<div>${new Date(h.at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })} — ${E(stageName(h.from))} ← <b>${E(stageName(h.to))}</b> — ${E(h.by || '-')}${h.note ? ' — ' + E(h.note) : ''}</div>`).join('')}</div>` : '';

    const htmlForm = `
    <div class="popup-form-container" id="swalForm">
        <div class="popup-full-width"><label class="popup-label">مكان المستخلص الآن</label>
            <div class="stepper" id="stepper">${stepper}</div>
            <input type="hidden" id="swalStage" value="${curStage}">
            <div class="next-hint" id="nextHint"></div></div>
        <div><label class="popup-label" id="lblExtract">رقم المستخلص</label><input id="swalExtract" class="swal2-input" value="${E(cur.extractNo)}"></div>
        <div><label class="popup-label" id="lblClaim">رقم الشحنة (المطالبة)</label><input id="swalClaim" class="swal2-input" value="${E(cur.claimNum)}"></div>
        <div><label class="popup-label">رقم الفاتورة</label><input id="swalInvoice" class="swal2-input" value="${E(cur.invoiceNum || cur.invoiceNo)}"></div>
        <div><label class="popup-label">رقم الخطاب</label><input id="swalLetter" class="swal2-input" value="${E(cur.letterNum)}"></div>
        <div class="popup-full-width"><label class="popup-label" id="lblReviewer">اسم المراجع</label><input id="swalReviewer" class="swal2-input" value="${E(cur.reviewerName)}"></div>
        <div class="popup-full-width"><label class="popup-label">رابط المستند</label><input id="swalLink" class="swal2-input" value="${E(cur.docLink)}" placeholder="https://"></div>
        <div class="popup-full-width"><label class="popup-label" id="lblReturn">ملاحظات / سبب الإعادة</label><textarea id="swalReturn" class="swal2-textarea" style="height:64px">${E(cur.returnNotes)}</textarea></div>
        ${histHtml}
    </div>`;

    const $ = id => document.getElementById(id);
    const refreshForm = () => {
        const st = $('swalStage').value;
        document.querySelectorAll('#stepper .step').forEach(el => el.classList.toggle('selected', el.dataset.stage === st));
        $('lblReviewer').classList.toggle('required', NEEDS_REVIEWER.includes(st));
        $('lblExtract').classList.toggle('required', NEEDS_NUMBERS.includes(st));
        $('lblClaim').classList.toggle('required', NEEDS_NUMBERS.includes(st));
        $('lblReturn').classList.toggle('required', st === 'returned');
        const nx = nextStageOf(st);
        $('nextHint').innerHTML = nx ? `الخطوة التالية: <a data-go="${nx}">${UI.STAGES[nx].label}</a>` : '';
        if (NEEDS_REVIEWER.includes(st) && !$('swalReviewer').value.trim()) $('swalReviewer').value = lsGet('kpi_last_reviewer');
    };

    let dupAccepted = null;
    const { value: f } = await Swal.fire({
        title: `${E(row.contractName || row.hospital || '')} — ${E(monthName)}`,
        html: htmlForm,
        width: '680px',
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        cancelButtonText: 'إلغاء',
        didOpen: () => {
            $('stepper').addEventListener('click', e => { const s = e.target.closest('.step'); if (!s) return; $('swalStage').value = s.dataset.stage; refreshForm(); });
            $('nextHint').addEventListener('click', e => { const a = e.target.closest('a[data-go]'); if (!a) return; $('swalStage').value = a.dataset.go; refreshForm(); });
            $('swalForm').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); Swal.clickConfirm(); } });
            refreshForm();
            const st = $('swalStage').value;
            const focusId = NEEDS_REVIEWER.includes(st) && !$('swalReviewer').value.trim() ? 'swalReviewer' : (!$('swalExtract').value ? 'swalExtract' : 'swalClaim');
            const el = $(focusId); if (el) el.focus();
        },
        preConfirm: () => {
            const v = id => $(id).value.trim();
            const f = { stage: v('swalStage'), extractNo: v('swalExtract'), claimNum: v('swalClaim'), invoiceNo: v('swalInvoice'),
                        letterNum: v('swalLetter'), reviewerName: v('swalReviewer'), docLink: v('swalLink'), returnNotes: v('swalReturn') };
            if (NEEDS_REVIEWER.includes(f.stage) && !f.reviewerName) { Swal.showValidationMessage('اكتب اسم المراجع'); return false; }
            if (NEEDS_NUMBERS.includes(f.stage) && !f.extractNo) { Swal.showValidationMessage('رقم المستخلص مطلوب قبل الرفع للمالية'); return false; }
            if (NEEDS_NUMBERS.includes(f.stage) && !f.claimNum) { Swal.showValidationMessage('رقم الشحنة (المطالبة) مطلوب قبل الرفع للمالية'); return false; }
            if (f.stage === 'received' && !['at_finance', 'received'].includes(curStage)) { Swal.showValidationMessage('لا يمكن تسجيل الاستلام قبل الرفع للمالية'); return false; }
            if (f.stage === 'returned' && !f.returnNotes) { Swal.showValidationMessage('اكتب سبب الإعادة في الملاحظات'); return false; }
            if (f.docLink && !/^https?:\/\//i.test(f.docLink)) { Swal.showValidationMessage('رابط المستند يجب أن يبدأ بـ http أو https'); return false; }
            if (f.claimNum) {
                const dup = findDuplicateClaim(f.claimNum, contractId, monthIndex);
                if (dup && dupAccepted !== f.claimNum) {
                    dupAccepted = f.claimNum;
                    Swal.showValidationMessage(`رقم المطالبة مستخدم في: ${dup} — اضغط "حفظ" مرة أخرى للتأكيد`);
                    return false;
                }
            }
            return f;
        }
    });
    if (!f) return;
    if (f.reviewerName) lsSet('kpi_last_reviewer', f.reviewerName);

    const nowTs = Date.now();
    const oldHist = Object.values(cur.history || {});
    const changed = f.stage !== curStage;
    const newHist = changed
        ? [...oldHist, cleanRecord({ from: curStage, to: f.stage, by: roleLabel(), at: nowTs, note: f.returnNotes })]
        : oldHist;

    const base = cleanRecord({ ...f, financeStatus: UI.deriveFinanceStatus(f.stage), updatedBy: roleLabel() });
    const localRec = { ...base, updatedAt: nowTs, history: newHist };
    // للحفظ: الأوقات من ساعة السيرفر (آخر عنصر في السجل فقط جديد)
    const toSave = { ...base, updatedAt: DB.serverTs(),
        history: newHist.map((h, i) => (changed && i === newHist.length - 1) ? { ...h, at: DB.serverTs() } : h) };
    if (!toSave.history.length) delete toSave.history;
    if (!localRec.history.length) delete localRec.history;

    try {
        await DB.saveData(`app_db_v2/contracts/${contractId}/months/${monthIndex}`, toSave);
    } catch (e) {
        Swal.fire('تعذر الحفظ', 'حدث خطأ أثناء الحفظ، تأكد من الاتصال وحاول مرة أخرى', 'error');
        return;
    }
    if (!row.months) row.months = [];
    row.months[monthIndex] = localRec;
    refreshView();
    UI.showToast("تم التحديث");
};

// --- تحديث جماعي: نقل عدة عقود لنفس المرحلة في شهر واحد ---
window.openBulkUpdate = async function() {
    if (window.userRole === 'viewer') return;
    const E = UI.esc;
    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const names = appData.monthNames || [];
    if (!names.length) { Swal.fire('تنبيه', 'لا توجد شهور مضافة', 'info'); return; }

    const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1);
    let defIdx = names.indexOf(`${arMonths[prev.getMonth()]} ${prev.getFullYear()}`); if (defIdx < 0) defIdx = 0;

    const monthOptions = names.map((n, i) => `<option value="${i}" ${i === defIdx ? 'selected' : ''}>${E(n)}</option>`).join('');
    const htmlForm = `
    <div class="popup-form-container" id="bulkForm">
        <div><label class="popup-label">الشهر</label><select id="bkMonth" class="swal2-select">${monthOptions}</select></div>
        <div><label class="popup-label">نقل المستخلصات إلى</label>
            <select id="bkStage" class="swal2-select"><option value="at_maintenance">في إدارة الصيانة</option><option value="at_site">عند الموقع</option></select></div>
        <div class="popup-full-width"><label class="popup-label" id="bkRevLbl">اسم المراجع</label><input id="bkReviewer" class="swal2-input" value="${E(lsGet('kpi_last_reviewer'))}"></div>
        <div class="popup-full-width"><div class="bulk-tools"><span id="bkCount"></span><a id="bkAll">تحديد الكل</a><a id="bkNone">إلغاء التحديد</a></div>
            <div class="bulk-list" id="bkList"></div></div>
    </div>`;
    const $ = id => document.getElementById(id);

    const renderList = () => {
        const idx = parseInt($('bkMonth').value);
        const target = $('bkStage').value;
        const [mAr, mYear] = (names[idx] || '').split(' ');
        const cellDate = new Date(parseInt(mYear), arMonths.indexOf(mAr), 1);
        const items = Object.entries(appData.contracts)
            .filter(([, c]) => canEdit(window.userRole, c.type))
            .filter(([, c]) => { const s = new Date(c.startDate); s.setDate(1); s.setHours(0,0,0,0); return cellDate >= s; })
            .sort(([, a], [, b]) => (a.contractName || a.hospital || '').localeCompare(b.contractName || b.hospital || '', 'ar'));
        $('bkList').innerHTML = items.map(([id, c]) => {
            const st = UI.getStage((c.months || [])[idx]);
            const locked = ['at_finance', 'received'].includes(st) || st === target;
            const S = st ? UI.STAGES[st] : null;
            return `<label class="bulk-row"><input type="checkbox" class="bk-cb" value="${id}" ${locked ? 'disabled' : 'checked'}>
                <span class="bn">${E(c.contractName || c.hospital || id)}</span>
                <span class="pill ${st ? 'st-' + st : 'st-late'}">${UI.svg(S ? S.icon : 'x')}</span>
                <small style="color:#6b7788;min-width:96px">${S ? S.label : 'لم يُرفع'}</small></label>`;
        }).join('') || '<div class="empty-state">لا توجد عقود مناسبة لهذا الشهر</div>';
        updateCount();
    };
    const updateCount = () => { const n = document.querySelectorAll('.bk-cb:checked').length; $('bkCount').innerText = `المحدد: ${n} عقد`; };

    const { value: sel } = await Swal.fire({
        title: 'تحديث جماعي للمستخلصات',
        html: htmlForm,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: 'تنفيذ النقل',
        cancelButtonText: 'إلغاء',
        didOpen: () => {
            $('bkMonth').addEventListener('change', renderList);
            $('bkStage').addEventListener('change', () => { $('bkRevLbl').classList.toggle('required', $('bkStage').value === 'at_maintenance'); renderList(); });
            $('bkList').addEventListener('change', updateCount);
            $('bkAll').addEventListener('click', () => { document.querySelectorAll('.bk-cb:not(:disabled)').forEach(cb => cb.checked = true); updateCount(); });
            $('bkNone').addEventListener('click', () => { document.querySelectorAll('.bk-cb').forEach(cb => cb.checked = false); updateCount(); });
            $('bkRevLbl').classList.add('required');
            renderList();
        },
        preConfirm: () => {
            const ids = Array.from(document.querySelectorAll('.bk-cb:checked')).map(cb => cb.value);
            const stage = $('bkStage').value, reviewer = $('bkReviewer').value.trim();
            if (!ids.length) { Swal.showValidationMessage('اختر عقدًا واحدًا على الأقل'); return false; }
            if (NEEDS_REVIEWER.includes(stage) && !reviewer) { Swal.showValidationMessage('اكتب اسم المراجع'); return false; }
            return { ids, stage, reviewer, idx: parseInt($('bkMonth').value) };
        }
    });
    if (!sel) return;
    if (sel.reviewer) lsSet('kpi_last_reviewer', sel.reviewer);

    const nowTs = Date.now();
    const updates = {}, locals = {};
    sel.ids.forEach(id => {
        const c = appData.contracts[id]; if (!c || !canEdit(window.userRole, c.type)) return;
        const cur = (c.months || [])[sel.idx] || {};
        const from = UI.getStage(cur);
        if (['at_finance', 'received'].includes(from) || from === sel.stage) return;
        const hist = [...Object.values(cur.history || {}), cleanRecord({ from, to: sel.stage, by: roleLabel(), at: nowTs })];
        const base = cleanRecord({ ...cur, history: undefined, stage: sel.stage, financeStatus: UI.deriveFinanceStatus(sel.stage),
                                   reviewerName: sel.reviewer || cur.reviewerName, updatedBy: roleLabel() });
        locals[id] = { ...base, updatedAt: nowTs, history: hist };
        updates[`${id}/months/${sel.idx}`] = { ...base, updatedAt: DB.serverTs(),
            history: hist.map((h, i) => i === hist.length - 1 ? { ...h, at: DB.serverTs() } : h) };
    });
    const n = Object.keys(updates).length;
    if (!n) { UI.showToast('لا يوجد ما يتم تحديثه'); return; }
    try {
        await DB.updateData('app_db_v2/contracts', updates);
    } catch (e) {
        Swal.fire('تعذر الحفظ', 'حدث خطأ أثناء الحفظ، لم يتم تغيير أي عقد. حاول مرة أخرى', 'error');
        return;
    }
    Object.entries(locals).forEach(([id, rec]) => { const c = appData.contracts[id]; if (!c.months) c.months = []; c.months[sel.idx] = rec; });
    refreshView();
    UI.showToast(`تم تحديث ${n} عقد`);
};

window.editNote = async function(id) {
    const row = appData.contracts[id];
    if (!canEdit(window.userRole, row.type)) return;

    const { value: note } = await Swal.fire({
        title: 'ملاحظات العقد',
        input: 'textarea',
        inputValue: row.notes || '',
        showCancelButton: true,
        confirmButtonText: 'حفظ'
    });

    if (note !== undefined) {
        await DB.updateData(`app_db_v2/contracts/${id}`, { notes: note });
        row.notes = note;
        refreshView();
    }
};

// --- 4. Contract Management ---
window.prepareAddContract = async function() {
    if (window.userRole === 'viewer') return;

    let contractorOptions = '';
    Object.entries(appData.contractors).forEach(([id, c]) => { contractorOptions += `<option value="${id}">${UI.esc(c.name)}</option>`; });
    if (contractorOptions === '') { Swal.fire('تنبيه', 'أضف مقاولين أولاً', 'warning'); return; }

    // تحديد نوع العقد إجبارياً حسب المشرف
    let typeOptions = `<option value="طبي">طبي</option><option value="غير طبي">غير طبي</option>`;
    let fixedType = null;
    if (window.userRole === 'medical') {
        typeOptions = `<option value="طبي" selected>طبي</option>`;
        fixedType = 'طبي';
    } else if (window.userRole === 'non_medical') {
        typeOptions = `<option value="غير طبي" selected>غير طبي</option>`;
        fixedType = 'غير طبي';
    }

    const htmlForm = `
        <div class="popup-form-container">
            <div class="popup-full-width"><label class="popup-label">اسم العقد</label><input id="cName" class="swal2-input"></div>
            <div><label class="popup-label">رقم العقد</label><input id="cNum" class="swal2-input"></div>
            <div><label class="popup-label">القيمة</label><input id="cVal" type="number" class="swal2-input"></div>
            <div><label class="popup-label">البداية</label><input id="cStart" type="date" class="swal2-input"></div>
            <div><label class="popup-label">النهاية</label><input id="cEnd" type="date" class="swal2-input"></div>
            <div><label class="popup-label">النوع</label><select id="cType" class="swal2-select" ${fixedType ? 'disabled' : ''}>${typeOptions}</select></div>
            <div><label class="popup-label">المقاول</label><select id="cCont" class="swal2-select">${contractorOptions}</select></div>
        </div>`;

    const { value: formValues } = await Swal.fire({
        title: 'إضافة عقد جديد',
        html: htmlForm,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'إضافة',
        preConfirm: () => {
            const start = document.getElementById('cStart').value;
            const end = document.getElementById('cEnd').value;
            if(!start || !end) { Swal.showValidationMessage('يرجى تحديد التواريخ'); return false; }
            return {
                contractName: document.getElementById('cName').value,
                contractNumber: document.getElementById('cNum').value,
                value: document.getElementById('cVal').value,
                startDate: start,
                endDate: end,
                // إذا كان الحقل معطل، نستخدم القيمة الثابتة، وإلا نأخذ القيمة من الحقل
                type: fixedType || document.getElementById('cType').value,
                contractorId: document.getElementById('cCont').value,
                months: []
            };
        }
    });

    if (formValues) {
        const newId = Date.now().toString();
        await DB.saveData(`app_db_v2/contracts/${newId}`, formValues);
        appData.contracts[newId] = formValues;
        Swal.fire('نجاح', 'تم إضافة العقد', 'success');
        refreshView();
    }
};

window.prepareEditContract = async function(id) {
    if (window.userRole === 'viewer') return;
    const c = appData.contracts[id];
    
    // حماية إضافية
    if (!canEdit(window.userRole, c.type)) { Swal.fire('مرفوض', 'ليس لديك صلاحية تعديل هذا النوع من العقود', 'error'); return; }

    let contractorOptions = '';
    Object.entries(appData.contractors).forEach(([cid, cont]) => {
        contractorOptions += `<option value="${cid}" ${cid===c.contractorId?'selected':''}>${UI.esc(cont.name)}</option>`;
    });

    const htmlForm = `
        <div class="popup-form-container">
            <div class="popup-full-width"><label class="popup-label">اسم العقد</label><input id="ecName" class="swal2-input" value="${UI.esc(c.contractName||c.hospital||'')}"></div>
            <div><label class="popup-label">رقم العقد</label><input id="ecNum" class="swal2-input" value="${UI.esc(c.contractNumber||'')}"></div>
            <div><label class="popup-label">القيمة</label><input id="ecVal" type="number" class="swal2-input" value="${c.value||''}"></div>
            <div><label class="popup-label">البداية</label><input id="ecStart" type="date" class="swal2-input" value="${c.startDate||''}"></div>
            <div><label class="popup-label">النهاية</label><input id="ecEnd" type="date" class="swal2-input" value="${c.endDate||''}"></div>
            <div><label class="popup-label">النوع</label><select id="ecType" class="swal2-select"><option value="طبي" ${c.type==='طبي'?'selected':''}>طبي</option><option value="غير طبي" ${c.type==='غير طبي'?'selected':''}>غير طبي</option></select></div>
            <div><label class="popup-label">المقاول</label><select id="ecCont" class="swal2-select">${contractorOptions}</select></div>
        </div>`;

    const { value: formValues } = await Swal.fire({
        title: 'تعديل العقد',
        html: htmlForm,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        preConfirm: () => {
            return {
                contractName: document.getElementById('ecName').value,
                contractNumber: document.getElementById('ecNum').value,
                value: document.getElementById('ecVal').value,
                startDate: document.getElementById('ecStart').value,
                endDate: document.getElementById('ecEnd').value,
                type: document.getElementById('ecType').value,
                contractorId: document.getElementById('ecCont').value
            };
        }
    });

    if (formValues) {
        await DB.updateData(`app_db_v2/contracts/${id}`, formValues);
        Object.assign(appData.contracts[id], formValues);
        Swal.fire('نجاح', 'تم التعديل', 'success');
        refreshView();
    }
};

window.deleteContract = async function(id) {
    if (window.userRole === 'viewer') return;
    const c = appData.contracts[id];
    if (!canEdit(window.userRole, c.type)) { Swal.fire('مرفوض', 'ليس لديك صلاحية', 'error'); return; }

    const result = await Swal.fire({ title: 'حذف العقد؟', text: "لا يمكن التراجع", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'حذف' });
    if (result.isConfirmed) {
        await DB.deleteData(`app_db_v2/contracts/${id}`);
        delete appData.contracts[id];
        refreshView();
        Swal.fire('تم الحذف', '', 'success');
    }
};

// --- 5. Contractor Management ---
window.prepareAddContractor = async function() {
    if (window.userRole === 'viewer') return;
    const { value: name } = await Swal.fire({ title: 'إضافة مقاول', input: 'text', showCancelButton: true, confirmButtonText: 'إضافة' });
    if (name) {
        const newId = Date.now().toString();
        const data = { name: name };
        await DB.saveData(`app_db_v2/contractors/${newId}`, data);
        appData.contractors[newId] = data;
        refreshView();
    }
};

window.prepareEditContractor = async function(id, oldName) {
    if (window.userRole === 'viewer') return;
    const { value: name } = await Swal.fire({ title: 'تعديل', input: 'text', inputValue: oldName, showCancelButton: true, confirmButtonText: 'حفظ' });
    if (name) {
        await DB.updateData(`app_db_v2/contractors/${id}`, { name: name });
        appData.contractors[id].name = name;
        refreshView();
    }
};

window.deleteContractor = async function(id) {
    if (window.userRole === 'viewer') return;
    const result = await Swal.fire({ title: 'حذف المقاول؟', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'حذف' });
    if (result.isConfirmed) {
        await DB.deleteData(`app_db_v2/contractors/${id}`);
        delete appData.contractors[id];
        refreshView();
    }
};

// --- 6. Settings (Updated for 4 Roles) ---
window.openSettings = async function() {
    if (window.userRole !== 'super') return;
    const stored = await DB.getPasswords();
    const passwords = {
        super: stored.super || 'super123',
        medical: stored.medical || 'med123',
        non_medical: stored.non_medical || 'nonmed123',
        viewer: stored.viewer || 'view123'
    };

    const htmlForm = `
        <div class="popup-form-container">
            <div class="popup-full-width" style="text-align:center;color:#777;margin-bottom:10px;">تغيير كلمات مرور النظام</div>
            <div class="popup-full-width"><label class="popup-label">👑 سوبر أدمن</label><input id="pwSuper" class="swal2-input" value="${passwords.super}"></div>
            <div class="popup-full-width"><label class="popup-label">🩺 مشرف طبي</label><input id="pwMed" class="swal2-input" value="${passwords.medical}"></div>
            <div class="popup-full-width"><label class="popup-label">🏢 مشرف غير طبي</label><input id="pwNonMed" class="swal2-input" value="${passwords.non_medical}"></div>
            <div class="popup-full-width"><label class="popup-label">👀 مطلع (Viewer)</label><input id="pwView" class="swal2-input" value="${passwords.viewer}"></div>
        </div>`;

    const { value: formValues } = await Swal.fire({
        title: '⚙️ إعدادات النظام',
        html: htmlForm,
        width: '500px',
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        preConfirm: () => {
            return {
                super: document.getElementById('pwSuper').value,
                medical: document.getElementById('pwMed').value,
                non_medical: document.getElementById('pwNonMed').value,
                viewer: document.getElementById('pwView').value
            }
        }
    });

    if (formValues) {
        if(!formValues.super || !formValues.medical || !formValues.non_medical || !formValues.viewer) {
            Swal.fire('خطأ', 'لا تترك حقول فارغة', 'error'); return;
        }
        await DB.savePasswords(formValues);
        Swal.fire('تم', 'تم تحديث جميع كلمات المرور', 'success');
    }
};

// --- 7. System Functions ---
window.prepareMonthsUpdate = async function() {
    const months = []; const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    for (let y = 2024; y <= 2029; y++) { for (let m = 0; m < 12; m++) months.push(`${arMonths[m]} ${y}`); }
    await DB.saveData('app_db_v2/monthNames', months);
    appData.monthNames = months;
    const updates = [];
    Object.keys(appData.contracts).forEach(id => {
        const c = appData.contracts[id]; let cMonths = c.months || [];
        while(cMonths.length < months.length) cMonths.push({ financeStatus: 'late' });
        updates.push(DB.saveData(`app_db_v2/contracts/${id}/months`, cMonths));
        c.months = cMonths;
    });
    await Promise.all(updates);
    Swal.fire('تم', 'تم تحديث الشهور', 'success');
    refreshView();
};

window.systemReset = async function() {
    const { isConfirmed } = await Swal.fire({ title: 'تهيئة النظام؟', text: "سيتم حذف كل شيء!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'نعم' });
    if (isConfirmed) {
        await DB.saveData('app_db_v2', { contracts: {}, contractors: {}, monthNames: [] });
        location.reload();
    }
};

window.downloadBackup = async function(isAuto = false) {
    if (window.userRole !== 'super') return;
    if (!isAuto) UI.showToast("جاري تحضير النسخة...");
    try {
        const snapshot = await DB.getAllData(); const data = snapshot.val(); if (!data) return;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `KPI_Backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        if (!isAuto) UI.showToast("تم التحميل ✅");
        if (isAuto) localStorage.setItem('last_auto_backup', new Date().toDateString());
    } catch (error) { console.error(error); }
};

function checkAutoBackup() {
    const last = localStorage.getItem('last_auto_backup');
    if (last !== new Date().toDateString()) setTimeout(() => window.downloadBackup(true), 5000);
}

// --- 8. UI Helpers ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    const navItems = document.querySelectorAll('.nav-item');
    if(tabName==='table') navItems[0].classList.add('active');
    if(tabName==='contracts') navItems[1].classList.add('active');
    if(tabName==='contractors') navItems[2].classList.add('active');
    
    if (tabName === 'contracts') window.renderCards('contract');
    if (tabName === 'contractors') window.renderCards('contractor');
};

window.renderCards = function(type) { UI.renderCards(appData, type); };
window.exportToExcel = function() { UI.exportToExcel(appData, window.userRole, window.selectedYear); };
window.toggleNotifications = function() { UI.toggleNotifications(); };
// js/app.js (في النهاية)
window.printReport = function() {
    // نرسل البيانات الحالية والسنة المختارة والصلاحية لملف الطباعة
    PrintSystem.openPrintPage(appData, window.selectedYear, window.userRole);
};
// دالة إضافة شهر جديد بأمان (متوافقة مع الترتيب المعكوس)
window.addNewMonthSafely = async function() {
    if (window.userRole !== 'super') return;

    const { value: newMonth } = await Swal.fire({
        title: 'إضافة شهر جديد',
        input: 'text',
        inputLabel: 'اكتب اسم الشهر والسنة (مثال: فبراير 2026)',
        inputPlaceholder: 'فبراير 2026',
        showCancelButton: true,
        confirmButtonText: 'إضافة',
        cancelButtonText: 'إلغاء'
    });

    if (newMonth) {
        // 1. التأكد من عدم تكرار الشهر
        if (appData.monthNames && appData.monthNames.includes(newMonth)) {
            Swal.fire('تنبيه', 'هذا الشهر موجود بالفعل!', 'warning');
            return;
        }

        UI.showToast("جاري إضافة الشهر وتهيئة العقود...");

        // 2. إضافة الشهر في أعلى القائمة (Index 0)
        appData.monthNames.unshift(newMonth); // unshift تضع العنصر في البداية
        await DB.saveData('app_db_v2/monthNames', appData.monthNames);

        // 3. المرور على كل العقود لترحيل البيانات وتفريغ الخانة الأولى
        const updates = [];
        Object.keys(appData.contracts).forEach(id => {
            const c = appData.contracts[id];
            let cMonths = c.months || [];
            // إضافة خانة جديدة فارغة (تأخير افتراضي) في بداية مصفوفة العقد
            cMonths.unshift({ financeStatus: 'late' }); 
            updates.push(DB.saveData(`app_db_v2/contracts/${id}/months`, cMonths));
            c.months = cMonths;
        });

        await Promise.all(updates);
        Swal.fire('نجاح', `تم إضافة "${newMonth}" وتحديث الجدول بأمان.`, 'success');
        refreshView();
    }
};


////طباعة مخصصة
window.openCustomPrint = async function() {
    const { contracts, monthNames } = appData;
    let rows = Object.entries(contracts).map(([id, val]) => ({...val, id}));

    if (window.userRole === 'medical') rows = rows.filter(r => r.type === 'طبي');
    if (window.userRole === 'non_medical') rows = rows.filter(r => r.type === 'غير طبي');
    rows.sort((a, b) => (a.contractName||a.hospital||"").localeCompare(b.contractName||b.hospital||"", 'ar'));

    const availableYears = [...new Set((monthNames || []).map(m => m.split(' ')[1]))].sort();
    
    // بناء النافذة المنبثقة مع إضافة خيار الفترة الختامية
    let html = `
        <div style="background: #f8f9fa; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 5px; text-align:right;">
            <div style="font-weight:bold; margin-bottom: 8px; color:#0056b3;">1. اختر السنوات المطلوب فحصها:</div>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: flex-start;">
                ${availableYears.map(y => `
                    <label style="cursor:pointer; background:#fff; padding:4px 8px; border-radius:4px; border:1px solid #ccc;">
                        <input type="checkbox" class="print-year-cb" value="${y}" ${y == window.selectedYear ? 'checked' : ''} onchange="window.updatePrintPreview()"> ${y}
                    </label>
                `).join('')}
            </div>
        </div>

        <div style="background: #e9ecef; padding: 10px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 5px; text-align:right;">
            <div style="font-weight:bold; margin-bottom: 8px; color:#333;">2. إعدادات فترات التأخير:</div>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; font-size: 13px;">
                <label style="cursor: pointer; color: #2c3e50; font-weight: bold;">
                    <input type="checkbox" id="includeClosing" checked onchange="window.updatePrintPreview()"> تأخيرات الفترة الختامية
                </label>
                <label style="cursor: pointer; color: #2c3e50; font-weight: bold;">
                    <input type="checkbox" id="includeExtension" checked onchange="window.updatePrintPreview()"> تأخيرات التمديد (10%)
                </label>
                <label style="cursor: pointer; color: #2c3e50; font-weight: bold;">
                    <input type="checkbox" id="includeDirect" checked onchange="window.updatePrintPreview()"> تأخيرات الشراء المباشر
                </label>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 5px;">
            <label style="font-weight: bold; color: #856404; cursor: pointer;">
                <input type="checkbox" id="filterLateOnly" onchange="window.updatePrintPreview()" checked>
                عرض المتأخر فقط
            </label>
            ${(window.userRole === 'super' || window.userRole === 'viewer') ? `
            <select id="filterPrintType" onchange="window.updatePrintPreview()" style="padding: 4px; border-radius: 4px; border: 1px solid #ccc; font-family: Tajawal;">
                <option value="all">الكل (طبي وغير طبي)</option>
                <option value="طبي">طبي فقط</option>
                <option value="غير طبي">غير طبي فقط</option>
            </select>` : ''}
        </div>
        <div id="printCheckboxList" style="max-height: 220px; overflow-y: auto; text-align: right; border: 1px solid #ddd; padding: 10px; border-radius: 5px; background: #fff;">
        </div>
    `;

    window.updatePrintPreview = function() {
        const selectedYears = Array.from(document.querySelectorAll('.print-year-cb:checked')).map(cb => cb.value);
        const onlyLate = document.getElementById('filterLateOnly')?.checked || false;
        const typeFilter = document.getElementById('filterPrintType')?.value || 'all';
        
        // جلب قيم الفلاتر الجديدة
        const includeClosing = document.getElementById('includeClosing')?.checked || false;
        const includeExtension = document.getElementById('includeExtension')?.checked || false;
        const includeDirect = document.getElementById('includeDirect')?.checked || false;

        const listContainer = document.getElementById('printCheckboxList');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        const now = new Date(); const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        rows.forEach(r => {
            r.lateMonthsList = []; 
            const contractStartDate = new Date(r.startDate); contractStartDate.setDate(1); contractStartDate.setHours(0,0,0,0);
            const contractEndDate = new Date(r.endDate); contractEndDate.setDate(1); contractEndDate.setHours(0,0,0,0);
            
            // حساب بداية الفترة الختامية ونهاية التمديد
            const closingPeriodStart = new Date(contractEndDate); closingPeriodStart.setMonth(closingPeriodStart.getMonth() - 5);
            const extensionEndDate = new Date(contractEndDate); extensionEndDate.setMonth(extensionEndDate.getMonth() + 6);
            
            if (r.months && monthNames) {
                monthNames.forEach((mName, idx) => {
                    const [mAr, mYear] = mName.split(' '); 
                    if (selectedYears.includes(mYear)) { 
                        const md = r.months[idx] || {financeStatus: 'late'};
                        const mIdx = arMonths.indexOf(mAr);
                        const cellDate = new Date(parseInt(mYear), mIdx, 1);
                        
                        if (cellDate >= contractStartDate && cellDate < currentMonthStart && md.financeStatus === 'late') {
                            
                            let periodTag = "";
                            let shouldInclude = true;

                            // --- منطق الفترات الجديد ---
                            if (cellDate <= closingPeriodStart) {
                                // 1. فترة أساسية عادية (قبل الـ 5 شهور الأخيرة)
                                periodTag = "";
                            } else if (cellDate > closingPeriodStart && cellDate <= contractEndDate) {
                                // 2. فترة ختامية (آخر 5 شهور)
                                if (!includeClosing) shouldInclude = false;
                                periodTag = " (ختامي)";
                            } else if (cellDate > contractEndDate && cellDate <= extensionEndDate) {
                                // 3. فترة تمديد
                                if (!includeExtension) shouldInclude = false;
                                periodTag = " (تمديد)";
                            } else if (cellDate > extensionEndDate) {
                                // 4. فترة شراء مباشر
                                if (!includeDirect) shouldInclude = false;
                                periodTag = " (مباشر)";
                            }

                            if (shouldInclude) {
                                r.lateMonthsList.push(mName + periodTag);
                            }
                        }
                    }
                });
            }
            
            r.isLate = r.lateMonthsList.length > 0;
            const matchLate = onlyLate ? r.isLate : true;
            const matchType = typeFilter === 'all' ? true : (r.type === typeFilter);

            if (matchLate && matchType) {
                const title = r.contractName || r.hospital || "-";
                const lateText = r.isLate 
                    ? `<span style="color:#e74c3c; font-size:12px; font-weight:bold;">(متأخر في: ${r.lateMonthsList.join('، ')})</span>` 
                    : `<span style="color:#27ae60; font-size:11px;">(ملتزم)</span>`;
                
                listContainer.innerHTML += `
                    <div class="print-item-row" style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                        <label style="cursor: pointer; display: flex; align-items: flex-start; gap: 8px;">
                            <input type="checkbox" class="print-contract-cb" value="${r.id}" data-latetext="${r.lateMonthsList.join('، ')}" checked style="margin-top: 4px;">
                            <div style="flex:1;">
                                <div style="font-weight:bold; color:#333;">${title} <span style="font-size:10px; color:#777; font-weight:normal;">(${r.type})</span></div>
                                <div>${lateText}</div>
                            </div>
                        </label>
                    </div>
                `;
            }
        });
        if (listContainer.innerHTML === '') listContainer.innerHTML = '<div style="text-align:center; color:#777; padding:10px;">لا توجد بيانات مطابقة لهذه الفلاتر</div>';
    };

    const { isConfirmed } = await Swal.fire({
        title: 'التقرير التجميعي الشامل',
        html: html,
        width: '700px',
        didOpen: () => { window.updatePrintPreview(); },
        showCancelButton: true,
        confirmButtonText: '🖨️ طباعة التقرير التجميعي',
        cancelButtonText: 'إلغاء'
    });

    if (isConfirmed) {
        const selectedData = Array.from(document.querySelectorAll('.print-contract-cb:checked'))
            .map(cb => ({ id: cb.value, lateText: cb.getAttribute('data-latetext') }));
                                 
        if (selectedData.length === 0) { Swal.fire('تنبيه', 'لم تقم بتحديد أي موقع!', 'warning'); return; }
        
        const selectedYears = Array.from(document.querySelectorAll('.print-year-cb:checked')).map(cb => cb.value);
        
        import('./print.js').then(module => {
            module.printSummaryReport(appData, window.userRole, selectedData, selectedYears);
        });
    }
};


// --- سلوكيات عامة ---
// إغلاق القوائم المنسدلة عند الضغط خارجها أو على أحد عناصرها
document.addEventListener('click', e => {
    document.querySelectorAll('details.menu[open]').forEach(d => {
        if (!d.contains(e.target)) d.removeAttribute('open');
        else if (e.target.closest('.menu-list button')) setTimeout(() => d.removeAttribute('open'), 0);
    });
    const nd = document.getElementById('notifDropdown');
    if (nd && nd.style.display === 'block' && !e.target.closest('.notif-wrap')) nd.style.display = 'none';
});

// اختصار: الضغط على / يفتح البحث
document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey) return;
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || document.getElementById('swalForm') || document.getElementById('bulkForm')) return;
    const box = document.getElementById('searchHospital');
    if (box && document.getElementById('dashboard').style.display !== 'none') { e.preventDefault(); box.focus(); }
});

// استعادة الجلسة بعد تحديث الصفحة (تنتهي بإغلاق التبويب)
(function restoreSession() {
    let role = null;
    try { role = sessionStorage.getItem('kpi_role'); } catch (e) {}
    if (['super', 'medical', 'non_medical', 'viewer'].includes(role)) startSession(role);
})();
