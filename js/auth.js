export function checkLogin(inputPass, storedPasswords) {
    const cleanPass = String(inputPass).trim();
    
    if (cleanPass === '0000') return { role: 'viewer', name: '(زائر - عرض فقط)' };
    if (cleanPass == storedPasswords.super) return { role: 'super', name: '(مدير عام)' };
    if (cleanPass == storedPasswords.medical) return { role: 'medical', name: '(مشرف طبي)' };
    if (cleanPass == storedPasswords.non_medical) return { role: 'non_medical', name: '(مشرف غير طبي)' };
    
    return null; // فشل الدخول
}

export function canEdit(userRole, contractType) {
    if (!userRole || userRole === 'viewer') return false;
    if (userRole === 'super') return true;
    if (userRole === 'medical' && contractType === 'طبي') return true;
    if (userRole === 'non_medical' && contractType === 'غير طبي') return true;
    return false;
}
