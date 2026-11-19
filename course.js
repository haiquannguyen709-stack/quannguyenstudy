    // LƯU Ý: URL_TIEN_QUYET chỉ dùng để điều hướng thông thường, KHÔNG phải cơ chế bảo mật.
                const URL_TIEN_QUYET = "home.html";

    // Thay URL này bằng URL Web App Google Apps Script của bạn
            const API_BASE_URL = "https://script.google.com/macros/s/AKfycbznlE3h-C7a1oR7YHRE35b_2rn-_T7f8PeL8l6Ra2XEuAgnwq3at32_c3jkekg-7GumzA/exec";

            // Trạng thái cấu hình API: CHỈ trả về true khi API_BASE_URL là URL thật đã được điền.
            // Không đủ nếu chỉ bắt đầu bằng 'http': URL mẫu (có '...', <>, {}, YOUR_, EXAMPLE...), URL sai định dạng
            // hoặc không phải https (trừ localhost khi phát triển) đều bị coi là CHƯA cấu hình => không gửi request.
            function isApiBaseUrlConfigured() {
                if (typeof API_BASE_URL !== 'string') return false;
                var url = API_BASE_URL.trim();
                if (url === '' || /\s/.test(url)) return false;
                if (url.indexOf('...') !== -1 || /[<>{}\[\]]/.test(url) || /YOUR[_-]|EXAMPLE|PLACEHOLDER|XXXX/i.test(url)) return false;
                var parsed;
                try { parsed = new URL(url); } catch (e) { return false; }
                if (!parsed.hostname) return false;
                if (parsed.protocol === 'https:') return true;
                return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
            } 

                    // ============================================================
        // KHÓA HỌC HIỆN TẠI – QNS_COURSE
        // Nguồn DUY NHẤT của courseId trong course.js. Giá trị được đọc MỘT LẦN từ window.COURSE_CONFIG
        // (khai báo trong file HTML của từng khóa học) rồi giữ trong biến đóng kín: LocalStorage,
        // sessionStorage, tham số URL và payload gửi lên đều KHÔNG thể thay đổi nó.
        // Đây chỉ là lớp bảo vệ phía giao diện; backend mới là nơi xác minh quyền theo courseId.
        // ============================================================
        const QNS_COURSE = (function () {
            'use strict';
            const COURSE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;   // phải khớp quy tắc ở backend
            const SCOPED_ACTION_PATTERN = /^(course|lesson|section|subsection|progress|upload|submission|file|grading|comment)\./;
            let courseId = '';
            let configError = null;

            (function readConfig() {
                const cfg = window.COURSE_CONFIG;
                if (!cfg || typeof cfg !== 'object') {
                    configError = 'Trang này chưa khai báo COURSE_CONFIG. Vui lòng liên hệ quản trị viên.';
                    return;
                }
                const raw = cfg.COURSE_ID;
                if (typeof raw !== 'string' || raw.trim() === '') {
                    configError = 'Mã khóa học (COURSE_ID) đang để trống. Vui lòng liên hệ quản trị viên.';
                    return;
                }
                if (raw !== raw.trim() || !COURSE_ID_PATTERN.test(raw)) {
                    configError = 'Mã khóa học (COURSE_ID) không hợp lệ. Vui lòng liên hệ quản trị viên.';
                    return;
                }
                courseId = raw;
            })();

            if (configError) console.error('[QNS_COURSE] ' + configError);

            return Object.freeze({
                isValid: function () { return configError === null; },
                getId: function () { return courseId; },
                // [MULTI-COURSE] Khóa LocalStorage theo khóa học: <tên gốc>::<courseId>, để dữ liệu mô phỏng/bộ nhớ đệm của các khóa không dùng chung.
                storageKey: function (baseKey) { return String(baseKey) + '::' + (courseId || 'INVALID'); },
                getError: function () { return configError; },
                isCourseScopedAction: function (action) { return SCOPED_ACTION_PATTERN.test(String(action || '')); },
                validate: function () { return configError === null ? { ok: true } : { ok: false, message: configError }; }
            });
        })();

        const QNS_AUTH = (function () {
                'use strict';

                const CONFIG = {
                    REQUIRE_SERVER_VERIFIED_ROLE: true // Đã kích hoạt bảo mật
                };

                function isBackendConfigured() {
                    return typeof isApiBaseUrlConfigured === 'function' && isApiBaseUrlConfigured();
                }

                function getToken() {
                    return sessionStorage.getItem('qns_session_token');
                }
                
                // [SSO-7] Vai trò hiệu lực theo khóa học: CHỈ nằm trong bộ nhớ, không lưu Storage, không nhận từ client.
                let effectiveRole = null;

                function clearSession() {
                    effectiveRole = null;
                    sessionStorage.removeItem('qns_session_token');
                    sessionStorage.removeItem('qns_server_user');
                    sessionStorage.removeItem('qns_session_expires');
                    sessionStorage.removeItem('qns_session_abs_expires');
                }

                function getCurrentUser() {
                    try {
                        const userStr = sessionStorage.getItem('qns_server_user');
                        if (userStr) return JSON.parse(userStr);
                    } catch (e) { /* Xử lý khi parse lỗi */ }
                    return null;
                }

                function getAuthState() {
                    const user = getCurrentUser();
                    const hasToken = !!getToken();
                    return {
                        hasLocalSession: hasToken && !!user,
                        status: (hasToken && user) ? 'server-verified' : 'no-account',
                        reason: (hasToken && user) ? 'Phiên được xác thực phía máy chủ.' : 'Không tìm thấy dữ liệu phiên.',
                        fullName: user ? user.fullName : '',
                        studentId: user ? user.userId : '',
                        username: user ? user.username : '',
                        serverVerified: !!user
                    };
                }

                async function verifySessionWithBackend() {
                    if (!isBackendConfigured()) return { verified: false, reason: 'backend-not-configured' };
                    const token = getToken();
                    if (!token) return { verified: false, reason: 'no-token' };

                    const r = await callBackend('auth.verify', { token: token, courseId: QNS_COURSE.getId() });
                    if (r.ok && r.data && r.data.user) {
                        const su = r.data.user;
                        sessionStorage.setItem('qns_server_user', JSON.stringify({ userId: su.userId, username: su.username, fullName: su.fullName, status: su.status }));
                        let serverRole = r.data.effectiveRole;
                        if (serverRole === undefined) serverRole = (su.role === 'teacher' || su.role === 'admin') ? su.role : 'student'; // backend cũ chưa trả effectiveRole
                        effectiveRole = (serverRole === 'student' || serverRole === 'teacher' || serverRole === 'admin') ? serverRole : null;
                        if (!effectiveRole) return { verified: false, forbidden: true, code: 'FORBIDDEN', reason: 'Không xác định được vai trò trong khóa học.' };
                        storeExpiry(r.data, r.serverTime);
                        return { verified: true };
                    }
                    if (!r.ok && !r.network && r.code === 'UNAUTHENTICATED') {
                        handleUnauthenticated(r.message);
                        return { verified: false, unauthenticated: true, reason: r.message };
                    }
                    if (!r.ok && !r.network && (r.code === 'FORBIDDEN' || r.code === 'NOT_FOUND')) {
                        effectiveRole = null;
                        return { verified: false, forbidden: true, code: r.code, reason: r.message };
                    }
                    if (!r.ok && !r.network && r.code === 'VALIDATION_FAILED') {
                        effectiveRole = null;
                        return { verified: false, config: true, code: r.code, reason: r.message };
                    }
                    // Lỗi mạng / lỗi máy chủ tạm thời: KHÔNG xóa phiên
                    return { verified: false, transient: true, reason: r.network ? 'Lỗi kết nối máy chủ' : r.message };
                }

                async function verifySessionWithBackend_LEGACY_DISABLED() {
                    if (!isBackendConfigured()) return { verified: false, reason: 'backend-not-configured' };
                    
                    const token = getToken();
                    if (!token) return { verified: false, reason: 'no-token' };
                    
                    try {
                        const response = await fetch(API_BASE_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({ action: 'auth.verify', token: token })
                        });
                        const result = await response.json();
                        
                        if (result.success && result.data && result.data.user) {
                            sessionStorage.setItem('qns_server_user', JSON.stringify(result.data.user));
                            return { verified: true };
                        } else {
                            clearSession();
                            return { verified: false, reason: result.message || 'Phiên không hợp lệ' };
                        }
                    } catch (e) {
                        return { verified: false, reason: 'Lỗi kết nối máy chủ' };
                    }
                }

                // ==================== [L4] VÒNG ĐỜI SESSION ====================
                const KEY_EXP = 'qns_session_expires';
                const KEY_ABS = 'qns_session_abs_expires';
                const HOME_URL = 'home.html';
                const REFRESH_WHEN_REMAINING_MS = 12 * 60 * 60 * 1000; // gia hạn khi còn <= 12 giờ (phiên trượt 24 giờ)
                const MIN_TIMER_MS = 5000;
                const MAX_TIMER_MS = 6 * 60 * 60 * 1000;
                let refreshTimer = null;      // DUY NHẤT một timer cho mỗi tab
                let refreshPromise = null;    // DUY NHẤT một request refresh cùng lúc
                let unauthHandled = false;    // đảm bảo chỉ xử lý hết phiên/đăng xuất MỘT lần
                let keeperStarted = false;
                let skewMs = 0;               // lệch giờ giữa máy chủ và máy khách (ADR-12)
                const authChannel = (typeof BroadcastChannel === 'function') ? new BroadcastChannel('qns_auth_v1') : null;

                function fingerprint(t) { // băm 32-bit KHÔNG đảo ngược được, chỉ để nhận biết "cùng phiên" giữa các tab; không lộ token
                    let h = 5381;
                    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
                    return String(h);
                }

                function readMs(key) {
                    const v = sessionStorage.getItem(key);
                    const t = v ? new Date(v).getTime() : NaN;
                    return isNaN(t) ? null : t;
                }

                function nowServerMs() { return Date.now() + skewMs; }

                function storeExpiry(data, serverTime) {
                    if (serverTime) {
                        const s = new Date(serverTime).getTime();
                        if (!isNaN(s)) skewMs = s - Date.now();
                    }
                    if (data && data.expiresAt) sessionStorage.setItem(KEY_EXP, String(data.expiresAt).replace(/^'+/, ''));
                    if (data && data.absoluteExpiresAt) sessionStorage.setItem(KEY_ABS, String(data.absoluteExpiresAt).replace(/^'+/, ''));
                }

                function postToChannel(msg, token) {
                    try { if (authChannel && token) authChannel.postMessage(Object.assign({ fp: fingerprint(token) }, msg)); } catch (e) { /* bỏ qua */ }
                }

                function stopRefreshTimer() {
                    if (refreshTimer !== null) { clearTimeout(refreshTimer); refreshTimer = null; }
                }

                // Lỗi API giữ đủ code/message/status/data
                function createApiError(info) {
                    const err = new Error(info && info.message ? info.message : 'Lỗi hệ thống');
                    err.name = 'ApiError';
                    err.code = (info && info.code) || 'UNKNOWN';
                    err.status = info ? info.status : undefined;
                    err.data = (info && info.data !== undefined) ? info.data : null;
                    err.retryable = !!(info && info.retryable);
                    err.isNetworkError = err.code === 'NETWORK_ERROR';
                    return err;
                }

                // Gọi thẳng Backend (không phụ thuộc API.request để dùng được ngay cả khi API chưa khởi tạo)
                async function callBackend(action, payload) {
                    let result;
                    try {
                        const response = await fetch(API_BASE_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify(Object.assign({ action: action }, payload || {}))
                        });
                        result = await response.json();
                    } catch (e) {
                        return { ok: false, network: true, code: 'NETWORK_ERROR', message: 'Lỗi kết nối máy chủ' };
                    }
                    if (result && result.success) return { ok: true, data: result.data, serverTime: result.serverTime };
                    return { ok: false, network: false, code: (result && result.code) || 'UNKNOWN', message: (result && result.message) || 'Lỗi hệ thống', retryable: !!(result && result.retryable) };
                }

                function redirectToHome(notice) {
                    try { if (notice) sessionStorage.setItem('qns_auth_notice', notice); } catch (e) { /* bỏ qua */ }
                    try { document.body.classList.remove('access-checking', 'access-granted'); document.body.classList.add('access-denied'); } catch (e) { /* bỏ qua */ }
                    window.location.replace(HOME_URL);
                }

                // ==================== [SSO-7] CỔNG TRUY CẬP THEO KHÓA HỌC ====================
                const LOGIN_URL = 'index.html';

                // Hết phiên / đăng xuất: xóa loggedInUser + mọi khóa qns_*, về index.html (KHÔNG về home để tránh vòng lặp)
                function redirectToLogin(notice) {
                    try {
                        effectiveRole = null;
                        sessionStorage.removeItem('loggedInUser');
                        const keys = [];
                        for (let i = 0; i < sessionStorage.length; i++) {
                            const k = sessionStorage.key(i);
                            if (k && k.indexOf('qns_') === 0) keys.push(k);
                        }
                        keys.forEach(function (k) { sessionStorage.removeItem(k); });
                    } catch (e) { /* bỏ qua */ }
                    try { if (notice) sessionStorage.setItem('qns_auth_notice', notice); } catch (e) { /* bỏ qua */ }
                    try { document.body.classList.remove('access-checking', 'access-granted'); document.body.classList.add('access-denied'); } catch (e) { /* bỏ qua */ }
                    window.location.replace(LOGIN_URL);
                }

                let deniedBound = false;
                // Màn từ chối: GIỮ Session. kind = 'forbidden' | 'config' | 'retry'
                function showDenied(message, kind) {
                    try {
                        document.body.classList.remove('access-checking', 'access-granted');
                        document.body.classList.add('access-denied');
                        document.body.dataset.authVerified = 'false';
                        const msgEl = document.querySelector('#access-denied-screen .access-denied-message');
                        if (msgEl && message) msgEl.textContent = message;

                        const backBtn = document.getElementById('btn-access-denied-back');
                        if (backBtn && !deniedBound) {
                            deniedBound = true;
                            backBtn.addEventListener('click', function () { window.location.href = HOME_URL; });
                        }
                        if (backBtn) {
                            let retryBtn = document.getElementById('btn-access-denied-retry');
                            if (kind === 'retry' && !retryBtn) {
                                retryBtn = document.createElement('button');
                                retryBtn.id = 'btn-access-denied-retry';
                                retryBtn.type = 'button';
                                retryBtn.className = backBtn.className;
                                retryBtn.textContent = 'Thử lại';
                                retryBtn.style.marginRight = '8px';
                                retryBtn.addEventListener('click', function () { window.location.reload(); });
                                backBtn.parentNode.insertBefore(retryBtn, backBtn);
                            }
                            if (retryBtn) retryBtn.style.display = (kind === 'retry') ? '' : 'none';
                        }
                    } catch (e) { /* bỏ qua */ }
                }

                // Cổng truy cập bất đồng bộ: chỉ trả { ok:true, role } khi BACKEND xác nhận Session + quyền ở khóa này
                async function authorizeCourse() {
                    const cc = QNS_COURSE.validate();
                    if (!cc.ok) { showDenied(cc.message, 'config'); return { ok: false, code: 'COURSE_CONFIG_INVALID' }; }
                    if (!isBackendConfigured()) { showDenied('Hệ thống chưa được cấu hình máy chủ. Vui lòng liên hệ quản trị viên.', 'config'); return { ok: false, code: 'BACKEND_NOT_CONFIGURED' }; }
                    if (!getToken()) { redirectToLogin('Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.'); return { ok: false, code: 'UNAUTHENTICATED' }; }

                    const v = await verifySessionWithBackend();
                    if (v.verified) {
                        document.body.classList.remove('access-checking', 'access-denied');
                        document.body.classList.add('access-granted');
                        document.body.dataset.authVerified = 'true';
                        return { ok: true, role: effectiveRole };
                    }
                    if (v.unauthenticated) return { ok: false, code: 'UNAUTHENTICATED' };   // handleUnauthenticated đã chuyển trang
                    if (v.forbidden) { showDenied('Bạn chưa được cấp quyền vào khóa học này.', 'forbidden'); return { ok: false, code: 'FORBIDDEN' }; }
                    if (v.config) { showDenied(v.reason || 'Mã khóa học không hợp lệ. Vui lòng liên hệ quản trị viên.', 'config'); return { ok: false, code: 'COURSE_CONFIG_INVALID' }; }
                    showDenied('Không thể kết nối máy chủ để xác minh quyền truy cập. Vui lòng thử lại.', 'retry');
                    return { ok: false, code: 'TRANSIENT' };
                }
                // ==================== HẾT KHỐI [SSO-7] ====================

                // Xử lý TẬP TRUNG hết phiên: chỉ chạy một lần
                function handleUnauthenticated(message) {
                    if (unauthHandled) return;
                    unauthHandled = true;
                    stopRefreshTimer();
                    const token = getToken();
                    postToChannel({ type: 'logout' }, token);
                    clearSession();
                    if (window.QNS_STORE) { window.QNS_STORE.isLoaded = false; window.QNS_STORE.progressLoaded = false; }
                    redirectToLogin('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                }

                // Gia hạn: một request tại một thời điểm, và chỉ một tab giữ khóa tại một thời điểm
                function refreshSession() {
                    if (unauthHandled || !getToken()) return Promise.resolve({ ok: false, skipped: true });
                    if (refreshPromise) return refreshPromise;

                    const exec = async function () {
                        const token = getToken();
                        if (!token) return { ok: false, skipped: true };
                        const before = readMs(KEY_EXP);
                        const r = await callBackend('auth.refresh', { token: token });
                        if (r.ok) {
                            storeExpiry(r.data, r.serverTime);
                            postToChannel({ type: 'refreshed', expiresAt: sessionStorage.getItem(KEY_EXP), absoluteExpiresAt: sessionStorage.getItem(KEY_ABS) }, token);
                            const after = readMs(KEY_EXP);
                            const stalled = before !== null && after !== null && after <= before;
                            scheduleRefresh(stalled ? 5 * 60 * 1000 : undefined);
                            return { ok: true };
                        }
                        if (!r.network && r.code === 'UNAUTHENTICATED') {
                            handleUnauthenticated(r.message);
                            return { ok: false, code: r.code };
                        }
                        // Lỗi mạng / máy chủ tạm thời: GIỮ phiên, thử lại sau 60 giây
                        scheduleRefresh(60 * 1000);
                        return { ok: false, code: r.code, transient: true };
                    };

                    const guarded = (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request)
                        ? navigator.locks.request('qns_auth_refresh', { ifAvailable: true }, function (lock) { return lock ? exec() : Promise.resolve({ ok: false, skipped: true }); })
                        : exec();

                    refreshPromise = Promise.resolve(guarded).then(function (res) {
                        if (res && res.skipped && !unauthHandled) scheduleRefresh(30 * 1000); // tab khác đang refresh: chờ thông báo của tab đó
                        return res;
                    }).finally(function () { refreshPromise = null; });
                    return refreshPromise;
                }

                function maybeRefresh() {
                    if (unauthHandled || !getToken() || !isBackendConfigured()) return;
                    const exp = readMs(KEY_EXP);
                    if (exp === null || exp - nowServerMs() <= REFRESH_WHEN_REMAINING_MS) refreshSession();
                    else scheduleRefresh();
                }

                function scheduleRefresh(overrideMs) {
                    stopRefreshTimer();
                    if (unauthHandled || !getToken() || !isBackendConfigured()) return;
                    const exp = readMs(KEY_EXP);
                    const abs = readMs(KEY_ABS);
                    const now = nowServerMs();

                    // Đã chạm trần tuyệt đối: không refresh nữa, chỉ kiểm tra khi tới hạn để chuyển về home.html
                    if (exp !== null && abs !== null && exp >= abs - 1000) {
                        const wait = Math.min(Math.max(15000, abs - now + 1500), MAX_TIMER_MS);
                        refreshTimer = setTimeout(function () {
                            refreshTimer = null;
                            verifySessionWithBackend().then(function (v) { if (v.verified || v.transient) scheduleRefresh(); });
                        }, wait);
                        return;
                    }

                    let delay;
                    if (typeof overrideMs === 'number') delay = overrideMs;
                    else if (exp === null) delay = MIN_TIMER_MS;
                    else delay = (exp - now) - REFRESH_WHEN_REMAINING_MS;
                    delay = Math.min(Math.max(delay, MIN_TIMER_MS), MAX_TIMER_MS);

                    refreshTimer = setTimeout(function () {
                        refreshTimer = null;
                        if (document.hidden) return; // tab ẩn: dừng; khi tab hiện lại sẽ kiểm tra (visibilitychange)
                        maybeRefresh();
                    }, delay);
                }

                // Khởi động duy nhất một lần: xác minh với Backend, lấy mốc hết hạn, lên lịch refresh, đồng bộ giữa các tab
                async function startSessionKeeper(opts) {
                    if (keeperStarted || !isBackendConfigured() || !getToken()) return;
                    keeperStarted = true;

                    if (authChannel) {
                        authChannel.onmessage = function (ev) {
                            const m = ev && ev.data;
                            const token = getToken();
                            if (!m || !m.fp || !token || m.fp !== fingerprint(token) || unauthHandled) return;
                            if (m.type === 'logout') {
                                unauthHandled = true;
                                stopRefreshTimer();
                                clearSession();
                                redirectToLogin('Phiên đăng nhập đã kết thúc ở một tab khác.');
                            } else if (m.type === 'refreshed') {
                                const exp = new Date(m.expiresAt).getTime();
                                const cur = readMs(KEY_EXP);
                                if (!isNaN(exp) && (cur === null || exp > cur)) {
                                    sessionStorage.setItem(KEY_EXP, m.expiresAt);
                                    if (m.absoluteExpiresAt) sessionStorage.setItem(KEY_ABS, m.absoluteExpiresAt);
                                    scheduleRefresh();
                                }
                            }
                        };
                    }
                    document.addEventListener('visibilitychange', function () { if (!document.hidden) maybeRefresh(); });
                    window.addEventListener('online', function () { maybeRefresh(); });

                    if (opts && opts.skipInitialVerify) { scheduleRefresh(); return; }
                    const v = await verifySessionWithBackend();
                    if (v.unauthenticated) return;
                    scheduleRefresh();
                }

                // Đăng xuất chủ động: gọi auth.logout, dù Backend lỗi vẫn xóa phiên phía Client
                async function logout() {
                    if (unauthHandled) return;
                    unauthHandled = true;
                    stopRefreshTimer();
                    const token = getToken();
                    let confirmed = false;
                    if (token && isBackendConfigured()) {
                        try {
                            const r = await Promise.race([
                                callBackend('auth.logout', { token: token }),
                                new Promise(function (resolve) { setTimeout(function () { resolve({ ok: false }); }, 8000); })
                            ]);
                            confirmed = r.ok === true;
                        } catch (e) { confirmed = false; }
                    }
                    postToChannel({ type: 'logout' }, token);
                    clearSession();
                    redirectToLogin(confirmed ? 'Bạn đã đăng xuất.' : 'Đã đăng xuất trên thiết bị này. Máy chủ chưa xác nhận thu hồi phiên.');
                }

                // Nút đăng xuất: gắn thuộc tính data-qns-logout (hoặc id btn-logout / logout-btn)
                document.addEventListener('click', function (e) {
                    const b = e.target && e.target.closest ? e.target.closest('[data-qns-logout], #btn-logout, #logout-btn') : null;
                    if (!b) return;
                    e.preventDefault();
                    logout();
                });

                // Quay lại bằng nút Back (bfcache) khi phiên đã bị xóa
                window.addEventListener('pageshow', function (ev) {
                    if (ev.persisted && !getToken() && !unauthHandled) { unauthHandled = true; redirectToLogin('Phiên đăng nhập không còn hiệu lực.'); }
                });
                // ==================== HẾT KHỐI [L4] ====================

                function checkLoginForCourse() {
                    const state = getAuthState();
                    if (state.hasLocalSession) return { ok: true, reason: state.status, message: '', state: state };
                    return { ok: false, reason: state.status, message: 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.', state: state };
                }

                function checkTeacherPermission() {
                    const state = getAuthState();
                    if (!state.hasLocalSession || !effectiveRole) return { allowed: false, verified: false, reason: 'not-verified' };

                    const user = getCurrentUser();
                    // Phân quyền thực sự dựa vào role máy chủ trả về
                    if (effectiveRole === 'teacher' || effectiveRole === 'admin') {
                        return { allowed: true, verified: true, reason: 'server-verified' };
                    }
                    
                    return { allowed: false, verified: true, reason: 'not-teacher' };
                }

                function requireTeacher(actionName) {
                    const result = checkTeacherPermission();
                    if (!result.allowed) {
                        console.warn('[QNS_AUTH] Từ chối thao tác "' + actionName + '": ' + result.reason);
                        if (typeof window.showAppAlert === 'function') {
                            window.showAppAlert({ type: 'error', title: 'Không đủ quyền', message: 'Bạn không có quyền thực hiện thao tác này.' });
                        }
                        return false;
                    }
                    return true;
                }

                return {
                    CONFIG: CONFIG,
                    isBackendConfigured: isBackendConfigured,
                    getToken: getToken,
                    clearSession: clearSession,
                    getCurrentUser: getCurrentUser,
                    getAuthState: getAuthState,
                    verifySessionWithBackend: verifySessionWithBackend,
                    checkLoginForCourse: checkLoginForCourse,
                    checkTeacherPermission: checkTeacherPermission,
                    requireTeacher: requireTeacher,
                    handleUnauthenticated: handleUnauthenticated,
                    createApiError: createApiError,
                    startSessionKeeper: startSessionKeeper,
                    refreshSession: refreshSession,
                    maybeRefresh: maybeRefresh,
                    logout: logout,
                    authorizeCourse: authorizeCourse,
                    redirectToLogin: redirectToLogin,
                    showDenied: showDenied,
                    getEffectiveRole: function () { return effectiveRole; },
                    isSessionInvalidated: function () { return unauthHandled; }
                };
            })();

            // 1. CẤU HÌNH THỜI GIAN TẬP TRUNG (Format ISO 8601: YYYY-MM-DDTHH:mm:ss)
                const courseSchedule = {
                    lesson1: {
                        open: "2026-10-14T13:45:00",
                        close: "2026-10-14T16:00:00"
                    },
                    doc1: {
                        open: null,
                        close: null
                    },
                    doc2: {
                        open: null,
                        close: null
                    },
                    lesson2: {
                        open: "2026-10-22T21:00:00",
                        close: "2026-10-22T23:00:00"
                    },
                    lesson21: {
                        open: "2026-11-01T06:45:00",
                        close: "2026-11-01T08:00:00"
                    }
                };
                // Hàm chuyển đổi chuỗi YYYY-MM-DDTHH:mm:ss thành Date Object chính xác theo múi giờ Việt Nam (+07:00)
                function parseVietnamDate(isoString) {
                    if (!isoString) return null;
                    // Nếu chưa có đuôi múi giờ, tự động thêm +07:00 (Múi giờ Việt Nam)
                    const formattedString = isoString.includes("+") || isoString.endsWith("Z") 
                        ? isoString 
                        : `${isoString}+07:00`;
                    return new Date(formattedString);
                }

                // Format milliseconds sang HH:MM:SS
                function formatCountdown(ms) {
                    if (ms <= 0) return "00:00:00";
                    const totalSeconds = Math.floor(ms / 1000);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;

                    const pad = (num) => String(num).padStart(2, '0');
                    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                }

                // Cập nhật trạng thái hiển thị của toàn bộ khóa học
                // ==========================================================================
                // LỊCH MỞ/ĐÓNG BÀI HỌC (CHỈ HIỂN THỊ – KHÔNG PHẢI RANH GIỚI BẢO MẬT)
                // Tầng 1: nguồn thời gian        -> getCurrentServerTime()
                // Tầng 2: tính trạng thái (thuần) -> computeLessonScheduleState()
                // Tầng 3: cập nhật giao diện      -> renderLessonSchedule() / updateCourseScheduleUI()
                // ==========================================================================

                // Nguồn thời gian. Hiện chỉ có đồng hồ máy khách (dễ bị người dùng đổi giờ máy).
                // [BACKEND-TODO] Khi có Backend, gọi setServerTimeReference(<thời gian máy chủ>) một lần
                // sau khi tải trang (và định kỳ) để chuyển sang thời gian máy chủ. Sau khi được gọi,
                // thời gian trôi theo performance.now() nên đổi giờ hệ thống không còn ảnh hưởng hiển thị.
                // Lưu ý: dù vậy, quyền mở/đóng bài vẫn phải do Backend kiểm tra khi truy cập.
                const QNS_TIME_SOURCE = { verified: false, serverBaseMs: 0, perfBaseMs: 0 };

                function getCurrentServerTime() {
                    if (QNS_TIME_SOURCE.verified) {
                        return new Date(QNS_TIME_SOURCE.serverBaseMs + (performance.now() - QNS_TIME_SOURCE.perfBaseMs));
                    }
                    return new Date(); // Fallback: đồng hồ máy khách, CHƯA được xác thực
                }

                // [BACKEND-TODO] Chỉ gọi với dữ liệu thời gian thật do Backend trả về.
                function setServerTimeReference(serverIsoString) {
                    const serverMs = new Date(serverIsoString).getTime();
                    if (isNaN(serverMs)) return false;
                    QNS_TIME_SOURCE.serverBaseMs = serverMs;
                    QNS_TIME_SOURCE.perfBaseMs = performance.now();
                    QNS_TIME_SOURCE.verified = true;
                    return true;
                }

                function toValidScheduleDate(value) {
                    if (!value) return null;
                    const d = parseVietnamDate(value);
                    return d && !isNaN(d.getTime()) ? d : null;
                }

                // Lấy hạn mở/đóng của bài theo ID: ưu tiên dữ liệu giáo viên đã lưu (trường open/close,
                // KHÔNG phải settings.schedule.startAt/endAt là lịch học), dự phòng là courseSchedule[ID].
                // [BACKEND-TODO] Thay bằng dữ liệu bài học do máy chủ trả về.
                function getLessonScheduleConfig(lessonId) {
                    if (isApiBaseUrlConfigured()) { // [T09A] không còn điều kiện isLoaded
                        if (QNS_AUTH.checkTeacherPermission().allowed) return { open: null, close: null };
                        const srvLesson = ((window.QNS_STORE && window.QNS_STORE.lessons) || []).find(function (l) { return l && l.id === lessonId; });
                        return srvLesson ? { open: srvLesson.open || null, close: srvLesson.close || null } : { open: null, close: null };
                    }
                    try {
                        const stored = JSON.parse(localStorage.getItem(QNS_COURSE.storageKey('qns_custom_lessons')) || 'null');
                        if (Array.isArray(stored)) {
                            const lesson = stored.find(function (l) { return l && l.id === lessonId; });
                            if (lesson) return { open: lesson.open || null, close: lesson.close || null };
                        }
                    } catch (e) { /* dữ liệu hỏng: dùng dự phòng */ }
                    if (Object.prototype.hasOwnProperty.call(courseSchedule, lessonId)) {
                        const fb = courseSchedule[lessonId];
                        return { open: fb.open || null, close: fb.close || null };
                    }
                    return { open: null, close: null };
                }

                // Hàm thuần: không đụng DOM, không gọi new Date().
                function computeLessonScheduleState(config, nowMs) {
                    const openDate = toValidScheduleDate(config.open);
                    const closeDate = toValidScheduleDate(config.close);
                    const openMs = openDate ? openDate.getTime() : null;
                    const closeMs = closeDate ? closeDate.getTime() : null;

                    if (openMs === null && closeMs === null) return { state: 'unlimited', openMs: openMs, closeMs: closeMs };
                    if (openMs !== null && nowMs < openMs) return { state: 'upcoming', openMs: openMs, closeMs: closeMs };
                    if (closeMs !== null && nowMs >= closeMs) return { state: 'closed', openMs: openMs, closeMs: closeMs };
                    return { state: 'open', openMs: openMs, closeMs: closeMs };
                }

                // Điểm mở rộng kiểm tra quyền vào bài.
                // [BACKEND-TODO] Sau này thay bằng kết quả từ Backend. Hiện chỉ phản ánh trạng thái HIỂN THỊ.
                function checkLessonAccess(lessonId) {
                    const info = computeLessonScheduleState(getLessonScheduleConfig(lessonId), getCurrentServerTime().getTime());
                    return {
                        allowed: info.state === 'unlimited' || info.state === 'open',
                        state: info.state,
                        enforcedBy: 'frontend-display-only',
                        timeVerified: QNS_TIME_SOURCE.verified
                    };
                }

                function setScheduleText(el, text) {
                    if (el && el.textContent !== text) el.textContent = text;
                }

                function setScheduleClass(el, cls) {
                    if (el && el.className !== cls) el.className = cls;
                }

                function setScheduleAction(btn, text, enabled) {
                    if (!btn) return;
                    if (btn.hasAttribute('data-qns-idle-html')) return;   // [QNS_UI] nút đang Loading: không ghi đè spinner
                    setScheduleText(btn, text);
                    btn.classList.toggle('disabled', !enabled);
                    if (enabled) btn.removeAttribute('aria-disabled');
                    else btn.setAttribute('aria-disabled', 'true');
                }

                // Chỉ tạo badge/countdown cho bài CÓ giới hạn thời gian, gắn đúng ID bài học.
                function ensureScheduleElements(item, lessonId) {
                    const container = item.querySelector('.lesson-title-container');
                    if (!container) return { badge: null, countdown: null };
                    let badge = container.querySelector('[data-badge-for]');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'status-badge';
                        container.appendChild(badge);
                    }
                    badge.setAttribute('data-badge-for', lessonId);
                    let countdown = container.querySelector('[data-countdown-for]');
                    if (!countdown) {
                        countdown = document.createElement('span');
                        countdown.className = 'countdown-text';
                        container.appendChild(countdown);
                    }
                    countdown.setAttribute('data-countdown-for', lessonId);
                    return { badge: badge, countdown: countdown };
                }

                // Cập nhật giao diện cho ĐÚNG MỘT thẻ bài học (không ảnh hưởng bài khác).
                function renderLessonSchedule(item, nowMs) {
                    const lessonId = (item.getAttribute('data-schedule-id') || '').trim();
                    if (!lessonId) return;

                    const actionBtn = item.querySelector('.btn-action');
                    if (actionBtn) {
                        actionBtn.setAttribute('data-action-for', lessonId);
                        if (!actionBtn.hasAttribute('data-default-text')) {
                            const t = actionBtn.textContent.trim();
                            actionBtn.setAttribute('data-default-text', (t && t !== 'Chưa mở' && t !== 'Đã đóng') ? t : 'Vào học');
                        }
                    }
                    const defaultText = actionBtn ? actionBtn.getAttribute('data-default-text') : 'Vào học';
                    const info = computeLessonScheduleState(getLessonScheduleConfig(lessonId), nowMs);

                    // Không giới hạn thời gian: không hiển thị gì thêm, giữ nút hoạt động bình thường
                    if (info.state === 'unlimited') {
                        item.querySelectorAll('[data-badge-for], [data-countdown-for]').forEach(function (el) { el.remove(); });
                        item.removeAttribute('data-schedule-active');
                        setScheduleAction(actionBtn, defaultText, true);
                        return;
                    }

                    const els = ensureScheduleElements(item, lessonId);
                    const badge = els.badge;
                    const countdown = els.countdown;
                    if (countdown && !QNS_TIME_SOURCE.verified) {
                        countdown.title = 'Tính theo đồng hồ thiết bị, chưa được máy chủ xác thực.';
                    }

                    if (info.state === 'upcoming') {
                        setScheduleText(badge, 'Chưa mở');
                        setScheduleClass(badge, 'status-badge upcoming');
                        setScheduleText(countdown, '• Mở sau: ' + formatCountdown(info.openMs - nowMs));
                        setScheduleClass(countdown, 'countdown-text upcoming');
                        if (countdown) countdown.style.display = '';
                        setScheduleAction(actionBtn, 'Chưa mở', false);
                        item.setAttribute('data-schedule-active', '1');
                    } else if (info.state === 'closed') {
                        setScheduleText(badge, 'Đã đóng');
                        setScheduleClass(badge, 'status-badge closed');
                        setScheduleText(countdown, '• Đã kết thúc');
                        setScheduleClass(countdown, 'countdown-text closed');
                        if (countdown) countdown.style.display = '';
                        setScheduleAction(actionBtn, 'Đã đóng', false);
                        item.removeAttribute('data-schedule-active'); // Trạng thái cuối: không cần cập nhật nữa
                    } else {
                        setScheduleText(badge, 'Đang mở');
                        setScheduleClass(badge, 'status-badge open');
                        if (info.closeMs !== null) {
                            setScheduleText(countdown, '• Còn lại: ' + formatCountdown(info.closeMs - nowMs));
                            setScheduleClass(countdown, 'countdown-text open');
                            if (countdown) countdown.style.display = '';
                            item.setAttribute('data-schedule-active', '1');
                        } else {
                            setScheduleText(countdown, '');
                            if (countdown) countdown.style.display = 'none';
                            item.removeAttribute('data-schedule-active');
                        }
                        setScheduleAction(actionBtn, defaultText, true);
                    }
                }

                // Quản lý vòng đời interval: DUY NHẤT một timer dùng chung, chỉ chạy khi còn bài cần cập nhật.
                let qnsScheduleTimer = null;

                function startScheduleTicker() {
                    if (qnsScheduleTimer !== null) return;
                    qnsScheduleTimer = setInterval(tickCourseSchedule, 1000);
                }

                function stopScheduleTicker() {
                    if (qnsScheduleTimer === null) return;
                    clearInterval(qnsScheduleTimer);
                    qnsScheduleTimer = null;
                }

                // Mỗi giây chỉ xử lý các thẻ đang có countdown/chờ chuyển trạng thái.
                // DOM danh sách bị thay bằng innerHTML (vào chi tiết bài học) -> không còn thẻ -> tự dừng.
                function tickCourseSchedule() {
                    if (document.hidden) { stopScheduleTicker(); return; }
                    const activeItems = document.querySelectorAll('.lesson-item[data-schedule-active="1"]');
                    if (activeItems.length === 0) { stopScheduleTicker(); return; }
                    const nowMs = getCurrentServerTime().getTime();
                    activeItems.forEach(function (item) { renderLessonSchedule(item, nowMs); });
                    if (!document.querySelector('.lesson-item[data-schedule-active="1"]')) stopScheduleTicker();
                }

                // Điểm vào công khai: quét toàn bộ thẻ bài học hiện có, dựng/cập nhật giao diện rồi bật/tắt timer.
                // Idempotent: gọi lại nhiều lần (khi quay lại danh sách, khi tab hiện lại) không tạo thêm interval.
                function updateCourseScheduleUI() {
                    const nowMs = getCurrentServerTime().getTime();
                    document.querySelectorAll('.lessons-list .lesson-item[data-schedule-id]').forEach(function (item) {
                        renderLessonSchedule(item, nowMs);
                    });
                    if (!document.hidden && document.querySelector('.lesson-item[data-schedule-active="1"]')) startScheduleTicker();
                    else stopScheduleTicker();
                }

                // Tab ẩn -> dừng timer; tab hiện lại -> cập nhật ngay và khởi động lại đúng một timer.
                document.addEventListener('visibilitychange', function () {
                    if (document.hidden) stopScheduleTicker();
                    else updateCourseScheduleUI();
                });

                // Chặn ở pha capture mọi cú bấm vào nút đang bị khóa theo lịch (kể cả sau khi DOM bị dựng lại).
                // Chỉ là hạn chế giao diện, KHÔNG phải bảo mật: người dùng vẫn có thể mở thẳng liên kết.
                document.addEventListener('click', function (e) {
                    const btn = e.target && e.target.closest ? e.target.closest('.btn-action') : null;
                    if (!btn) return;
                    const item = btn.closest('.lesson-item[data-schedule-id]');
                    if (!item) return;
                    renderLessonSchedule(item, getCurrentServerTime().getTime()); // Dùng trạng thái mới nhất, không dựa class cũ
                    if (btn.classList.contains('disabled')) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                }, true);

                // ==========================================================================
                // [LỖI 19] HÀM CHỐNG XSS DÙNG CHUNG
                // - qnsEscapeHtml: chỉ dùng cho văn bản HTML và giá trị thuộc tính đặt trong dấu nháy.
                // - qnsSafeUrl: kiểm tra URL (không thay thế bằng escape HTML). Chỉ nhận http/https.
                // - Không đưa dữ liệu người dùng vào chuỗi JavaScript (onclick, href="javascript:...").
                // ==========================================================================
                window.qnsEscapeHtml = function (value) {
                    return String(value === undefined || value === null ? '' : value)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                };

                // Trả về URL đã chuẩn hóa nếu là http/https, ngược lại trả về ''. URL tương đối được giải theo trang hiện tại.
                window.qnsSafeUrl = function (rawUrl) {
                    if (typeof rawUrl !== 'string') return '';
                    const trimmed = rawUrl.trim();
                    if (!trimmed || trimmed === '#') return '';
                    try {
                        const parsed = new URL(trimmed, window.location.href);
                        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
                    } catch (e) { /* URL không hợp lệ */ }
                    return '';
                };

                // Mở URL sau khi kiểm tra lại; không mở nếu không hợp lệ.
                window.qnsOpenSafeUrl = function (rawUrl) {
                    const safeUrl = window.qnsSafeUrl(rawUrl);
                    if (!safeUrl) {
                        console.warn('[XSS] Đã chặn URL không hợp lệ:', rawUrl);
                        if (typeof window.showAppAlert === 'function') {
                            window.showAppAlert({ type: 'warning', title: 'Liên kết không hợp lệ', message: 'Liên kết này không hợp lệ hoặc không được phép mở.' });
                        }
                        return false;
                    }
                    window.open(safeUrl, '_blank', 'noopener,noreferrer');
                    return true;
                };

                // Làm sạch HTML bổ sung của hộp thoại: chỉ giữ thẻ và thuộc tính trong danh sách cho phép.
                window.qnsSanitizeDialogHtml = function (html) {
                    const template = document.createElement('template');
                    template.innerHTML = String(html || '');
                    const ALLOWED_TAGS = ['DIV', 'SPAN', 'P', 'BR', 'STRONG', 'B', 'EM', 'SMALL', 'I', 'UL', 'OL', 'LI', 'INPUT', 'LABEL'];
                    const ALLOWED_ATTRS = ['class', 'style', 'id', 'type', 'placeholder', 'value', 'title'];
                    Array.from(template.content.querySelectorAll('*')).forEach(function (el) {
                        if (ALLOWED_TAGS.indexOf(el.tagName) === -1) { el.remove(); return; }
                        Array.from(el.attributes).forEach(function (attr) {
                            if (ALLOWED_ATTRS.indexOf(attr.name.toLowerCase()) === -1) el.removeAttribute(attr.name);
                        });
                        const styleValue = el.getAttribute('style');
                        if (styleValue && /url\s*\(|expression\s*\(|@import/i.test(styleValue)) el.removeAttribute('style');
                        if (el.tagName === 'INPUT') el.setAttribute('type', 'text');
                    });
                    return template.innerHTML;
                };

                // Bản sao bài học với các trường văn bản đã escape; giữ id gốc ở _rawId và link gốc (link phải đi qua qnsSafeUrl khi dùng).
                window.qnsEscapeLessonFields = function (lesson) {
                    const source = (lesson && typeof lesson === 'object') ? lesson : {};
                    return Object.assign({}, source, {
                        _rawId: String(source.id === undefined || source.id === null ? '' : source.id),
                        id: window.qnsEscapeHtml(source.id),
                        title: window.qnsEscapeHtml(source.title),
                        desc: window.qnsEscapeHtml(source.desc),
                        type: window.qnsEscapeHtml(source.type),
                        sectionId: window.qnsEscapeHtml(source.sectionId),
                        status: window.qnsEscapeHtml(source.status)
                    });
                };

                // Quy tắc khóa hoàn thành DUY NHẤT cho danh sách và trang chi tiết: <lessonId>_completed
                window.qnsCompletionKey = function (source) {
                    if (typeof source === 'string') {
                        const id = source.trim();
                        return id ? id + '_completed' : null;
                    }
                    const card = source && source.closest ? source.closest('.lesson-item[data-schedule-id]') : null;
                    const cardId = card ? (card.getAttribute('data-schedule-id') || '').trim() : '';
                    if (cardId) return cardId + '_completed';
                    return source && source.getAttribute ? source.getAttribute('data-key') : null;
                };

                document.addEventListener("DOMContentLoaded", function () {
                    // ==========================================================================
                // QNS_STORE: Quản lý trạng thái khóa học từ Backend
                // ==========================================================================
                window.QNS_STORE = {
                    sections: [],
                    subsections: [],
                    lessons: [],
                    serverTime: null,
                    isLoaded: false,
                    progress: [],
                    progressLoaded: false
                };

                window.loadCourseData = async function() {
                    // Trả về { ok:true } hoặc { ok:false, code, message }. Chỉ ghi vào QNS_STORE khi TẤT CẢ request thành công.
                    try {
                        const res = await API.request('course.bootstrap', {});
                        let progress = window.QNS_STORE.progress || [];
                        let progressLoaded = window.QNS_STORE.progressLoaded === true;

                        if (res) {
                            const token = QNS_AUTH.getToken();
                            if (token) {
                                const progRes = await API.request('progress.get', { token: token });
                                progress = progRes ? (progRes.completedLessons || []) : progress;
                                progressLoaded = !!progRes;
                            }
                            window.QNS_STORE.sections = res.sections || [];
                            window.QNS_STORE.subsections = res.subsections || [];
                            window.QNS_STORE.lessons = res.lessons || [];
                            window.QNS_STORE.isLoaded = true;
                            window.QNS_STORE.progress = progress;
                            window.QNS_STORE.progressLoaded = progressLoaded;
                            if (res.serverTime && typeof setServerTimeReference === 'function') {
                                setServerTimeReference(res.serverTime);
                            }
                        }
                        return { ok: true };
                    } catch (e) {
                        if (e && e.code === 'UNAUTHENTICATED') {
                            QNS_AUTH.handleUnauthenticated(e.message); // xử lý tập trung, không render tiếp
                            return { ok: false, code: 'UNAUTHENTICATED', message: e.message };
                        }
                        console.error("Lỗi tải dữ liệu khóa học:", e);
                        if (e && (e.code === 'FORBIDDEN' || e.code === 'COURSE_CONFIG_INVALID')) {
                            QNS_AUTH.showDenied(e.code === 'FORBIDDEN' ? 'Bạn chưa được cấp quyền vào khóa học này.' : e.message, e.code === 'FORBIDDEN' ? 'forbidden' : 'config');
                            return { ok: false, code: e.code, message: e.message };
                        }
                        // Lỗi mạng/máy chủ: GIỮ NGUYÊN QNS_STORE hiện có, không đặt progress = []
                        return { ok: false, code: (e && e.code) || 'UNKNOWN', message: (e && e.message) || 'Lỗi tải dữ liệu' };
                    }
                };

                window.loadCourseData_LEGACY_DISABLED = async function() {
                    try {
                        const res = await API.request('course.bootstrap', {});
                        if (res) {
                            window.QNS_STORE.sections = res.sections || [];
                            window.QNS_STORE.subsections = res.subsections || [];
                            window.QNS_STORE.lessons = res.lessons || [];
                            window.QNS_STORE.isLoaded = true;
                            
                            if (res.serverTime && typeof setServerTimeReference === 'function') {
                                setServerTimeReference(res.serverTime);
                            }
                        }

                        // [GIAI ĐOẠN 8] Nạp dữ liệu Tiến độ học tập chính thức từ Backend
                        const token = QNS_AUTH.getToken();
                        if (token) {
                            const progRes = await API.request('progress.get', { token: token });
                            window.QNS_STORE.progress = progRes ? (progRes.completedLessons || []) : [];
                        } else {
                            window.QNS_STORE.progress = [];
                        }
                    } catch(e) {
                        console.error("Lỗi tải dữ liệu khóa học:", e);
                        window.QNS_STORE.progress = [];
                    }
                };

                // ==========================================================================
                // LOGIC KIỂM TRA QUYỀN TRUY CẬP THEO URL TIÊN QUYẾT
                // ==========================================================================
                function checkAccessPermission_LEGACY_DISABLED() {
                        const referrer = document.referrer;

                        function getFileName(urlString) {
                            if (!urlString) return "";
                            try {
                                const parsed = new URL(urlString, window.location.href);
                                const pathParts = parsed.pathname.split('/');
                                return pathParts[pathParts.length - 1].toLowerCase();
                            } catch (e) {
                                return "";
                            }
                        }

                        const targetFile = getFileName(typeof URL_TIEN_QUYET !== "undefined" ? URL_TIEN_QUYET : "");
                        const referrerFile = getFileName(referrer);

                        let isAllowed = false;

                        // LƯU Ý: Referrer và cờ sessionStorage chỉ là kiểm tra luồng điều hướng, KHÔNG phải bằng chứng xác thực.
                        // Quyền truy cập thực sự phải do Backend kiểm tra ([BACKEND-TODO]).
                        const hasSessionAccess = sessionStorage.getItem("allowed_course_access") === "true";

                        if (!URL_TIEN_QUYET || URL_TIEN_QUYET === "URL_TIÊN_QUYẾT") {
                            isAllowed = true;
                        } else if (hasSessionAccess || !!QNS_AUTH.getToken() || (referrerFile && targetFile && referrerFile === targetFile)) {
                            isAllowed = true;
                        }

                        // Bước kiểm tra dữ liệu phiên đăng nhập cục bộ (chỉ hạn chế giao diện, chưa phải xác thực)
                        const loginCheck = QNS_AUTH.checkLoginForCourse();
                        let denyMessage = "";
                        if (!loginCheck.ok) {
                            isAllowed = false;
                            denyMessage = loginCheck.message;
                        }

                        // [MULTI-COURSE] Cấu hình COURSE_ID sai/thiếu: từ chối khởi tạo, hiện màn hình từ chối truy cập
                        const courseCheck = QNS_COURSE.validate();
                        if (!courseCheck.ok) {
                            isAllowed = false;
                            denyMessage = courseCheck.message;
                        }

                        if (isAllowed) {
                            // Xóa cờ sau khi mở trang để đảm bảo nếu load trực tiếp lần sau vẫn bảo mật
                            sessionStorage.removeItem("allowed_course_access");
                            document.body.classList.remove("access-checking", "access-denied");
                            document.body.classList.add("access-granted");
                            document.body.dataset.authVerified = "false";
                            console.warn("[QNS_AUTH] Phiên đăng nhập chỉ được đọc từ Storage trên trình duyệt và CHƯA được máy chủ xác minh (Backend chưa kết nối). Đây không phải xác thực an toàn.");
                        } else {
                            document.body.classList.remove("access-checking", "access-granted");
                            document.body.classList.add("access-denied");

                            const denyMsgEl = document.querySelector("#access-denied-screen .access-denied-message");
                            if (denyMsgEl && denyMessage) {
                                denyMsgEl.textContent = denyMessage;
                            }

                            const backBtn = document.getElementById("btn-access-denied-back");
                            if (backBtn) {
                                backBtn.addEventListener("click", function () {
                                    if (URL_TIEN_QUYET && URL_TIEN_QUYET !== "URL_TIÊN_QUYẾT") {
                                        window.location.href = URL_TIEN_QUYET;
                                    } else {
                                        window.location.href = "home.html";
                                    }
                                });
                            }
                        }
                    }

                    // Chạy kiểm tra quyền ngay khi DOM sẵn sàng
                    // [SSO-7] Cổng truy cập mới (QNS_AUTH.authorizeCourse) chạy bất đồng bộ trong chuỗi khởi động ở cuối file.

                    // Xử lý sự kiện click vào nút hành động (Tham gia / Lấy tài liệu / Làm bài)
                    document.querySelectorAll(".btn-action").forEach((btn) => {
                        btn.addEventListener("click", function (e) {
                            // 1. Trường hợp nút đang bị khóa theo thời gian (Chưa mở hoặc Đã đóng)
                            if (btn.classList.contains("disabled")) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                            }

                            // 2. Trường hợp nút đang mở nhưng chưa được gắn link thực tế
                            const href = btn.getAttribute("href");
                            const hasValidLink = href && href.trim() !== "" && href.trim() !== "#" && href.trim() !== "home.html";

                            if (!hasValidLink) {
                                e.preventDefault();
                                alert("Nội dung này hiện chưa được cập nhật liên kết. Vui lòng quay lại sau!");
                            }
                        });
                    });

                    // Chạy kiểm tra UI ngay khi trang load
                    updateCourseScheduleUI();

                    // Bộ timer chung duy nhất cập nhật mỗi giây (1000ms)
                    // Interval do updateCourseScheduleUI() tự khởi tạo/dừng (một timer dùng chung), không gọi setInterval trực tiếp ở đây.

                    // 1. Triển khai ScrollSpy bằng IntersectionObserver & Xử lý Click Sidebar Nav
                    const courseNavLinks = document.querySelectorAll(".course-content-nav .nav-item[data-target]");
                    const chapterSections = document.querySelectorAll("main.main-content section.chapter-card[id]");
                    let isClickScrolling = false;

                    function setActiveNav(targetId, shouldScrollSidebar = false) {
                        let activeLink = null;
                        courseNavLinks.forEach((link) => {
                            if (link.getAttribute("data-target") === targetId) {
                                link.classList.add("active");
                                activeLink = link;
                            } else {
                                link.classList.remove("active");
                            }
                        });

                        // Chỉ cuộn mục trong Sidebar nếu được yêu cầu chủ động (tránh giật/cuộn trang chính)
                        if (activeLink && shouldScrollSidebar) {
                            activeLink.scrollIntoView({
                                behavior: "smooth",
                                block: "nearest"
                            });
                        }
                    }

                    // Cấu hình vùng kích hoạt ScrollSpy (20% đến 40% từ đỉnh màn hình)
                    const observerOptions = {
                        root: null,
                        rootMargin: "-20% 0px -60% 0px",
                        threshold: 0
                    };

                    const observer = new IntersectionObserver((entries) => {
                        if (isClickScrolling) return;

                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                setActiveNav(entry.target.id);
                            }
                        });
                    }, observerOptions);

                    chapterSections.forEach((section) => {
                        observer.observe(section);
                    });

                    // Xử lý sự kiện click trên các mục Sidebar (mở chương nếu đang bị đóng trước khi scroll)
                    courseNavLinks.forEach((link) => {
                        link.addEventListener("click", function (e) {
                            e.preventDefault();
                            const targetId = this.getAttribute("data-target");
                            const targetSection = document.getElementById(targetId);

                            if (targetSection) {
                                isClickScrolling = true;

                                // Nếu chương đang đóng, tự động mở ra trước khi scroll
                                if (targetSection.classList.contains("collapsed") && typeof window.toggleChapter === "function") {
                                    window.toggleChapter(targetSection, false);
                                }

                                setActiveNav(targetId, true);

                                targetSection.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start"
                                });

                                // Đóng Sidebar trên mobile sau khi click chọn bài học
                                if (window.innerWidth <= 768) {
                                    const sidebarEl = document.querySelector('.sidebar');
                                    const toggleBtn = document.getElementById('sidebar-toggle-btn');
                                    if (sidebarEl && !sidebarEl.classList.contains('collapsed')) {
                                        sidebarEl.classList.add('collapsed');
                                        if (toggleBtn) {
                                            toggleBtn.setAttribute('aria-expanded', 'false');
                                            toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
                                        }
                                    }
                                }

                                setTimeout(() => {
                                    isClickScrolling = false;
                                }, 800);
                            }
                        });
                    });

                    // 2. Hàm Chuẩn hóa Chuỗi tiếng Việt (Loại bỏ dấu) dùng cho Tìm kiếm không phân biệt chữ hoa/thường/dấu
                    function normalizeVietnameseString(str) {
                        if (!str) return "";
                        return str
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/đ/g, "d")
                            .replace(/Đ/g, "d")
                            .trim();
                    }

                    // 3. Hàm Xử lý Tìm kiếm & Lọc bài học tập trung (Search & Filter)
                    function applyCourseFilters() {
                        const searchInput = document.getElementById("course-search-input");
                        const filterSelect = document.getElementById("course-filter-select");
                        const noResultsEl = document.getElementById("no-results-message");

                        const query = normalizeVietnameseString(searchInput ? searchInput.value : "");
                        const filterValue = filterSelect ? filterSelect.value : "all";

                        const chapterSections = document.querySelectorAll("main.main-content section.chapter-card");
                        let totalVisibleLessons = 0;

                        chapterSections.forEach((chapter) => {
                            const lessons = chapter.querySelectorAll(".lesson-item");
                            let chapterVisibleCount = 0;

                            lessons.forEach((lesson) => {
                                // Lấy tiêu đề và nội dung bài học để so sánh từ khóa
                                const titleEl = lesson.querySelector(".lesson-title");
                                const metaEl = lesson.querySelector(".lesson-meta");
                                const rawText = (titleEl ? titleEl.textContent : "") + " " + (metaEl ? metaEl.textContent : "");
                                const normalizedText = normalizeVietnameseString(rawText);

                                const matchesSearch = query === "" || normalizedText.includes(query);

                                // Lấy thông tin loại bài học và trạng thái hoàn thành
                                const type = lesson.getAttribute("data-type") || "";
                                const completeBtn = lesson.querySelector(".btn-complete");
                                const isCompleted = completeBtn && completeBtn.classList.contains("completed");

                                let matchesFilter = true;
                                if (filterValue === "incomplete") {
                                    matchesFilter = !isCompleted;
                                } else if (filterValue === "pdf") {
                                    matchesFilter = type === "pdf";
                                } else if (filterValue === "test") {
                                    matchesFilter = type === "test";
                                } else if (filterValue === "assignment") {
                                    matchesFilter = type === "assignment";
                                } else if (filterValue === "video") {
                                    matchesFilter = type === "video";
                                } else if (filterValue === "survey") {
                                    matchesFilter = type === "survey";
                                } else if (filterValue === "link") {
                                    matchesFilter = type === "link";
                                } else if (filterValue === "forum") {
                                    matchesFilter = type === "forum";
                                }

                                // Hiển thị bài học thỏa mãn đồng thời Search AND Filter
                                if (matchesSearch && matchesFilter) {
                                    lesson.style.display = "";
                                    chapterVisibleCount++;
                                    totalVisibleLessons++;
                                } else {
                                    lesson.style.display = "none";
                                }
                            });

                            // Ẩn/Hiện Subsection dựa trên số bài học bên trong
                            chapter.querySelectorAll(".subsection-group").forEach(subGroup => {
                                const visibleLessonsInSub = Array.from(subGroup.querySelectorAll(".lesson-item")).filter(l => l.style.display !== "none").length;
                                subGroup.style.display = visibleLessonsInSub > 0 ? "" : "none";
                            });

                            // Ẩn/Hiện Chương dựa trên việc có bài học thỏa mãn hay không
                            if (chapterVisibleCount > 0) {
                                chapter.style.display = "";
                                // Nếu đang có từ khóa tìm kiếm hoặc lọc loại bài học, tự động mở chương để hiển thị kết quả
                                if ((query !== "" || filterValue !== "all") && chapter.classList.contains("collapsed")) {
                                    if (typeof window.toggleChapter === "function") {
                                        window.toggleChapter(chapter, false);
                                    }
                                }
                            } else {
                                chapter.style.display = "none";
                            }
                        });

                        // Hiển thị thông báo khi không có bài học nào khớp
                        if (noResultsEl) {
                            const hasAnyLesson = document.querySelectorAll("main.main-content section.chapter-card .lesson-item").length > 0;
                            noResultsEl.style.display = (hasAnyLesson && totalVisibleLessons === 0) ? "block" : "none";
                        }
                    }

                    // Gắn sự kiện lắng nghe thao tác tìm kiếm và thay đổi bộ lọc
                    const searchInput = document.getElementById("course-search-input");
                    const filterSelect = document.getElementById("course-filter-select");

                    if (searchInput) {
                        searchInput.addEventListener("input", applyCourseFilters);
                    }

                    if (filterSelect) {
                        filterSelect.addEventListener("change", applyCourseFilters);
                    }

                    // 4. Xử lý tính toán & Cập nhật Tiến độ học tập dựa trên QNS_STORE.progress
                    function updateCourseProgress() {
                        if (QNS_AUTH.isBackendConfigured() && !window.QNS_STORE.progressLoaded) {
                            const pendingTextEl = document.getElementById("course-progress-text");
                            const pendingBarEl = document.getElementById("course-progress-bar");
                            if (pendingTextEl) pendingTextEl.textContent = 'Đang tải tiến độ học tập...';
                            if (pendingBarEl) pendingBarEl.style.width = '0%';
                            return;
                        }
                        const allLessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
                        const publishedLessons = allLessons.filter(l => l.status === 'published' || !l.status);
                        const total = publishedLessons.length > 0 ? publishedLessons.length : document.querySelectorAll(".lesson-item").length;
                        
                        const completedSet = window.QNS_STORE.progress || [];
                        const completed = publishedLessons.length > 0 
                            ? publishedLessons.filter(l => completedSet.includes(l.id)).length 
                            : document.querySelectorAll(".btn-complete.completed").length;
                        
                        const percentage = total > 0 ? Math.min(100, Math.max(0, Math.round((completed / total) * 100))) : 0;
                        
                        const progressTextEl = document.getElementById("course-progress-text");
                        const progressBarEl = document.getElementById("course-progress-bar");
                        
                        if (progressTextEl) {
                            progressTextEl.textContent = `Đã hoàn thành ${completed}/${total} bài học (${percentage}%)`;
                        }
                        
                        if (progressBarEl) {
                            progressBarEl.style.width = `${percentage}%`;
                        }
                    }

                    // 5. Xử lý trạng thái nút Hoàn thành tích hợp Backend (Giai đoạn 8)
                    function rebindCompletionButtons() {
                        const completeButtons = document.querySelectorAll(".btn-complete");
                        completeButtons.forEach(function (btn) {
                            const lessonItem = btn.closest('.lesson-item');
                            const lessonId = lessonItem ? lessonItem.getAttribute('data-schedule-id') : null;
                            if (!lessonId) return;

                            const textSpan = btn.querySelector(".btn-complete-text");

                            const isCompleted = window.QNS_STORE.progress && window.QNS_STORE.progress.includes(lessonId);
                            if (isCompleted) {
                                btn.classList.add("completed");
                                textSpan.textContent = "✓ Hoàn thành";
                            } else {
                                btn.classList.remove("completed");
                                textSpan.textContent = "Hoàn thành";
                            }

                            btn.onclick = async function (e) {
                                e.preventDefault();
                                e.stopPropagation();

                                const isCurrentlyCompleted = btn.classList.contains("completed");
                                const newState = !isCurrentlyCompleted;

                                // Optimistic UI Update
                                if (newState) {
                                    btn.classList.add("completed");
                                    textSpan.textContent = "✓ Hoàn thành";
                                    if (!window.QNS_STORE.progress.includes(lessonId)) window.QNS_STORE.progress.push(lessonId);
                                } else {
                                    btn.classList.remove("completed");
                                    textSpan.textContent = "Hoàn thành";
                                    window.QNS_STORE.progress = window.QNS_STORE.progress.filter(id => id !== lessonId);
                                }
                                
                                if (typeof updateCourseProgress === 'function') updateCourseProgress();
                                if (typeof applyCourseFilters === 'function') applyCourseFilters();

                                try {
                                    const token = QNS_AUTH.getToken();
                                    if (!token) throw new Error("Yêu cầu đăng nhập");
                                    const res = await API.request(newState ? 'progress.complete' : 'progress.uncomplete', {
                                        token: token,
                                        lessonId: lessonId
                                    });
                                    if (!res) throw new Error("Máy chủ không phản hồi");
                                } catch(err) {
                                    console.error("Lỗi đồng bộ tiến độ:", err);
                        if (err && err.code === 'UNAUTHENTICATED') return;
                                    window.showAppAlert({type: 'error', title: 'Lỗi', message: 'Không thể đồng bộ tiến độ với máy chủ: ' + err.message});
                                    
                                    // Rollback UI nếu thất bại
                                    if (!newState) {
                                        btn.classList.add("completed");
                                        textSpan.textContent = "✓ Hoàn thành";
                                        if (!window.QNS_STORE.progress.includes(lessonId)) window.QNS_STORE.progress.push(lessonId);
                                    } else {
                                        btn.classList.remove("completed");
                                        textSpan.textContent = "Hoàn thành";
                                        window.QNS_STORE.progress = window.QNS_STORE.progress.filter(id => id !== lessonId);
                                    }
                                    if (typeof updateCourseProgress === 'function') updateCourseProgress();
                                    if (typeof applyCourseFilters === 'function') applyCourseFilters();
                                }
                            };
                        });
                        if (typeof applyCourseFilters === 'function') applyCourseFilters();
                        if (typeof updateCourseProgress === 'function') updateCourseProgress();
                    }
                    rebindCompletionButtons();

                    // 6. Xử lý Accordion / Thu gọn - Mở rộng Chương
                    window.toggleChapter = function(chapterCard, forceState) {
                        if (!chapterCard) return;

                        const toggleBtn = chapterCard.querySelector(".chapter-toggle");
                        const chapterId = chapterCard.getAttribute("id");
                        const storageKey = `course_${chapterId}_collapsed`;

                        let isCollapsed;
                        if (typeof forceState === "boolean") {
                            isCollapsed = forceState;
                        } else {
                            isCollapsed = !chapterCard.classList.contains("collapsed");
                        }

                        if (isCollapsed) {
                            chapterCard.classList.add("collapsed");
                            if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
                            if (chapterId) localStorage.setItem(QNS_COURSE.storageKey(storageKey), "true");
                        } else {
                            chapterCard.classList.remove("collapsed");
                            if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
                            if (chapterId) localStorage.setItem(QNS_COURSE.storageKey(storageKey), "false");
                        }
                    };

                    // Gắn sự kiện Click cho Header của từng Chương
                    const chapterHeaders = document.querySelectorAll(".chapter-card .chapter-header");
                    chapterHeaders.forEach((header) => {
                        header.addEventListener("click", function(e) {
                            // Ngăn sự kiện nếu bấm vào các nút bấm hoặc liên kết khác trong header
                            if (e.target.closest("a, button:not(.chapter-toggle)")) return;

                            const chapterCard = this.closest(".chapter-card");
                            if (chapterCard) {
                                window.toggleChapter(chapterCard);
                            }
                        });
                    });

                    // Khôi phục trạng thái Đóng/Mở từng Chương từ LocalStorage
                    document.querySelectorAll(".chapter-card[id]").forEach((chapterCard) => {
                        const chapterId = chapterCard.getAttribute("id");
                        const storageKey = `course_${chapterId}_collapsed`;
                        const savedState = localStorage.getItem(QNS_COURSE.storageKey(storageKey));

                        if (savedState === "true") {
                            window.toggleChapter(chapterCard, true);
                        }
                    });
                    // Xử lý Nút Đóng/Mở Sidebar trên Mobile
                    const sidebarEl = document.querySelector('.sidebar');
                    const toggleBtn = document.getElementById('sidebar-toggle-btn');

                    if (toggleBtn && sidebarEl) {
                        toggleBtn.addEventListener('click', function () {
                            const isCollapsed = sidebarEl.classList.toggle('collapsed');
                            this.setAttribute('aria-expanded', !isCollapsed);

                            if (isCollapsed) {
                                this.innerHTML = '<i class="fa-solid fa-bars"></i>';
                            } else {
                                this.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
                            }
                        });
                    }
                    // ==========================================================
                    // HỆ THỐNG PHÂN QUYỀN VÀ QUẢN LÝ NỘI DUNG DÀNH CHO GIÁO VIÊN
                    // ==========================================================
                    (function initTeacherManagement() {
                        // 1. Tài khoản và quyền giáo viên chỉ lấy từ QNS_AUTH (nguồn duy nhất: QNS_AUTH.getCurrentUser()), không tự đọc Storage.
                        // Kiểm tra nghiêm ngặt điều kiện: User === "Admin" && ID === "Administrator"
                        // Quyền giáo viên chỉ ở mức giao diện (có thể bị giả mạo khi chưa có Backend) - xem QNS_AUTH
                        // [SSO-7] Quyền giáo viên chỉ biết SAU khi backend xác minh (authorizeCourse). Hiển thị giao diện giáo viên do applyRoleUI() quyết định.
                        window.applyRoleUI = function () {
                            const allowed = QNS_AUTH.checkTeacherPermission().allowed;
                            const teacherSidebar = document.getElementById('teacher-sidebar-management');
                            if (teacherSidebar) teacherSidebar.style.display = allowed ? 'block' : 'none';
                        };
                        window.applyRoleUI();   // chưa có role -> ẩn

                        // 2. Mô hình dữ liệu bài học lưu trữ cục bộ (LocalStorage) tích hợp sẵn
                        window.getStoredLessons = function() {
                            if (QNS_AUTH.isBackendConfigured()) return ((window.QNS_STORE && window.QNS_STORE.lessons) || []).slice(); // [T09A] không rơi về bài mẫu/LocalStorage
                            const defaultLessons = [
                                { id: 'sample_1', sectionId: 'section-1', title: '1. Buổi học trực tuyến', type: 'lesson', status: 'published', desc: 'Kiểm tra giao diện phòng học ảo', link: 'lesson-sample.html', open: null, close: null, resources: [{ type: 'pdf', name: 'Tài liệu PDF', url: 'tailieu.pdf' }, { type: 'word', name: 'Hướng dẫn', url: 'huongdan.docx' }] },
                                { id: 'sample_2', sectionId: 'section-1', title: '2. Tài liệu học tập (.pdf)', type: 'pdf', status: 'published', desc: 'Kiểm tra trình xem tài liệu', link: 'pdf-sample.html', open: null, close: null, resources: [{ type: 'excel', name: 'Bảng thống kê', url: 'thongke.xlsx' }, { type: 'powerpoint', name: 'Slide bài giảng', url: 'slides.pptx' }] },
                                { id: 'sample_3', sectionId: 'section-1', title: '3. Bài kiểm tra đánh giá', type: 'test', status: 'published', desc: 'Kiểm tra giao diện thi trắc nghiệm', link: 'test-sample.html', open: null, close: null, resources: [{ type: 'form', name: 'Link Google Form', url: 'https://forms.gle/sample' }, { type: 'archive', name: 'Mã nguồn', url: 'code.zip' }] },
                                { id: 'sample_4', sectionId: 'section-1', title: '4. Bài tập tự luận', type: 'assignment', status: 'published', desc: 'Kiểm tra chức năng đính kèm tệp', link: 'assignment-sample.html', open: null, close: null, resources: [{ type: 'image', name: 'Minh họa', url: 'minhhoa.png' }, { type: 'video', name: 'Video demo', url: 'demo.mp4' }] },
                                { id: 'sample_5', sectionId: 'section-1', title: '5. Video bài giảng', type: 'video', status: 'published', desc: 'Kiểm tra trình phát video', link: 'video-sample.html', open: null, close: null, resources: [{ type: 'audio', name: 'Audio', url: 'audio.mp3' }, { type: 'link', name: 'Trang web', url: 'https://example.com' }] },
                                { id: 'sample_6', sectionId: 'section-1', title: '6. Khảo sát chất lượng', type: 'survey', status: 'published', desc: 'Kiểm tra form biểu mẫu', link: 'survey-sample.html', open: null, close: null, resources: [{ type: 'document', name: 'Tài liệu chung', url: 'chung.txt' }] },
                                { id: 'sample_7', sectionId: 'section-1', title: '7. Công cụ hỗ trợ học tập', type: 'link', status: 'published', desc: 'Kiểm tra điều hướng website ngoài', link: 'link-sample.html', open: null, close: null, resources: [] },
                                { id: 'sample_8', sectionId: 'section-1', title: '8. Góc hỏi đáp chuyên môn', type: 'forum', status: 'published', desc: 'Kiểm tra hiển thị luồng bình luận', link: 'forum-sample.html', open: null, close: null, resources: [] }
                            ];
                            const stored = localStorage.getItem(QNS_COURSE.storageKey('qns_custom_lessons'));
                            if (!stored) return defaultLessons;
                            
                            let parsed;
                            try {
                                parsed = JSON.parse(stored);
                            } catch (parseError) {
                                // Dữ liệu LocalStorage bị hỏng/cắt cụt: dùng bài mẫu mặc định, KHÔNG xóa dữ liệu đã lưu
                                console.warn('[STORAGE] qns_custom_lessons không phải JSON hợp lệ, dùng danh sách mặc định.', parseError);
                                return defaultLessons;
                            }
                            if (!Array.isArray(parsed)) return defaultLessons;
                            // Bỏ các phần tử không phải đối tượng (null, số, chuỗi...) để các bước sau không bị lỗi
                            parsed = parsed.filter(l => l && typeof l === 'object' && !Array.isArray(l));
                            
                            // Hợp nhất: Thêm những bài default chưa có trong danh sách đã lưu (đảm bảo đủ 8 bài mẫu)
                            const parsedIds = parsed.map(l => l.id);
                            const missingDefaults = defaultLessons.filter(d => !parsedIds.includes(d.id));
                            return [...parsed, ...missingDefaults];
                        };

                        window.saveStoredLessons = function(lessons) {
                            // [BACKEND-TODO] Thay LocalStorage bằng API lưu bài học (máy chủ phải kiểm tra quyền giáo viên)
                            if (QNS_AUTH.isBackendConfigured()) { console.warn('[T09C] saveStoredLessons bị chặn: dữ liệu bài học do máy chủ quản lý.'); return false; }
                            localStorage.setItem(QNS_COURSE.storageKey('qns_custom_lessons'), JSON.stringify(lessons));
                        };

                        window.getStoredSections = function() {
                            if (QNS_AUTH.isBackendConfigured()) return ((window.QNS_STORE && window.QNS_STORE.sections) || []).slice(); // [T09A]
                            const defaultSections = [{ id: 'section-1', name: 'Dữ liệu mẫu', order: 1 }];
                            const stored = localStorage.getItem(QNS_COURSE.storageKey('qns_custom_sections'));
                            return stored ? JSON.parse(stored) : defaultSections;
                        };
                        
                        window.saveStoredSections = function(sections) {
                            if (QNS_AUTH.isBackendConfigured()) { console.warn('[T09C] saveStoredSections bị chặn: dữ liệu do máy chủ quản lý.'); return false; }
                            localStorage.setItem(QNS_COURSE.storageKey('qns_custom_sections'), JSON.stringify(sections));
                        };

                        window.getStoredSubsections = function() {
                            if (QNS_AUTH.isBackendConfigured()) return ((window.QNS_STORE && window.QNS_STORE.subsections) || []).slice(); // [T09A]
                            const defaultSubsections = [{ id: 'subsec-1', sectionId: 'section-1', name: 'Nhóm bài học mặc định', order: 1 }];
                            const stored = localStorage.getItem(QNS_COURSE.storageKey('qns_custom_subsections'));
                            return stored ? JSON.parse(stored) : defaultSubsections;
                        };

                        window.saveStoredSubsections = function(subsections) {
                            if (QNS_AUTH.isBackendConfigured()) { console.warn('[T09C] saveStoredSubsections bị chặn: dữ liệu do máy chủ quản lý.'); return false; }
                            localStorage.setItem(QNS_COURSE.storageKey('qns_custom_subsections'), JSON.stringify(subsections));
                        };

                        const getStoredLessons = window.getStoredLessons;
                        const saveStoredLessons = window.saveStoredLessons;
                        const getStoredSections = window.getStoredSections;
                        const saveStoredSections = window.saveStoredSections;
                        const getStoredSubsections = window.getStoredSubsections;
                        const saveStoredSubsections = window.saveStoredSubsections;

                        // Hàm render danh sách bài học động (Hỗ trợ cấu trúc Section -> Subsection -> Bài học)
                        window.renderStudentLessons = function() {
                            const isTeacher = QNS_AUTH.checkTeacherPermission().allowed;
                            const allLessons = window.getStoredLessons();
                            const allSections = window.getStoredSections().sort((a, b) => a.order - b.order);
                            const allSubsections = window.getStoredSubsections().sort((a, b) => a.order - b.order);
                            
                            // Lọc bài học: Học sinh chỉ thấy bài published, Giáo viên thấy cả bài draft
                            const visibleLessons = allLessons.filter(l => isTeacher || l.status === 'published');
                            
                            // Xóa các section cứng hoặc cũ
                            document.querySelectorAll('main.main-content section.chapter-card').forEach(el => el.remove());
                            
                            let htmlBuilder = '';
                            
                            allSections.forEach(sec => {
                                const subForSec = allSubsections.filter(sub => sub.sectionId === sec.id);
                                
                                let sectionHtml = `
                                <section id="${sec.id}" class="chapter-card">
                                    <div class="chapter-header">
                                        <h2 class="chapter-title">${window.qnsEscapeHtml(sec.name)}</h2>
                                        <button class="chapter-toggle" aria-expanded="true" aria-label="Thu gọn/Mở rộng chuyên đề">
                                            <i class="fa-solid fa-chevron-down toggle-icon"></i>
                                        </button>
                                    </div>
                                    <hr class="chapter-divider">
                                    <div class="chapter-content">
                                `;
                                
                                subForSec.forEach(sub => {
                                    // Tương thích dữ liệu cũ: Nếu bài học có sectionId cũ, cho nó vào subsec-1 mặc định
                                    const lessonsInSub = visibleLessons.filter(l => l.subsectionId === sub.id || (!l.subsectionId && l.sectionId === sec.id && sub.id === 'subsec-1'));
                                    
                                    if (lessonsInSub.length > 0 || isTeacher) { // Hiện subsection nếu có bài học hoặc là giáo viên
                                        sectionHtml += `
                                        <div class="subsection-group" style="margin-bottom: 24px;">
                                            <h3 style="font-size: 1rem; color: var(--text-color); margin-bottom: 12px; padding-left: 8px; border-left: 3px solid var(--primary-color);">${window.qnsEscapeHtml(sub.name)}</h3>
                                            <div class="lessons-list">
                                        `;
                                        
                                        lessonsInSub.forEach(rawLesson => {
                                            const l = window.qnsEscapeLessonFields(rawLesson);
                                            const typeConfig = window.getLessonTypeConfig(l.type);
                                            const storageKey = window.qnsCompletionKey(l._rawId);
                                            // [GIAI ĐOẠN 8] Đọc trực tiếp từ kho tiến độ đã tải từ Backend
                                            const isCompleted = window.QNS_STORE.progress && window.QNS_STORE.progress.includes(l.id);
                                            
                                            sectionHtml += `
                                                <div class="lesson-item" data-type="${typeConfig.id}" data-schedule-id="${l.id}">
                                                    <div class="lesson-icon-wrapper ${typeConfig.cssClass}"><i class="fa-solid ${typeConfig.icon}"></i></div>
                                                    <div class="lesson-details">
                                                        <div class="lesson-title-container">
                                                            <h3 class="lesson-title">${l.title}</h3>
                                                            ${isTeacher && l.status === 'draft' ? '<span class="lesson-status-badge draft">Bản nháp</span>' : ''}
                                                        </div>
                                                        <div class="lesson-meta"><i class="fa-solid fa-circle-info"></i><span>${l.desc || 'Nội dung bài học'}</span></div>
                                                    </div>
                                                    <div class="lesson-actions">
                                                        <a href="${window.qnsEscapeHtml(window.qnsSafeUrl(l.link) || '#')}" class="btn btn-primary btn-action">Vào học</a>
                                                        <button class="btn btn-status btn-complete ${isCompleted ? 'completed' : ''}" data-key="${window.qnsEscapeHtml(storageKey)}">
                                                            <span class="btn-complete-text">${isCompleted ? '✓ Hoàn thành' : 'Hoàn thành'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            `;
                                        });
                                        
                                        sectionHtml += `</div></div>`;
                                    }
                                });
                                
                                sectionHtml += `</div></section>`;
                                htmlBuilder += sectionHtml;
                            });
                            
                            // Chèn vào giao diện sau khối no-results-message
                            const noResEl = document.getElementById('no-results-message');
                            if (noResEl) {
                                let container = document.getElementById('qns-dynamic-sections');
                                if (!container) {
                                    container = document.createElement('div');
                                    container.id = 'qns-dynamic-sections';
                                    noResEl.parentNode.insertBefore(container, noResEl.nextSibling);
                                }
                                const hasContent = allSections.length > 0 && (isTeacher || visibleLessons.length > 0);
    container.innerHTML = hasContent
                                    ? htmlBuilder
                                    : '<div id="qns-course-status" role="status" style="padding: 32px 16px; text-align: center; color: var(--text-color);"><p>Khóa học hiện chưa có bài học nào.</p></div>';
                            }
                            
                            // Cập nhật lại thanh tiến độ, bộ lọc, và sự kiện click
                            if (typeof window.rebindCourseHomeEvents === 'function') window.rebindCourseHomeEvents();
                            else {
                                if (typeof updateCourseProgress === 'function') updateCourseProgress();
                                if (typeof applyCourseFilters === 'function') applyCourseFilters();
                                bindAllLessonEvents();
                            }
                        };

                        // 3. Xử lý khi giáo viên click nút [+ Thêm bài học] hoặc [Quản lý nội dung]
                        const addLessonBtn = document.getElementById('btn-sidebar-add-lesson');
                        const contentMgmtBtn = document.getElementById('nav-teacher-content-mgmt');

                        if (addLessonBtn) {
                            addLessonBtn.addEventListener('click', function(e) {
                                e.preventDefault();
                                renderLessonFormModal();
                            });
                        }

                        if (contentMgmtBtn) {
                            contentMgmtBtn.addEventListener('click', function(e) {
                                e.preventDefault();
                                renderContentManagementView();
                            });
                        }

                        // Giao diện Biểu mẫu Tạo / Sửa bài học (Hiển thị ngay trong vùng nội dung chính)
                        function renderLessonFormModal(editLessonId = null) {
                            if (!QNS_AUTH.requireTeacher('renderLessonFormModal')) return;
                            const lessons = getStoredLessons();
                            let editingData = editLessonId ? lessons.find(l => l.id === editLessonId) : null;
                            // [LỖI 19] Dữ liệu bài học từ LocalStorage/Backend không đáng tin cậy: sao chép và ép kiểu trước khi đưa vào biểu mẫu
                            if (editingData) {
                                editingData = JSON.parse(JSON.stringify(editingData));
                                const toNumberOr = function (value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; };
                                const toDateTimeOrEmpty = function (value) {
                                    return (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) ? value : '';
                                };
                                editingData.open = toDateTimeOrEmpty(editingData.open);
                                editingData.close = toDateTimeOrEmpty(editingData.close);
                                const gs = editingData.gradingSettings;
                                if (gs && typeof gs === 'object') {
                                    if (gs.maxScore !== undefined) gs.maxScore = toNumberOr(gs.maxScore, 10);
                                    if (gs.passingScore !== undefined) gs.passingScore = toNumberOr(gs.passingScore, 5);
                                }
                                const sched = editingData.settings && editingData.settings.schedule;
                                if (sched && typeof sched === 'object') {
                                    sched.startAt = toDateTimeOrEmpty(sched.startAt);
                                    sched.endAt = toDateTimeOrEmpty(sched.endAt);
                                    sched.dueAt = toDateTimeOrEmpty(sched.dueAt);
                                }
                                const subCfg = editingData.settings && editingData.settings.submission;
                                if (subCfg && typeof subCfg === 'object') {
                                    if (subCfg.maxFiles !== undefined) subCfg.maxFiles = toNumberOr(subCfg.maxFiles, 5);
                                    if (subCfg.maxSizeMB !== undefined) subCfg.maxSizeMB = toNumberOr(subCfg.maxSizeMB, 20);
                                }
                            }

                            const dynamicMainView = document.getElementById('dynamic-main-view');
                            if (!dynamicMainView) return;

                            // Lưu lại HTML nền học sinh để có thể bấm Hủy quay lại (chỉ lấy giao diện danh sách khóa học)
                            if (!window.originalStudentMainHtml || document.querySelector('.course-header-card')) {
                                window.originalStudentMainHtml = dynamicMainView.innerHTML;
                            }

                            dynamicMainView.innerHTML = `
                                <div>
                                    <button class="btn-back-course" id="btn-cancel-lesson-form">
                                        <i class="fa-solid fa-arrow-left"></i>
                                        <span>Quay lại trang chủ khóa học</span>
                                    </button>
                                </div>
                                <div class="content-detail-card" style="margin-top: 16px;">
                                    <h2 class="detail-header-title" style="margin-bottom: 20px;">
                                        <i class="fa-solid fa-pen-to-square" style="color: var(--primary-color);"></i>
                                        <span>${editingData ? 'Chỉnh sửa bài học' : 'Tạo bài học mới'}</span>
                                    </h2>
                                    <form id="teacher-lesson-form" style="display: flex; flex-direction: column; gap: 20px;">
                                        
                                        <!-- 1. Thông tin cơ bản -->
                                        <div style="background: #f8f9fa; padding: 20px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; color: var(--primary-color);">1. Thông tin cơ bản</h3>
                                            <div class="qns-form-grid-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 14px;">
                                                <div class="form-group">
                                                    <label class="form-label">Thuộc Section (*)</label>
                                                    <select id="form-section-id" class="form-select" required></select>
                                                </div>
                                                <div class="form-group">
                                                    <label class="form-label">Thuộc Subsection (*)</label>
                                                    <select id="form-subsection-id" class="form-select" required></select>
                                                </div>
                                                <div class="form-group">
                                                    <label class="form-label">Loại bài học (*)</label>
                                                    <select id="form-lesson-type" class="form-select" required>
                                                        <option value="lesson" ${editingData?.type === 'lesson' ? 'selected' : ''}>Buổi học</option>
                                                        <option value="pdf" ${editingData?.type === 'pdf' ? 'selected' : ''}>Tài liệu PDF</option>
                                                        <option value="test" ${editingData?.type === 'test' ? 'selected' : ''}>Bài kiểm tra</option>
                                                        <option value="assignment" ${editingData?.type === 'assignment' ? 'selected' : ''}>Bài tập nộp file</option>
                                                        <option value="video" ${editingData?.type === 'video' ? 'selected' : ''}>Video bài giảng</option>
                                                        <option value="survey" ${editingData?.type === 'survey' ? 'selected' : ''}>Khảo sát</option>
                                                        <option value="link" ${editingData?.type === 'link' ? 'selected' : ''}>Liên kết ngoài</option>
                                                        <option value="forum" ${editingData?.type === 'forum' ? 'selected' : ''}>Diễn đàn thảo luận</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="form-group" style="margin-bottom: 14px;">
                                                <label class="form-label">Tiêu đề bài học (*)</label>
                                                <input type="text" id="form-lesson-title" class="form-input" placeholder="Ví dụ: Buổi 1: Hàm số bậc ba..." value="${window.qnsEscapeHtml(editingData?.title)}" required>
                                            </div>
                                            <div class="form-group">
                                                <label class="form-label">Mô tả ngắn trên trang chủ</label>
                                                <textarea id="form-lesson-short-desc" class="form-textarea" placeholder="Tóm tắt ngắn gọn hiển thị ở danh sách...">${window.qnsEscapeHtml(editingData?.desc)}</textarea>
                                            </div>
                                        </div>

                                        <!-- 2. Thời gian mở và đóng -->
                                        <div style="background: #f8f9fa; padding: 20px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; color: var(--primary-color);">2. Thời gian mở và đóng</h3>
                                            <div class="qns-form-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                                <div class="form-group">
                                                    <label class="form-label">Hạn mở bài học</label>
                                                    <input type="datetime-local" id="form-open-at" class="form-input" value="${window.qnsEscapeHtml(editingData?.open || '')}">
                                                </div>
                                                <div class="form-group">
                                                    <label class="form-label">Hạn đóng bài học</label>
                                                    <input type="datetime-local" id="form-close-at" class="form-input" value="${window.qnsEscapeHtml(editingData?.close || '')}">
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 3. Mô tả chi tiết bên trong bài học và Tệp đính kèm / Tài nguyên -->
                                        <div style="background: #f8f9fa; padding: 20px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; color: var(--primary-color);">3. Mô tả chi tiết bên trong bài học</h3>
                                            <div class="form-group">
                                                <label class="form-label">Nội dung chi tiết (Hiển thị khi học sinh bấm Vào học)</label>
                                                <textarea id="form-detailed-desc" class="form-textarea" style="min-height: 140px;" placeholder="Nhập nội dung chi tiết bài học, hướng dẫn học tập...">${window.qnsEscapeHtml(editingData?.detailedDesc)}</textarea>
                                            </div>
                                            
                                            <div class="form-group" style="margin-top: 16px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                                    <label class="form-label" style="margin-bottom: 0;">Tệp đính kèm / Tài nguyên (Nhiều tài liệu)</label>
                                                    <button type="button" class="btn" id="btn-add-resource-row" style="background-color: #16a34a; color: #fff; font-size: 0.8rem; padding: 6px 12px;">
                                                        <i class="fa-solid fa-plus" style="margin-right: 4px;"></i> Thêm tài nguyên
                                                    </button>
                                                </div>
                                                <div id="resources-container" style="display: flex; flex-direction: column; gap: 10px;">
                                                    <!-- Các dòng tài nguyên sẽ được render động tại đây -->
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 4. CÀI ĐẶT -->
                                        <div style="background: #f8f9fa; padding: 20px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; color: var(--primary-color);">4. Cài đặt</h3>
                                            
                                            <!-- 1. Cài đặt chấm điểm -->
                                            <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px dashed var(--border-color);">
                                                <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 8px; color: var(--text-color);">1. Cài đặt chấm điểm</h4>
                                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; margin-bottom: 12px;">
                                                    <input type="checkbox" id="form-is-test" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.gradingSettings?.isGraded ? 'checked' : ''}>
                                                    <span>Đặt làm bài kiểm tra</span>
                                                </label>
                                                
                                                <!-- Các trường cài đặt xuất hiện khi bật chế độ kiểm tra -->
                                                <div id="grading-dependent-fields" style="display: ${editingData?.gradingSettings?.isGraded ? 'flex' : 'none'}; padding-left: 20px; border-left: 2px solid var(--primary-light); margin-top: 10px; flex-direction: column; gap: 14px;">
                                                    
                                                    <!-- a & b. Điểm tối đa và Điểm đạt yêu cầu (Bố cục hai cột đối với các trường ngắn) -->
                                                    <div class="qns-form-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                                        <div class="form-group">
                                                            <label class="form-label">Điểm tối đa (*)</label>
                                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                                <input type="number" id="form-max-score" class="form-input" min="0.1" step="any" placeholder="Ví dụ: 10" value="${window.qnsEscapeHtml(editingData?.gradingSettings?.maxScore !== undefined ? editingData.gradingSettings.maxScore : 10)}">
                                                                <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-muted); white-space: nowrap;">điểm</span>
                                                            </div>
                                                        </div>
                                                        <div class="form-group">
                                                            <label class="form-label">Điểm đạt yêu cầu (*)</label>
                                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                                <input type="number" id="form-passing-score" class="form-input" min="0" step="any" placeholder="Ví dụ: 5" value="${window.qnsEscapeHtml(editingData?.gradingSettings?.passingScore !== undefined ? editingData.gradingSettings.passingScore : 5)}">
                                                                <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-muted); white-space: nowrap;">điểm</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <!-- c & d. Hình thức chấm điểm và Công bố điểm -->
                                                    <div class="qns-form-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                                        <div class="form-group">
                                                            <label class="form-label">Hình thức chấm điểm</label>
                                                            <select id="form-grading-method" class="form-select">
                                                                <option value="auto" ${editingData?.gradingSettings?.gradingMethod === 'auto' ? 'selected' : ''}>Tự động chấm</option>
                                                                <option value="teacher" ${!editingData?.gradingSettings?.gradingMethod || editingData?.gradingSettings?.gradingMethod === 'teacher' ? 'selected' : ''}>Giáo viên chấm</option>
                                                                <option value="mixed" ${editingData?.gradingSettings?.gradingMethod === 'mixed' ? 'selected' : ''}>Kết hợp tự động và giáo viên chấm</option>
                                                            </select>
                                                        </div>
                                                        <div class="form-group">
                                                            <label class="form-label">Công bố điểm</label>
                                                            <select id="form-score-release" class="form-select">
                                                                <option value="immediate" ${editingData?.gradingSettings?.scoreRelease === 'immediate' ? 'selected' : ''}>Ngay sau khi học sinh nộp bài</option>
                                                                <option value="after_grading" ${!editingData?.gradingSettings?.scoreRelease || editingData?.gradingSettings?.scoreRelease === 'after_grading' ? 'selected' : ''}>Sau khi giáo viên chấm</option>
                                                                <option value="manual" ${editingData?.gradingSettings?.scoreRelease === 'manual' ? 'selected' : ''}>Khi giáo viên chủ động công bố</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <!-- e & f. Quyền xem nhận xét và xem đáp án -->
                                                    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 4px;">
                                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 500;">
                                                            <input type="checkbox" id="form-show-comments" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.gradingSettings?.showTeacherComments !== false ? 'checked' : ''}>
                                                            <span>Cho phép học sinh xem nhận xét của giáo viên</span>
                                                        </label>
                                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 500;">
                                                            <input type="checkbox" id="form-show-answers" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.gradingSettings?.showAnswers === true ? 'checked' : ''}>
                                                            <span>Cho phép học sinh xem đáp án sau khi công bố điểm</span>
                                                        </label>
                                                    </div>

                                                </div>
                                            </div>

                                            <!-- 2. Cài đặt thời gian và hạn nộp -->
                                            <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px dashed var(--border-color);">
                                                <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 12px; color: var(--text-color);">2. Cài đặt thời gian và hạn nộp</h4>
                                                
                                                <!-- I. Thời gian mở và đóng bài học -->
                                                <div style="margin-bottom: 16px;">
                                                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary-color); margin-bottom: 8px;">I. Thời gian mở và đóng bài học</div>
                                                    <div class="qns-form-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                                        <div class="form-group">
                                                            <label class="form-label">Thời gian bắt đầu</label>
                                                            <input type="datetime-local" id="form-schedule-start" class="form-input" value="${editingData?.settings?.schedule?.startAt || ''}">
                                                        </div>
                                                        <div class="form-group">
                                                            <label class="form-label">Thời gian kết thúc</label>
                                                            <input type="datetime-local" id="form-schedule-end" class="form-input" value="${editingData?.settings?.schedule?.endAt || ''}">
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- II. Cài đặt hạn nộp bài -->
                                                <div>
                                                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary-color); margin-bottom: 8px;">II. Cài đặt hạn nộp bài</div>
                                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; margin-bottom: 12px;">
                                                        <input type="checkbox" id="form-has-due-date" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.settings?.schedule?.hasDueDate ? 'checked' : ''}>
                                                        <span>Thiết lập hạn nộp bài</span>
                                                    </label>

                                                    <!-- Các trường phụ thuộc khi bật hạn nộp -->
                                                    <div id="due-date-dependent-fields" style="display: ${editingData?.settings?.schedule?.hasDueDate ? 'flex' : 'none'}; padding-left: 20px; border-left: 2px solid var(--primary-light); margin-top: 10px; flex-direction: column; gap: 14px;">
                                                        <div class="form-group">
                                                            <label class="form-label">Hạn nộp bài</label>
                                                            <input type="datetime-local" id="form-due-at" class="form-input" value="${editingData?.settings?.schedule?.dueAt || ''}">
                                                        </div>
                                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 500;">
                                                            <input type="checkbox" id="form-allow-late" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.settings?.schedule?.allowLateSubmission ? 'checked' : ''}>
                                                            <span>Cho phép học sinh nộp bài sau hạn</span>
                                                        </label>
                                                        <div class="form-group" id="late-policy-wrapper" style="display: ${editingData?.settings?.schedule?.allowLateSubmission ? 'block' : 'none'};">
                                                            <label class="form-label">Xử lý khi quá hạn</label>
                                                            <select id="form-late-policy" class="form-select">
                                                                <option value="mark_late" ${editingData?.settings?.schedule?.latePolicy === 'mark_late' ? 'selected' : ''}>Vẫn cho phép nộp nhưng đánh dấu là nộp muộn</option>
                                                                <option value="reject" ${!editingData?.settings?.schedule?.latePolicy || editingData?.settings?.schedule?.latePolicy === 'reject' ? 'selected' : ''}>Không cho phép nộp bài sau hạn</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- 3. Cài đặt nộp bài -->
                                            <div>
                                                <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 12px; color: var(--text-color);">3. Cài đặt nộp bài</h4>
                                                
                                                <!-- a. Yêu cầu nộp tệp -->
                                                <div style="margin-bottom: 14px;">
                                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; margin-bottom: 10px;">
                                                        <input type="checkbox" id="form-require-file" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.settings?.submission?.requireFile !== false ? 'checked' : ''}>
                                                        <span>Yêu cầu học sinh nộp tệp bài làm</span>
                                                    </label>
                                                    
                                                    <!-- Các trường cấu hình chi tiết tệp khi bật yêu cầu nộp tệp -->
                                                    <div id="require-file-dependent-fields" style="display: ${editingData?.settings?.submission?.requireFile !== false ? 'flex' : 'none'}; padding-left: 20px; border-left: 2px solid var(--primary-light); margin-top: 10px; flex-direction: column; gap: 14px;">
                                                        
                                                        <!-- Số lượng và Dung lượng tối đa -->
                                                        <div class="qns-form-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                                            <div class="form-group">
                                                                <label class="form-label">Số lượng tệp tối đa</label>
                                                                <input type="number" id="form-max-files" class="form-input" min="1" step="1" value="${editingData?.settings?.submission?.maxFiles !== undefined ? editingData.settings.submission.maxFiles : 5}">
                                                            </div>
                                                            <div class="form-group">
                                                                <label class="form-label">Dung lượng tối đa mỗi tệp (MB)</label>
                                                                <input type="number" id="form-max-size-mb" class="form-input" min="1" step="1" value="${editingData?.settings?.submission?.maxSizeMB !== undefined ? editingData.settings.submission.maxSizeMB : 20}">
                                                            </div>
                                                        </div>

                                                        <!-- Định dạng tệp được phép -->
                                                        <div class="form-group">
                                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                                                <label class="form-label" style="margin-bottom: 0;">Định dạng tệp được phép</label>
                                                                <div>
                                                                    <button type="button" class="btn" id="btn-select-all-formats" style="font-size: 0.75rem; padding: 3px 8px; background: #e2e8f0; color: var(--text-color); margin-right: 4px;">Chọn tất cả</button>
                                                                    <button type="button" class="btn" id="btn-deselect-all-formats" style="font-size: 0.75rem; padding: 3px 8px; background: #e2e8f0; color: var(--text-color);">Bỏ chọn tất cả</button>
                                                                </div>
                                                            </div>
                                                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #fff; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                                                                ${(() => {
                                                                    const formats = ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'JPG', 'JPEG', 'PNG', 'ZIP', 'RAR'];
                                                                    const allowedFormats = editingData?.settings?.submission?.allowedFormats || ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'JPG', 'JPEG', 'PNG', 'ZIP', 'RAR'];
                                                                    return formats.map(fmt => `
                                                                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;">
                                                                            <input type="checkbox" class="form-format-checkbox" value="${fmt}" ${allowedFormats.includes(fmt) ? 'checked' : ''} style="width: 14px; height: 14px; cursor: pointer;">
                                                                            <span>${fmt}</span>
                                                                        </label>
                                                                    `).join('');
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- b. Cho phép nộp nhiều lần -->
                                                <div style="margin-bottom: 14px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; margin-bottom: 10px;">
                                                        <input type="checkbox" id="form-allow-multiple" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.settings?.submission?.allowMultiple ? 'checked' : ''}>
                                                        <span>Cho phép học sinh nộp lại bài</span>
                                                    </label>
                                                    <div class="form-group" id="max-attempts-wrapper" style="display: ${editingData?.settings?.submission?.allowMultiple ? 'block' : 'none'}; padding-left: 20px;">
                                                        <label class="form-label">Số lần nộp tối đa</label>
                                                        <select id="form-max-attempts" class="form-select">
                                                            <option value="unlimited" ${editingData?.settings?.submission?.maxAttempts === 'unlimited' ? 'selected' : ''}>Không giới hạn</option>
                                                            <option value="1" ${editingData?.settings?.submission?.maxAttempts === 1 || editingData?.settings?.submission?.maxAttempts === '1' ? 'selected' : ''}>1 lần</option>
                                                            <option value="2" ${editingData?.settings?.submission?.maxAttempts === 2 || editingData?.settings?.submission?.maxAttempts === '2' ? 'selected' : ''}>2 lần</option>
                                                            <option value="3" ${editingData?.settings?.submission?.maxAttempts === 3 || editingData?.settings?.submission?.maxAttempts === '3' ? 'selected' : ''}>3 lần</option>
                                                            <option value="5" ${editingData?.settings?.submission?.maxAttempts === 5 || editingData?.settings?.submission?.maxAttempts === '5' ? 'selected' : ''}>5 lần</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <!-- c & d. Ghi chú và Xóa tệp -->
                                                <div style="display: flex; flex-direction: column; gap: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 500;">
                                                        <input type="checkbox" id="form-allow-note" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.settings?.submission?.allowNote !== false ? 'checked' : ''}>
                                                        <span>Cho phép học sinh gửi ghi chú kèm bài nộp</span>
                                                    </label>
                                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 500;">
                                                        <input type="checkbox" id="form-allow-delete-file" style="width: 16px; height: 16px; cursor: pointer;" ${editingData?.settings?.submission?.allowDeleteFile !== false ? 'checked' : ''}>
                                                        <span>Cho phép học sinh xóa tệp đã nộp</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Nút thao tác cuối biểu mẫu -->
                                        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
                                            <button type="button" class="btn" id="btn-cancel-form" style="background-color: #e2e8f0; color: var(--text-color);">Hủy</button>
                                            <button type="button" class="btn" id="btn-save-draft" style="background-color: #fef3c7; color: #d97706; border: 1px solid #fcd34d;">Lưu bản nháp</button>
                                            <button type="submit" class="btn btn-primary" id="btn-save-publish">Lưu và xuất bản</button>
                                        </div>
                                    </form>
                                </div>
                            `;
    // Khởi tạo danh sách tài nguyên (hỗ trợ tương thích ngược dữ liệu cũ `link`)
                            let initialResources = [];
                            if (editingData && Array.isArray(editingData.resources) && editingData.resources.length > 0) {
                                initialResources = editingData.resources;
                            } else if (editingData && editingData.link && editingData.link !== '#') {
                                initialResources = [{ type: 'document', url: editingData.link }];
                            } else {
                                initialResources = [{ type: 'document', url: '' }];
                            }

                            
                            // Hàm điều khiển hiển thị thống nhất cho các khối *-dependent-fields (giữ bố cục flex dọc vốn có)
    function setDependentFieldsVisible(fieldsEl, isVisible) {
        if (!fieldsEl) return;
        fieldsEl.style.display = isVisible ? 'flex' : 'none';
    }

    const isTestCheckbox = document.getElementById('form-is-test');
                            const dependentFields = document.getElementById('grading-dependent-fields');

                            if (isTestCheckbox && dependentFields) {
                                isTestCheckbox.addEventListener('change', function() {
                                    if (this.checked) {
                                        setDependentFieldsVisible(dependentFields, true);
                                    } else {
                                        setDependentFieldsVisible(dependentFields, false);
                                    }
                                });
                            }
                            const maxScoreInput = document.getElementById('form-max-score');
                            const maxScoreWrapper = maxScoreInput ? maxScoreInput.closest('.form-group') : null;
                            if (isTestCheckbox && maxScoreWrapper) {
                                isTestCheckbox.addEventListener('change', function() {
                                    if (this.checked) {
                                        maxScoreWrapper.style.display = 'block';
                                    } else {
                                        maxScoreWrapper.style.display = 'none';
                                        if (maxScoreInput) maxScoreInput.value = '';
                                    }
                                });
                            }

                            // Xử lý bật/tắt hiển thị phần hạn nộp
                            const hasDueDateCheckbox = document.getElementById('form-has-due-date');
                            const dueDateFields = document.getElementById('due-date-dependent-fields');
                            if (hasDueDateCheckbox && dueDateFields) {
                                hasDueDateCheckbox.addEventListener('change', function() {
                                    setDependentFieldsVisible(dueDateFields, this.checked);
                                });
                            }

                            // Xử lý bật/tắt chính sách nộp muộn
                            const allowLateCheckbox = document.getElementById('form-allow-late');
                            const latePolicyWrapper = document.getElementById('late-policy-wrapper');
                            if (allowLateCheckbox && latePolicyWrapper) {
                                allowLateCheckbox.addEventListener('change', function() {
                                    latePolicyWrapper.style.display = this.checked ? 'block' : 'none';
                                });
                            }

                            // Xử lý bật/tắt hiển thị phần yêu cầu nộp tệp
                            const requireFileCheckbox = document.getElementById('form-require-file');
                            const requireFileFields = document.getElementById('require-file-dependent-fields');
                            if (requireFileCheckbox && requireFileFields) {
                                requireFileCheckbox.addEventListener('change', function() {
                                    setDependentFieldsVisible(requireFileFields, this.checked);
                                });
                            }

                            // Xử lý bật/tắt hiển thị số lần nộp tối đa
                            const allowMultipleCheckbox = document.getElementById('form-allow-multiple');
                            const maxAttemptsWrapper = document.getElementById('max-attempts-wrapper');
                            if (allowMultipleCheckbox && maxAttemptsWrapper) {
                                allowMultipleCheckbox.addEventListener('change', function() {
                                    maxAttemptsWrapper.style.display = this.checked ? 'block' : 'none';
                                });
                            }

                            // Đồng bộ trạng thái ban đầu của các khối phụ thuộc theo checkbox ngay khi mở form
    setDependentFieldsVisible(dependentFields, !!(isTestCheckbox && isTestCheckbox.checked));
    setDependentFieldsVisible(dueDateFields, !!(hasDueDateCheckbox && hasDueDateCheckbox.checked));
    setDependentFieldsVisible(requireFileFields, !!(requireFileCheckbox && requireFileCheckbox.checked));

    // Xử lý nút Chọn tất cả / Bỏ chọn tất cả định dạng tệp
                            document.getElementById('btn-select-all-formats')?.addEventListener('click', function() {
                                document.querySelectorAll('.form-format-checkbox').forEach(cb => cb.checked = true);
                            });
                            document.getElementById('btn-deselect-all-formats')?.addEventListener('click', function() {
                                document.querySelectorAll('.form-format-checkbox').forEach(cb => cb.checked = false);
                            });

                            window.renderResourceRows = function(resList) {
                                const container = document.getElementById('resources-container');
                                if (!container) return;
                                container.innerHTML = '';
                                resList.forEach((res, idx) => {
                                    const rowDiv = document.createElement('div');
                                    rowDiv.className = 'resource-row-item';
                                    rowDiv.style.cssText = 'display: flex; gap: 10px; align-items: center; background: #fff; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 8px;';
                                    rowDiv.innerHTML = `
                                        <div class="res-type-wrap" style="width: 200px; flex-shrink: 0;">
                                            <select class="form-select res-type-select" style="padding: 8px;">
                                                <option value="pdf" ${res.type === 'pdf' ? 'selected' : ''}>1. PDF</option>
                                                <option value="word" ${res.type === 'word' ? 'selected' : ''}>2. Word (DOC/DOCX)</option>
                                                <option value="excel" ${res.type === 'excel' ? 'selected' : ''}>3. Excel (XLS/XLSX)</option>
                                                <option value="powerpoint" ${res.type === 'powerpoint' ? 'selected' : ''}>4. PowerPoint (PPT/PPTX)</option>
                                                <option value="form" ${res.type === 'form' ? 'selected' : ''}>5. Google Form</option>
                                                <option value="link" ${res.type === 'link' ? 'selected' : ''}>6. Liên kết khác</option>
                                                <option value="video" ${res.type === 'video' ? 'selected' : ''}>7. Video</option>
                                                <option value="archive" ${res.type === 'archive' ? 'selected' : ''}>8. Tệp nén (ZIP/RAR)</option>
                                                <option value="document" ${res.type === 'document' ? 'selected' : ''}>9. Tài liệu chung</option>
                                                <option value="image" ${res.type === 'image' ? 'selected' : ''}>10. Hình ảnh (PNG/JPG)</option>
                                                <option value="other" ${res.type === 'other' || !res.type ? 'selected' : ''}>11. Tệp khác / Còn lại</option>
                                            </select>
                                        </div>
                                        <div class="res-fields-wrap" style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
                                            <input type="text" class="form-input res-name-input" placeholder="Tên tài nguyên (Ví dụ: Đề thi thử số 1)..." value="${window.qnsEscapeHtml(res.name)}" style="padding: 6px 10px; font-size: 0.85rem;">
                                            <input type="text" class="form-input res-url-input" placeholder="Đường dẫn Google Drive hoặc URL..." value="${window.qnsEscapeHtml(res.url)}" style="padding: 6px 10px; font-size: 0.85rem;">
                                        </div>
                                        <button type="button" class="btn btn-delete-res-row" onclick="this.closest('.resource-row-item').remove()" title="Xóa tài nguyên này" style="background-color: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 10px 14px; cursor: pointer;">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                                    `;
                                    container.appendChild(rowDiv);
                                });
                            };

                            // Khởi tạo render danh sách ban đầu
                            window.renderResourceRows(initialResources);
                            
                            // Nạp dữ liệu cho select Section và Subsection
                            const secSelect = document.getElementById('form-section-id');
                            const subSelect = document.getElementById('form-subsection-id');
                            const allSections = getStoredSections();
                            const allSubsections = getStoredSubsections();
                            
                            secSelect.innerHTML = allSections.sort((a,b) => a.order - b.order).map(s => `<option value="${window.qnsEscapeHtml(s.id)}">${window.qnsEscapeHtml(s.name)}</option>`).join('');
                            if (editingData && editingData.sectionId) secSelect.value = editingData.sectionId;
                            
                            secSelect.addEventListener('change', function() {
                                const currSecId = this.value;
                                const subs = allSubsections.filter(sub => sub.sectionId === currSecId).sort((a,b) => a.order - b.order);
                                if (subs.length === 0) {
                                    subSelect.innerHTML = `<option value="">(Chưa có Subsection - Vui lòng tạo trước)</option>`;
                                    subSelect.disabled = true;
                                } else {
                                    subSelect.innerHTML = subs.map(sub => `<option value="${window.qnsEscapeHtml(sub.id)}">${window.qnsEscapeHtml(sub.name)}</option>`).join('');
                                    subSelect.disabled = false;
                                }
                            });
                            
                            // Trigger để load lần đầu
                            secSelect.dispatchEvent(new Event('change'));
                            if (editingData && editingData.subsectionId) {
                                subSelect.value = editingData.subsectionId;
                            } else if (editingData && editingData.sectionId === 'section-1' && !editingData.subsectionId) {
                                subSelect.value = 'subsec-1'; // Tương thích ngược bài học cũ
                            }

                            // Gắn trực tiếp sự kiện click an toàn cho nút Thêm tài nguyên
                            const addResourceBtn = document.getElementById('btn-add-resource-row');
                            if (addResourceBtn) {
                                addResourceBtn.onclick = function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const container = document.getElementById('resources-container');
                                    if (!container) return;

                                    const currentRows = [];
                                    container.querySelectorAll('.resource-row-item').forEach(row => {
                                        currentRows.push({
                                            type: row.querySelector('.res-type-select').value,
                                            name: row.querySelector('.res-name-input').value.trim(),
                                            url: row.querySelector('.res-url-input').value.trim()
                                        });
                                    });
                                    currentRows.push({ type: 'document', name: '', url: '' });
                                    window.renderResourceRows(currentRows);
                                };
                            }
                            // Sự kiện Hủy / Quay lại
                            const cancelHandler = () => {
                                dynamicMainView.innerHTML = window.originalStudentMainHtml;
                                window.originalStudentMainHtml = null;
                                if (typeof window.rebindCourseHomeEvents === 'function') window.rebindCourseHomeEvents();
                            };

                            document.getElementById('btn-cancel-lesson-form').addEventListener('click', cancelHandler);
                            document.getElementById('btn-cancel-form').addEventListener('click', cancelHandler);

                            // Sự kiện Lưu form (Bản nháp hoặc Xuất bản)
                            document.getElementById('teacher-lesson-form').addEventListener('submit', function(e) {
                                e.preventDefault();
                                saveLessonData('published', editLessonId);
                            });

                            document.getElementById('btn-save-draft').addEventListener('click', function() {
                                saveLessonData('draft', editLessonId);
                            });
                        }

                        // Hàm lưu dữ liệu bài học vào LocalStorage
                        async function saveLessonData(status, existingId = null) {
                            if (!QNS_AUTH.requireTeacher('saveLessonData')) return;
                            const title = document.getElementById('form-lesson-title').value.trim();
                            if (!title) {
                                alert('Vui lòng nhập tiêu đề bài học!');
                                return;
                            }

                            // Kiểm tra cấu hình chấm điểm
                            const isTestChecked = document.getElementById('form-is-test').checked;
                            let maxScoreVal = null;

                            if (isTestChecked) {
                                const rawScore = document.getElementById('form-max-score').value.trim();
                                maxScoreVal = parseFloat(rawScore);
                                if (isNaN(maxScoreVal) || maxScoreVal <= 0) {
                                    alert('Vui lòng nhập điểm tối đa hợp lệ lớn hơn 0 cho bài kiểm tra!');
                                    document.getElementById('form-max-score').focus();
                                    return;
                                }
                            }

                            // Thu thập danh sách tài nguyên từ các dòng động với đầy đủ Tên, URL và Loại tệp
                            const collectedResources = [];
                            document.querySelectorAll('.resource-row-item').forEach(row => {
                                const typeVal = row.querySelector('.res-type-select').value;
                                const nameVal = row.querySelector('.res-name-input').value.trim();
                                const urlVal = row.querySelector('.res-url-input').value.trim();
                                if (urlVal) {
                                    collectedResources.push({ 
                                        type: typeVal, 
                                        name: nameVal || 'Tài liệu đính kèm', 
                                        url: urlVal 
                                    });
                                }
                            });

                            // Kiểm tra quy tắc chống lỗi: Thời gian kết thúc không được sớm hơn thời gian bắt đầu
                            const startAtVal = document.getElementById('form-schedule-start').value || null;
                            const endAtVal = document.getElementById('form-schedule-end').value || null;
    // Hạn mở/đóng bài học (mục 2) là dữ liệu độc lập với lịch học (startAt/endAt)
    const openAtVal = document.getElementById('form-open-at').value || null;
    const closeAtVal = document.getElementById('form-close-at').value || null;
                            if (startAtVal && endAtVal && new Date(endAtVal) < new Date(startAtVal)) {
                                alert('Lỗi: Thời gian kết thúc bài học không được sớm hơn thời gian bắt đầu!');
                                document.getElementById('form-schedule-end').focus();
                                return;
                            }

                            const hasDueDateVal = document.getElementById('form-has-due-date').checked;
                            const dueAtVal = document.getElementById('form-due-at').value || null;
                            const allowLateVal = document.getElementById('form-allow-late').checked;
                            const latePolicyVal = document.getElementById('form-late-policy').value;

                            // Thu thập cài đặt nộp bài
                            const requireFileVal = document.getElementById('form-require-file').checked;
                            const maxFilesVal = parseInt(document.getElementById('form-max-files').value) || 5;
                            const maxSizeMBVal = parseInt(document.getElementById('form-max-size-mb').value) || 20;
                            
                            let allowedFormatsArr = [];
                            document.querySelectorAll('.form-format-checkbox:checked').forEach(cb => {
                                allowedFormatsArr.push(cb.value);
                            });

                            const allowMultipleVal = document.getElementById('form-allow-multiple').checked;
                            let maxAttemptsVal = document.getElementById('form-max-attempts').value;
                            if (maxAttemptsVal !== 'unlimited') {
                                maxAttemptsVal = parseInt(maxAttemptsVal) || 1;
                            }
                            const allowNoteVal = document.getElementById('form-allow-note').checked;
                            const allowDeleteFileVal = document.getElementById('form-allow-delete-file').checked;

                            const lessons = getStoredLessons();
                            const subIdVal = document.getElementById('form-subsection-id').value;
                            if (!subIdVal) { alert('Vui lòng chọn hoặc tạo Subsection trước khi lưu bài học.'); return; }
                            
                            const lessonData = {
                                id: existingId || '',
                                sectionId: document.getElementById('form-section-id').value,
                                subsectionId: subIdVal,
                                type: document.getElementById('form-lesson-type').value,
                                title: title,
                                desc: document.getElementById('form-lesson-short-desc').value.trim(),
                                detailedDesc: document.getElementById('form-detailed-desc').value.trim(),
                                resources: collectedResources,
                                link: collectedResources.length > 0 ? collectedResources[0].url : '#', // Tương thích ngược
                                open: openAtVal,
                                close: closeAtVal,
                                settings: {
                                    schedule: {
                                        startAt: startAtVal,
                                        endAt: endAtVal,
                                        hasDueDate: hasDueDateVal,
                                        dueAt: dueAtVal,
                                        allowLateSubmission: allowLateVal,
                                        latePolicy: latePolicyVal
                                    },
                                    submission: {
                                        requireFile: requireFileVal,
                                        maxFiles: maxFilesVal,
                                        maxSizeMB: maxSizeMBVal,
                                        allowedFormats: allowedFormatsArr,
                                        allowMultiple: allowMultipleVal,
                                        maxAttempts: maxAttemptsVal,
                                        allowNote: allowNoteVal,
                                        allowDeleteFile: allowDeleteFileVal
                                    }
                                },
                                status: status,
                                gradingSettings: (() => {
                                const isGradedChecked = document.getElementById('form-is-test').checked;
                                if (!isGradedChecked) {
                                    return { isGraded: false };
                                }
                                const maxScoreVal = parseFloat(document.getElementById('form-max-score').value);
                                const passingScoreVal = parseFloat(document.getElementById('form-passing-score').value);

                                if (isNaN(maxScoreVal) || maxScoreVal <= 0) {
                                    alert('Điểm tối đa phải là số lớn hơn 0!');
                                    document.getElementById('form-max-score').focus();
                                    throw new Error('Invalid max score');
                                }
                                if (isNaN(passingScoreVal) || passingScoreVal < 0) {
                                    alert('Điểm đạt yêu cầu không hợp lệ!');
                                    document.getElementById('form-passing-score').focus();
                                    throw new Error('Invalid passing score');
                                }
                                if (passingScoreVal > maxScoreVal) {
                                    alert('Điểm đạt yêu cầu không được lớn hơn điểm tối đa!');
                                    document.getElementById('form-passing-score').focus();
                                    throw new Error('Passing score exceeds max score');
                                }

                                return {
                                    isGraded: true,
                                    maxScore: maxScoreVal,
                                    passingScore: passingScoreVal,
                                    gradingMethod: document.getElementById('form-grading-method').value,
                                    scoreRelease: document.getElementById('form-score-release').value,
                                    showTeacherComments: document.getElementById('form-show-comments').checked,
                                    showAnswers: document.getElementById('form-show-answers').checked
                                };
                            })()
                        };

                            // [QNS_UI] Khóa theo bài học (tạo mới dùng khóa 'new'); spinner tại đúng nút đã bấm; requestId ổn định để Backend chống tạo trùng
                            const isCreateLesson = !existingId;
                            const lessonOp = QNS_UI.begin({
                                key: 'lesson.save:' + (existingId || 'new'),
                                btn: document.getElementById(status === 'draft' ? 'btn-save-draft' : 'btn-save-publish'),
                                peers: [document.getElementById(status === 'draft' ? 'btn-save-publish' : 'btn-save-draft')],
                                label: isCreateLesson ? 'Đang tạo bài học...' : 'Đang lưu bài học...',
                                toast: { loading: isCreateLesson ? 'Đang tạo bài học...' : 'Đang lưu bài học...' },
                                safeRetryAfterMs: isCreateLesson ? 60000 : 0
                            });
                            if (!lessonOp) return;   // đang xử lý: bỏ qua nhấn lặp
                            try {
                                // Gọi Backend thay vì LocalStorage
                                const lessonPayload = { lesson: lessonData };
                                if (isCreateLesson) lessonPayload.requestId = QNS_UI.requestId('lesson.create', JSON.stringify(lessonData));
                                const savedRes = await API.request('lesson.save', lessonPayload);
                                const savedLessonId = savedRes && (savedRes.lessonId || savedRes.id);
                                if (!savedLessonId) throw new Error('Máy chủ không trả về ID bài học sau khi lưu.');
                                lessonData.id = savedLessonId;
                                const reloadRes = await window.loadCourseData(); // Refresh Data Cache
    if (!reloadRes || reloadRes.ok === false) {
        throw new Error('Bài học đã được lưu trên máy chủ nhưng chưa tải lại được danh sách. Vui lòng tải lại trang để kiểm tra. (' + ((reloadRes && reloadRes.message) || 'Lỗi tải dữ liệu') + ')');
    }
    const storeLessons = (window.QNS_STORE && window.QNS_STORE.lessons) || [];
    if (!storeLessons.some(function (x) { return String(x.id) === String(savedLessonId); })) {
        throw new Error('Máy chủ báo đã lưu nhưng bài học chưa xuất hiện trong dữ liệu tải lại. Vui lòng tải lại trang và kiểm tra.');
    }
                                if (isCreateLesson) QNS_UI.clearRequestId('lesson.create');
                                lessonOp.end();   // [QNS_UI] kết thúc Loading trước hộp thoại thành công
                            } catch(e) {
                                lessonOp.end();   // [QNS_UI] luôn khôi phục nút, form giữ nguyên dữ liệu
                                if (e && e.code === 'UNAUTHENTICATED') return;
                                await window.showAppAlert({
                                    type: 'error',
                                    title: 'Lỗi',
                                    message: (isCreateLesson && e && e.isNetworkError)
                                        ? 'Mất kết nối với máy chủ nên chưa xác định được bài học đã được tạo hay chưa. Hãy bấm lưu lại: hệ thống sẽ đối soát và không tạo bài học trùng.'
                                        : e.message
                                });
                                return;
                            }

                            await window.showAppAlert({
                                type: 'success',
                                title: 'Thông báo',
                                message: status === 'published' ? 'Đã lưu và xuất bản bài học thành công!' : 'Đã lưu bài học vào bản nháp!'
                            });
                            
                            // Khôi phục giao diện chính và cập nhật DOM không cần reload
                            const dynamicMainView = document.getElementById('dynamic-main-view');
                            if (window.originalStudentMainHtml) {
                                dynamicMainView.innerHTML = window.originalStudentMainHtml;
                                window.originalStudentMainHtml = null;
                            }
                            
                            // Render lại danh sách khóa học và kết nối lại các sự kiện (Vào học, Tabs, Accordion)
                            if (typeof window.renderStudentLessons === 'function') window.renderStudentLessons();
                            if (typeof window.rebindCourseHomeEvents === 'function') window.rebindCourseHomeEvents();
                            
                            // Giải phóng bộ nhớ đệm
                            window.currentActiveLessonId = null;
                            window.currentActiveLesson = null;
                        }

                        // Giao diện Quản lý nội dung (Cấu trúc phân cấp Section -> Subsection -> Bài học)
                        // [T20] Bảng tiến độ lớp cho giáo viên. Mọi số liệu lấy từ progress.listStudents (máy chủ kiểm quyền và phạm vi khóa).
                        async function renderClassProgressView() {
                            if (!QNS_AUTH.requireTeacher('renderClassProgressView')) return;
                            const view = document.getElementById('dynamic-main-view');
                            if (!view) return;
                            view.innerHTML = `
                                <div><button class="btn-back-course" id="btn-back-from-progress"><i class="fa-solid fa-arrow-left"></i><span>Quay lại quản lý nội dung</span></button></div>
                                <div class="content-detail-card" style="margin-top: 16px;">
                                    <h2 class="detail-header-title"><i class="fa-solid fa-chart-column" style="color: var(--primary-color);"></i><span>Tiến độ lớp</span></h2>
                                    <div id="class-progress-body" style="color: var(--text-muted);">Đang tải...</div>
                                </div>`;
                            document.getElementById('btn-back-from-progress').addEventListener('click', function() { renderContentManagementView(); });
                            const body = document.getElementById('class-progress-body');
                            try {
                                const data = await API.request('progress.listStudents', {});
                                const list = (data && Array.isArray(data.students)) ? data.students : [];
                                const total = Number(data && data.totalLessons) || 0;
                                if (list.length === 0) { body.textContent = 'Khóa học chưa có học sinh được ghi danh.'; return; }
                                const esc = window.qnsEscapeHtml;
                                const fmt = function(v) { const d = v ? new Date(v) : null; return (d && !isNaN(d.getTime())) ? d.toLocaleString('vi-VN') : '—'; };
                                let rows = '';
                                list.forEach(function(s) {
                                    const done = Number(s.completedCount) || 0;
                                    const pct = total > 0 ? Math.min(100, Math.round(done * 100 / total)) : 0;
                                    rows += `<tr>
                                        <td style="padding: 8px 10px;">${esc(s.fullName)}</td>
                                        <td style="padding: 8px 10px;">${esc(s.studentId)}</td>
                                        <td style="padding: 8px 10px; text-align: center;">${done}/${total} (${pct}%)</td>
                                        <td style="padding: 8px 10px;">${esc(fmt(s.lastCompletedAt))}</td>
                                    </tr>`;
                                });
                                body.innerHTML = `<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                    <thead><tr style="text-align: left; border-bottom: 2px solid var(--border-color);">
                                        <th style="padding: 8px 10px;">Học sinh</th><th style="padding: 8px 10px;">Mã</th>
                                        <th style="padding: 8px 10px; text-align: center;">Hoàn thành</th><th style="padding: 8px 10px;">Gần nhất</th>
                                    </tr></thead><tbody>${rows}</tbody></table></div>`;
                            } catch (err) {
                                body.textContent = '';
                                window.showAppAlert({ type: 'error', title: 'Lỗi', message: 'Không thể tải tiến độ lớp: ' + (err && err.message ? err.message : 'Lỗi không xác định') });
                            }
                        }

                        function renderContentManagementView() {
                            if (!QNS_AUTH.requireTeacher('renderContentManagementView')) return;
                            const lessons = getStoredLessons();
                            const sections = getStoredSections().sort((a,b) => (Number(a.order) || 0) - (Number(b.order) || 0)); // [T10] chống NaN
                            const subsections = getStoredSubsections().sort((a,b) => (Number(a.order) || 0) - (Number(b.order) || 0));
                            
                            const dynamicMainView = document.getElementById('dynamic-main-view');
                            if (!dynamicMainView) return;

                            if (!window.originalStudentMainHtml || document.querySelector('.course-header-card')) {
                                window.originalStudentMainHtml = dynamicMainView.innerHTML;
                            }

                            let treeHtml = '';
                            sections.forEach(secRaw => {
                                const sec = Object.assign({}, secRaw, { id: window.qnsEscapeHtml(secRaw.id) }); // [T24] id chỉ dùng cho thuộc tính HTML
                                const subs = subsections.filter(s => s.sectionId === secRaw.id);
                                treeHtml += `
                                <div style="background: #f8f9fa; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 16px; overflow: hidden;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: var(--primary-light); border-bottom: 1px solid var(--border-color);">
                                        <h3 style="margin: 0; font-size: 1.05rem; color: var(--primary-color);"><i class="fa-solid fa-layer-group"></i> ${window.qnsEscapeHtml(sec.name)}</h3>
                                        <div class="teacher-action-btns">
                                            <button class="btn-teacher-act btn-move-up-sec" data-id="${sec.id}" title="Di chuyển lên"><i class="fa-solid fa-arrow-up"></i></button>
                                            <button class="btn-teacher-act btn-move-down-sec" data-id="${sec.id}" title="Di chuyển xuống"><i class="fa-solid fa-arrow-down"></i></button>
                                            <button class="btn-teacher-act btn-add-sub" data-sec="${sec.id}"><i class="fa-solid fa-plus"></i> Thêm Subsection</button>
                                            <button class="btn-teacher-act btn-edit-sec" data-id="${sec.id}" data-name="${window.qnsEscapeHtml(sec.name)}"><i class="fa-solid fa-pen"></i></button>
                                            <button class="btn-teacher-act btn-delete-act btn-delete-sec" data-id="${sec.id}"><i class="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                    <div style="padding: 16px 20px;">
                                `;
                                
                                if (subs.length === 0) treeHtml += `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">Chưa có Subsection. Vui lòng thêm Subsection để tạo bài học.</div>`;
                                
                                subs.forEach(subRaw => {
                                    const sub = Object.assign({}, subRaw, { id: window.qnsEscapeHtml(subRaw.id) }); // [T24]
                                    const subLessons = lessons.filter(l => l.subsectionId === subRaw.id || (!l.subsectionId && l.sectionId === secRaw.id && subRaw.id === 'subsec-1'));
                                    treeHtml += `
                                    <div style="border-left: 2px solid #cbd5e1; padding-left: 16px; margin-bottom: 16px; position: relative;">
                                        <div style="position: absolute; left: 0; top: 12px; width: 12px; height: 2px; background: #cbd5e1;"></div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                            <h4 style="margin: 0; font-size: 0.95rem; color: var(--text-color);"><i class="fa-regular fa-folder-open" style="color: #64748b;"></i> ${window.qnsEscapeHtml(sub.name)}</h4>
                                            <div class="teacher-action-btns">
                                                <button class="btn-teacher-act btn-move-up-sub" data-id="${sub.id}" title="Di chuyển lên"><i class="fa-solid fa-arrow-up"></i></button>
                                                <button class="btn-teacher-act btn-move-down-sub" data-id="${sub.id}" title="Di chuyển xuống"><i class="fa-solid fa-arrow-down"></i></button>
                                                <button class="btn-teacher-act btn-add-lesson" data-sub="${sub.id}" data-sec="${sec.id}"><i class="fa-solid fa-plus"></i> Thêm Bài học</button>
                                                <button class="btn-teacher-act btn-edit-sub" data-id="${sub.id}" data-name="${window.qnsEscapeHtml(sub.name)}"><i class="fa-solid fa-pen"></i></button>
                                                <button class="btn-teacher-act btn-delete-act btn-delete-sub" data-id="${sub.id}"><i class="fa-solid fa-trash"></i></button>
                                            </div>
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 8px;">
                                    `;
                                    
                                    if (subLessons.length === 0) treeHtml += `<div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 8px;">Trống.</div>`;
                                    
                                    subLessons.forEach(rawLesson => {
                                        const l = window.qnsEscapeLessonFields(rawLesson);
                                        treeHtml += `
                                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #fff; border: 1px solid var(--border-color); border-radius: 6px;">
                                                <div>
                                                    <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-color);">
                                                        ${l.title} 
                                                        <span class="lesson-status-badge ${l.status === 'published' ? 'published' : 'draft'}" style="font-size: 0.65rem;">
                                                            ${l.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                                                        </span>
                                                    </div>
                                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Loại: ${l.type}</div>
                                                </div>
                                                <div class="teacher-action-btns">
                                                    <button class="btn-teacher-act btn-edit-lesson" data-id="${l.id}" style="padding: 4px 8px;"><i class="fa-solid fa-pen"></i> Sửa</button>
                                                    ${QNS_AUTH.isBackendConfigured() ? '' : `<button class="btn-teacher-act btn-delete-act btn-delete-lesson" data-id="${l.id}" style="padding: 4px 8px;"><i class="fa-solid fa-trash"></i> Xóa</button>`}
                                                </div>
                                            </div>
                                        `;
                                    });
                                    treeHtml += `</div></div>`;
                                });
                                treeHtml += `</div></div>`;
                            });

                            dynamicMainView.innerHTML = `
                                <div>
                                    <button class="btn-back-course" id="btn-back-from-mgmt">
                                        <i class="fa-solid fa-arrow-left"></i>
                                        <span>Quay lại trang chủ khóa học</span>
                                    </button>
                                </div>
                                <div class="content-detail-card" style="margin-top: 16px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                        <h2 class="detail-header-title" style="margin-bottom: 0;">
                                            <i class="fa-solid fa-folder-tree" style="color: var(--primary-color);"></i>
                                            <span>Quản lý cấu trúc nội dung</span>
                                        </h2>
                                        <div style="display: flex; gap: 8px;">
                                            <button class="btn" id="btn-mgmt-progress">
                                                <i class="fa-solid fa-chart-column" style="margin-right: 6px;"></i> Tiến độ lớp
                                            </button>
                                            <button class="btn btn-primary" id="btn-mgmt-add-section">
                                                <i class="fa-solid fa-plus" style="margin-right: 6px;"></i> Thêm Section
                                            </button>
                                        </div>
                                    </div>
                                    <div>${treeHtml}</div>
                                </div>
                            `;

                            // Sự kiện quay lại
                            document.getElementById('btn-back-from-mgmt').addEventListener('click', function() {
                                dynamicMainView.innerHTML = window.originalStudentMainHtml;
                                window.originalStudentMainHtml = null;
                                if (typeof window.rebindCourseHomeEvents === 'function') window.rebindCourseHomeEvents();
                            });

                            // [T20] Mở bảng tiến độ lớp (dữ liệu từ máy chủ)
                            const btnMgmtProgress = document.getElementById('btn-mgmt-progress');
                            if (btnMgmtProgress) btnMgmtProgress.addEventListener('click', function() { renderClassProgressView(); });

                            // [T10] Đổi chỗ một ID với ID kề bên; trả về mảng ID mới hoặc null nếu không di chuyển được
                            function moveId(ids, id, direction) {
                                const i = ids.indexOf(id);
                                const j = i + direction;
                                if (i < 0 || j < 0 || j >= ids.length) return null;
                                const copy = ids.slice();
                                const tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
                                return copy;
                            }

                            // [T10] Thao tác cấu trúc: gọi API -> chờ thành công -> tải lại -> vẽ lại. KHÔNG cập nhật giao diện lạc quan.
                            // localFallback chỉ chạy ở chế độ mô phỏng (chưa cấu hình backend), giữ tương thích phát triển.
                            async function runStructureAction(action, payload, localFallback) {
                                if (!QNS_AUTH.isBackendConfigured()) {
                                    if (typeof localFallback === 'function') { localFallback(); renderContentManagementView(); }
                                    return true;
                                }
                                // [QNS_UI] Khóa theo phạm vi nghiệp vụ "cấu trúc nội dung" (mọi thao tác này cùng tác động một cây dữ liệu);
                                // mỗi nút vẫn có spinner riêng. Nhấn lặp / nhấn nút khác khi đang xử lý => bị bỏ qua kèm thông báo.
                                const isCreate = (action === 'section.save' && !payload.sectionId) || (action === 'subsection.save' && !payload.subsectionId);
                                const isDelete = /\.delete$/.test(action);
                                const isReorder = /\.reorder$/.test(action);
                                const noun = /^section\./.test(action) ? 'Section' : 'Subsection';
                                const label = isReorder ? 'Đang sắp xếp...' : ((isCreate ? 'Đang tạo ' : (isDelete ? 'Đang xóa ' : 'Đang lưu ')) + noun + '...');
                                const op = QNS_UI.begin({
                                    key: 'structure',
                                    btn: QNS_UI.structureTrigger(),
                                    label: label,
                                    toast: { loading: label },
                                    busyMessage: 'Đang xử lý thao tác trước đó, vui lòng chờ trong giây lát...',
                                    safeRetryAfterMs: isCreate ? 60000 : 0
                                });
                                if (!op) return false; // chống bấm đúp
                                const sendPayload = isCreate
                                    ? Object.assign({}, payload, { requestId: QNS_UI.requestId('structure.create', action + '|' + JSON.stringify(payload)) })
                                    : payload;
                                try {
                                    await API.request(action, sendPayload);
                                    if (isCreate) QNS_UI.clearRequestId('structure.create');
                                } catch (e) {
                                    op.end();
                                    if (e && e.code === 'UNAUTHENTICATED') return false; // đã xử lý tập trung
                                    await window.showAppAlert({
                                        type: 'error',
                                        title: 'Không thực hiện được',
                                        message: (isCreate && e && e.isNetworkError)
                                            ? 'Mất kết nối với máy chủ nên chưa xác định được ' + noun + ' đã được tạo hay chưa. Hãy thử lại: hệ thống sẽ đối soát và không tạo trùng.'
                                            : ((e && e.message) ? e.message : 'Lỗi không xác định.')
                                    });
                                    return false;
                                }
                                try {
                                    const reload = await window.loadCourseData();
                                    if (!reload || reload.ok === false) {
                                        op.fail('Đã lưu nhưng chưa tải lại được dữ liệu.');
                                        await window.showAppAlert({ type: 'warning', title: 'Đã lưu, chưa tải lại được', message: 'Thao tác đã được máy chủ chấp nhận nhưng chưa tải lại được dữ liệu. Vui lòng tải lại trang.' });
                                        return true;
                                    }
                                    renderContentManagementView();
                                    if (isReorder) op.end();
                                    else op.succeed(isCreate ? ('Đã tạo ' + noun + ' thành công!') : (isDelete ? ('Đã xóa ' + noun + '.') : ('Đã lưu ' + noun + '.')));
                                    return true;
                                } finally {
                                    op.end();   // đảm bảo luôn mở khóa, kể cả khi tải lại dữ liệu phát sinh exception
                                }
                            }

                            // Hàm helper thay đổi thứ tự (chỉ còn dùng cho chế độ mô phỏng)
                            function reorderList(list, id, direction) {
                                const index = list.findIndex(item => item.id === id);
                                if (index < 0) return list;
                                if (direction === -1 && index > 0) {
                                    const temp = list[index];
                                    list[index] = list[index - 1];
                                    list[index - 1] = temp;
                                } else if (direction === 1 && index < list.length - 1) {
                                    const temp = list[index];
                                    list[index] = list[index + 1];
                                    list[index + 1] = temp;
                                }
                                return list.map((item, i) => Object.assign({}, item, { order: i + 1 }));
                            }

                            // 1. Quản lý Section
                            document.getElementById('btn-mgmt-add-section').addEventListener('click', async function() {
                                const name = await window.showAppPrompt({ title: 'Thêm Section mới', placeholder: 'Nhập tên Section (VD: Chương 1)' });
                                if (name && name.trim()) {
                                    if (sections.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
                                        window.showAppAlert({ type: 'warning', title: 'Lỗi trùng lặp', message: 'Tên Section này đã tồn tại!' });
                                        return;
                                    }
                                    await runStructureAction('section.save', { name: name.trim() }, function () {
                                        const maxOrder = sections.reduce(function (m, s) { return Math.max(m, Number(s.order) || 0); }, 0);
                                        saveStoredSections([...sections, { id: 'sec_' + Date.now(), name: name.trim(), order: maxOrder + 1 }]);
                                    });
                                }
                            });

                            dynamicMainView.querySelectorAll('.btn-edit-sec').forEach(btn => btn.addEventListener('click', async function() {
                                const id = this.getAttribute('data-id');
                                const oldName = this.getAttribute('data-name');
                                const name = await window.showAppPrompt({ title: 'Sửa tên Section', defaultValue: oldName });
                                if (name && name.trim() && name.trim() !== oldName) {
                                    if (sections.some(s => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== id)) {
                                        window.showAppAlert({ type: 'warning', title: 'Lỗi trùng lặp', message: 'Tên Section này đã tồn tại!' });
                                        return;
                                    }
                                    await runStructureAction('section.save', { sectionId: id, name: name.trim() }, function () {
                                        saveStoredSections(sections.map(s => s.id === id ? Object.assign({}, s, {name: name.trim()}) : s));
                                    });
                                }
                            }));

                            dynamicMainView.querySelectorAll('.btn-delete-sec').forEach(btn => btn.addEventListener('click', async function() {
                                const id = this.getAttribute('data-id');
                                const subs = subsections.filter(s => s.sectionId === id);
                                if (subs.length > 0) {
                                    window.showAppAlert({ type: 'error', title: 'Không thể xóa', message: 'Vui lòng xóa các Subsection và Bài học bên trong trước khi xóa Section này.' });
                                    return;
                                }
                                if (await window.showAppConfirm({ title: 'Xóa Section', message: 'Bạn có chắc chắn muốn xóa Section này không?' })) {
                                    await runStructureAction('section.delete', { sectionId: id }, function () {
                                        saveStoredSections(sections.filter(s => s.id !== id));
                                    });
                                }
                            }));

                            // Sự kiện Sắp xếp Section
                            dynamicMainView.querySelectorAll('.btn-move-up-sec').forEach(btn => btn.addEventListener('click', async function() {
                                const orderedIds = moveId(sections.map(s => s.id), this.getAttribute('data-id'), -1);
                                if (!orderedIds) return;
                                const id = this.getAttribute('data-id');
                                await runStructureAction('section.reorder', { orderedIds: orderedIds }, function () {
                                    saveStoredSections(reorderList(sections, id, -1));
                                });
                            }));
                            dynamicMainView.querySelectorAll('.btn-move-down-sec').forEach(btn => btn.addEventListener('click', async function() {
                                const orderedIds = moveId(sections.map(s => s.id), this.getAttribute('data-id'), 1);
                                if (!orderedIds) return;
                                const id = this.getAttribute('data-id');
                                await runStructureAction('section.reorder', { orderedIds: orderedIds }, function () {
                                    saveStoredSections(reorderList(sections, id, 1));
                                });
                            }));

                            // 2. Quản lý Subsection
                            dynamicMainView.querySelectorAll('.btn-add-sub').forEach(btn => btn.addEventListener('click', async function() {
                                const secId = this.getAttribute('data-sec');
                                const name = await window.showAppPrompt({ title: 'Thêm Subsection', placeholder: 'Nhập tên Subsection (VD: Bài 1: Khảo sát)' });
                                if (name && name.trim()) {
                                    const subsInSec = subsections.filter(s => s.sectionId === secId);
                                    if (subsInSec.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
                                        window.showAppAlert({ type: 'warning', title: 'Lỗi trùng lặp', message: 'Tên Subsection này đã tồn tại trong Section!' });
                                        return;
                                    }
                                    await runStructureAction('subsection.save', { sectionId: secId, name: name.trim() }, function () {
                                        const newSub = { id: 'sub_' + Date.now(), sectionId: secId, name: name.trim(), order: subsInSec.length + 1 };
                                        saveStoredSubsections([...subsections, newSub]);
                                    });
                                }
                            }));

                            dynamicMainView.querySelectorAll('.btn-edit-sub').forEach(btn => btn.addEventListener('click', async function() {
                                const id = this.getAttribute('data-id');
                                const oldName = this.getAttribute('data-name');
                                const name = await window.showAppPrompt({ title: 'Sửa tên Subsection', defaultValue: oldName });
                                if (name && name.trim() && name.trim() !== oldName) {
                                    const targetSub = subsections.find(s => s.id === id);
                                    const subsInSec = subsections.filter(s => s.sectionId === targetSub.sectionId);
                                    if (subsInSec.some(s => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== id)) {
                                        window.showAppAlert({ type: 'warning', title: 'Lỗi trùng lặp', message: 'Tên Subsection này đã tồn tại!' });
                                        return;
                                    }
                                    await runStructureAction('subsection.save', { subsectionId: id, name: name.trim() }, function () {
                                        saveStoredSubsections(subsections.map(s => s.id === id ? Object.assign({}, s, {name: name.trim()}) : s));
                                    });
                                }
                            }));

                            dynamicMainView.querySelectorAll('.btn-delete-sub').forEach(btn => btn.addEventListener('click', async function() {
                                const id = this.getAttribute('data-id');
                                const hasLessons = lessons.some(l => l.subsectionId === id || (!l.subsectionId && l.sectionId === subsections.find(s => s.id===id).sectionId && id === 'subsec-1'));
                                if (hasLessons) {
                                    window.showAppAlert({ type: 'error', title: 'Không thể xóa', message: 'Subsection này đang chứa Bài học. Vui lòng xóa/di chuyển Bài học trước.' });
                                    return;
                                }
                                if (await window.showAppConfirm({ title: 'Xóa Subsection', message: 'Bạn chắc chắn muốn xóa Subsection này?' })) {
                                    await runStructureAction('subsection.delete', { subsectionId: id }, function () {
                                        saveStoredSubsections(subsections.filter(s => s.id !== id));
                                    });
                                }
                            }));

                            // Sự kiện Sắp xếp Subsection (Chỉ sắp xếp trong phạm vi cùng Section)
                            dynamicMainView.querySelectorAll('.btn-move-up-sub').forEach(btn => btn.addEventListener('click', async function() {
                                const subId = this.getAttribute('data-id');
                                const targetSub = subsections.find(s => s.id === subId);
                                if (!targetSub) return;
                                const subsInSec = subsections.filter(s => s.sectionId === targetSub.sectionId); // đã sắp xếp theo order ở đầu hàm
                                const orderedIds = moveId(subsInSec.map(s => s.id), subId, -1);
                                if (!orderedIds) return;
                                await runStructureAction('subsection.reorder', { orderedIds: orderedIds }, function () {
                                    const moved = reorderList(subsInSec, subId, -1);
                                    const otherSubs = subsections.filter(s => s.sectionId !== targetSub.sectionId);
                                    saveStoredSubsections([...otherSubs, ...moved]);
                                });
                            }));
                            dynamicMainView.querySelectorAll('.btn-move-down-sub').forEach(btn => btn.addEventListener('click', async function() {
                                const subId = this.getAttribute('data-id');
                                const targetSub = subsections.find(s => s.id === subId);
                                if (!targetSub) return;
                                const subsInSec = subsections.filter(s => s.sectionId === targetSub.sectionId);
                                const orderedIds = moveId(subsInSec.map(s => s.id), subId, 1);
                                if (!orderedIds) return;
                                await runStructureAction('subsection.reorder', { orderedIds: orderedIds }, function () {
                                    const moved = reorderList(subsInSec, subId, 1);
                                    const otherSubs = subsections.filter(s => s.sectionId !== targetSub.sectionId);
                                    saveStoredSubsections([...otherSubs, ...moved]);
                                });
                            }));

                            // 3. Quản lý Bài học (Lessons)
                            dynamicMainView.querySelectorAll('.btn-add-lesson').forEach(btn => btn.addEventListener('click', function() {
                                const secId = this.getAttribute('data-sec');
                                const subId = this.getAttribute('data-sub');
                                renderLessonFormModal();
                                setTimeout(() => {
                                    const secEl = document.getElementById('form-section-id');
                                    if(secEl) { secEl.value = secId; secEl.dispatchEvent(new Event('change')); }
                                    const subEl = document.getElementById('form-subsection-id');
                                    if(subEl) { subEl.value = subId; }
                                }, 50);
                            }));

                            dynamicMainView.querySelectorAll('.btn-edit-lesson').forEach(btn => btn.addEventListener('click', function() {
                                renderLessonFormModal(this.getAttribute('data-id'));
                            }));

                            dynamicMainView.querySelectorAll('.btn-delete-lesson').forEach(btn => btn.addEventListener('click', async function() {
                                if (!QNS_AUTH.requireTeacher('deleteLesson')) return;
                                if (QNS_AUTH.isBackendConfigured()) { // [T09C] T10C chờ Q10: chưa nối lesson.delete
                                    window.showAppAlert({ type: 'info', title: 'Chưa hỗ trợ', message: 'Xóa bài học chưa được bật trên máy chủ.' });
                                    return;
                                }
                                const id = this.getAttribute('data-id');
                                if (await window.showAppConfirm({ title: 'Xóa Bài học', message: 'Bạn có chắc chắn muốn xóa bài học này không?' })) {
                                    saveStoredLessons(lessons.filter(l => l.id !== id));
                                    renderContentManagementView();
                                }
                            }));
                        }

                    })();
                    // Mở hai hàm này ra phạm vi toàn cục để khối script chi tiết bài học gọi được khi bấm Quay lại
                    window.updateCourseProgress = updateCourseProgress;
                    window.applyCourseFilters = applyCourseFilters;
                    // Khởi tạo tính toán Tiến độ và Lọc bài học ban đầu khi load trang
                    updateCourseProgress();
                    applyCourseFilters();
                });

    (function () {
        'use strict';

        // Biến dùng chung cho toàn bộ khối IIFE (Khai báo trước để API Client và UI truy cập được)
        let currentStudentId = 'Unknown';
        let currentStudentName = 'Học sinh';
        let currentUserRole = 'student'; // Chỉ phục vụ hiển thị giao diện

        // ============================================================
        // LẤY TÀI KHOẢN ĐANG ĐĂNG NHẬP (qua QNS_AUTH.getCurrentUser() – nguồn duy nhất)
        // ============================================================
        function refreshUserHeader() {
        const __authState = QNS_AUTH.getAuthState();
        if (!__authState.hasLocalSession) {
            ['current-user-fullname', 'current-user-student-id'].forEach(function (elId) {
                const el = document.getElementById(elId);
                if (el) el.textContent = 'Chưa đăng nhập';
            });
            console.warn('[QNS_AUTH] ' + __authState.reason);
        } else {
            const currentUser = QNS_AUTH.getCurrentUser();
            if (currentUser) {
                // Cập nhật tên thí sinh
                const fullnameElement = document.getElementById('current-user-fullname');
                if (fullnameElement) {
                    fullnameElement.textContent = currentUser.fullName || currentUser.hoTen || currentUser.name || 'Chưa xác định';
                }

                // Cập nhật mã học sinh
                const studentIdElement = document.getElementById('current-user-student-id');
                currentStudentId = currentUser.userId || currentUser.studentId || currentUser.id || 'Unknown';
                currentStudentName = currentUser.fullName || currentUser.hoTen || currentUser.name || 'Học sinh';
                
                if (studentIdElement) {
                    studentIdElement.textContent = currentStudentId;
                }
            } else {
                console.warn('Không tìm thấy dữ liệu tài khoản hợp lệ từ QNS_AUTH.');
            }
        }
        }
        window.refreshUserHeader = refreshUserHeader;
        refreshUserHeader();

        // ============================================================
        // MODULE PHẢN HỒI THAO TÁC DÙNG CHUNG (QNS_UI)
        // Spinner trực tiếp tại nút + toast góc trên bên phải + khóa chống nhấn lặp theo phạm vi nghiệp vụ + requestId ổn định.
        // Không phụ thuộc thư viện ngoài; CSS tự chèn một lần; mọi nút dùng chung các hàm này.
        // ============================================================
        const QNS_UI = window.QNS_UI = (function () {
            const IDLE_ATTRS = ['data-qns-idle-html', 'data-qns-idle-dis', 'data-qns-idle-aria', 'data-qns-idle-minw'];
            const locks = new Map();        // khóa nghiệp vụ -> token (mỗi khóa độc lập, KHÔNG dùng một biến Boolean toàn cục)
            const toasts = new Map();       // key -> toast đang hiển thị (chống tạo nhiều toast giống nhau)
            const pendingIds = new Map();   // scope -> { fp, id } (requestId ổn định cho thao tác tạo dữ liệu)
            const SLOW_MS = 12000;          // quá ngưỡng này: báo "phản hồi chậm", KHÔNG kết luận thất bại
            let toastHost = null;
            let lastStructureBtn = null;
            let tokenSeq = 0;

            (function injectStyle() {
                if (document.getElementById('qns-ui-style')) return;
                const st = document.createElement('style');
                st.id = 'qns-ui-style';
                st.textContent =
                    '@keyframes qns-spin{to{transform:rotate(360deg)}}' +
                    '@keyframes qns-toast-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}' +
                    '.qns-spinner{display:inline-block;flex:0 0 auto;box-sizing:border-box;width:1em;height:1em;margin-right:8px;vertical-align:-0.15em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:qns-spin .7s linear infinite}' +
                    '.qns-spinner.only{margin-right:0}' +
                    '.qns-btn-busy{cursor:progress!important;opacity:.88;pointer-events:none}' +
                    '#qns-toast-host{position:fixed;top:16px;right:16px;z-index:20000;display:flex;flex-direction:column;gap:10px;width:min(360px,calc(100vw - 24px));pointer-events:none}' +
                    '.qns-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:10px;background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-left:4px solid rgb(21,101,192);border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,.14);padding:11px 12px 11px 14px;font-size:.9rem;line-height:1.4;animation:qns-toast-in .18s ease-out}' +
                    '.qns-toast.success{border-left-color:#16a34a}.qns-toast.error{border-left-color:#dc2626}' +
                    '.qns-toast-icon{flex:0 0 auto;width:1.1em;text-align:center;color:rgb(21,101,192);margin-top:1px}' +
                    '.qns-toast.success .qns-toast-icon{color:#16a34a}.qns-toast.error .qns-toast-icon{color:#dc2626}' +
                    '.qns-toast-icon .qns-spinner{margin-right:0;vertical-align:middle}' +
                    '.qns-toast-msg{flex:1 1 auto;min-width:0;word-break:break-word}' +
                    '.qns-toast-x{flex:0 0 auto;border:0;background:transparent;color:#64748b;font-size:1.1rem;line-height:1;cursor:pointer;padding:0 2px}' +
                    '@media (max-width:600px){#qns-toast-host{right:12px;left:12px;width:auto}}';
                document.head.appendChild(st);
                // Nhớ nút cấu trúc nội dung vừa bấm (để gắn spinner đúng nút dù thao tác đi qua hộp thoại nhập/xác nhận)
                document.addEventListener('click', function (e) {
                    const b = e.target && e.target.closest ? e.target.closest('.btn-teacher-act, #btn-mgmt-add-section') : null;
                    if (b) lastStructureBtn = b;
                }, true);
            })();

            // ---------- Nút: Loading ----------
            function setBusy(btn, label) {
                if (!btn || btn.hasAttribute(IDLE_ATTRS[0])) return;
                btn.setAttribute(IDLE_ATTRS[0], btn.innerHTML);
                btn.setAttribute(IDLE_ATTRS[1], btn.disabled ? '1' : '');
                btn.setAttribute(IDLE_ATTRS[2], btn.hasAttribute('aria-disabled') ? '1' : '');
                btn.setAttribute(IDLE_ATTRS[3], btn.style.minWidth || '');
                const w = btn.getBoundingClientRect().width;
                if (w) btn.style.minWidth = Math.ceil(w) + 'px';   // giữ chiều rộng, nút không co giãn
                const iconOnly = !btn.textContent.trim();
                btn.textContent = '';
                const sp = document.createElement('span');
                sp.className = 'qns-spinner' + ((iconOnly || !label) ? ' only' : '');
                sp.setAttribute('aria-hidden', 'true');
                btn.appendChild(sp);
                if (label && !iconOnly) {
                    const t = document.createElement('span');
                    t.textContent = label;
                    btn.appendChild(t);
                }
                btn.classList.add('qns-btn-busy');
                btn.setAttribute('aria-busy', 'true');
                btn.setAttribute('aria-disabled', 'true');
                if ('disabled' in btn) btn.disabled = true;
            }

            function clearBusy(btn) {
                if (!btn || !btn.hasAttribute(IDLE_ATTRS[0])) return;
                btn.innerHTML = btn.getAttribute(IDLE_ATTRS[0]);
                btn.style.minWidth = btn.getAttribute(IDLE_ATTRS[3]) || '';
                if ('disabled' in btn && btn.getAttribute(IDLE_ATTRS[1]) !== '1') btn.disabled = false;
                if (btn.getAttribute(IDLE_ATTRS[2]) !== '1') btn.removeAttribute('aria-disabled');
                btn.classList.remove('qns-btn-busy');
                btn.removeAttribute('aria-busy');
                IDLE_ATTRS.forEach(function (a) { btn.removeAttribute(a); });
            }

            function lockPeer(el) {
                if (!el || el.hasAttribute('data-qns-peer')) return;
                el.setAttribute('data-qns-peer', el.disabled ? '1' : '');
                if ('disabled' in el) el.disabled = true;
            }
            function unlockPeer(el) {
                if (!el || !el.hasAttribute('data-qns-peer')) return;
                if ('disabled' in el && el.getAttribute('data-qns-peer') !== '1') el.disabled = false;
                el.removeAttribute('data-qns-peer');
            }

            // Bản chụp HTML luôn ở trạng thái nút BÌNH THƯỜNG (dùng khi lưu lại danh sách để quay về)
            function snapshotHtml(container) {
                if (!container) return '';
                if (!container.querySelector('[' + IDLE_ATTRS[0] + ']')) return container.innerHTML;
                const clone = container.cloneNode(true);
                clone.querySelectorAll('[' + IDLE_ATTRS[0] + ']').forEach(clearBusy);
                return clone.innerHTML;
            }

            // ---------- Toast ----------
            function hostEl() {
                if (!toastHost) {
                    toastHost = document.createElement('div');
                    toastHost.id = 'qns-toast-host';
                    document.body.appendChild(toastHost);
                }
                const hdr = document.querySelector('header.status-bar');
                const top = hdr ? Math.max(0, hdr.getBoundingClientRect().bottom) + 12 : 16;   // không che thanh trạng thái
                toastHost.style.top = top + 'px';
                return toastHost;
            }
            function paintToast(entry, type, message, duration) {
                entry.el.className = 'qns-toast ' + type;
                entry.el.setAttribute('role', type === 'error' ? 'alert' : 'status');
                entry.icon.textContent = '';
                if (type === 'loading') {
                    const sp = document.createElement('span');
                    sp.className = 'qns-spinner';
                    sp.setAttribute('aria-hidden', 'true');
                    entry.icon.appendChild(sp);
                } else {
                    const i = document.createElement('i');
                    i.className = 'fa-solid ' + (type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'));
                    entry.icon.appendChild(i);
                }
                entry.msg.textContent = message || '';
                clearTimeout(entry.timer);
                const ms = duration !== undefined ? duration : (type === 'success' ? 3000 : (type === 'error' ? 8000 : (type === 'info' ? 4000 : 0)));
                if (ms > 0) entry.timer = setTimeout(function () { closeToast(entry); }, ms);
            }
            function closeToast(entry) {
                if (!entry) return;
                clearTimeout(entry.timer);
                if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
                if (entry.key && toasts.get(entry.key) === entry) toasts.delete(entry.key);
            }
            function toast(opts) {
                opts = opts || {};
                const host = hostEl();
                let entry = opts.key ? toasts.get(opts.key) : null;
                if (!entry || !entry.el.parentNode) {
                    const el = document.createElement('div');
                    const icon = document.createElement('span');
                    icon.className = 'qns-toast-icon';
                    const msg = document.createElement('span');
                    msg.className = 'qns-toast-msg';
                    const x = document.createElement('button');
                    x.type = 'button';
                    x.className = 'qns-toast-x';
                    x.setAttribute('aria-label', 'Đóng thông báo');
                    x.textContent = '\u00d7';
                    el.appendChild(icon); el.appendChild(msg); el.appendChild(x);
                    host.appendChild(el);
                    entry = { el: el, icon: icon, msg: msg, timer: null, key: opts.key || null };
                    x.addEventListener('click', function () { closeToast(entry); });
                    if (entry.key) toasts.set(entry.key, entry);
                    while (host.children.length > 4) {   // tối đa 4 toast, bỏ toast cũ nhất không phải Loading
                        const old = Array.prototype.find.call(host.children, function (c) { return !c.classList.contains('loading'); });
                        if (!old) break;
                        host.removeChild(old);
                    }
                }
                paintToast(entry, opts.type || 'info', opts.message, opts.duration);
                return {
                    update: function (type, message, duration) { paintToast(entry, type, message, duration); },
                    close: function () { closeToast(entry); }
                };
            }

            // ---------- Vòng đời một thao tác ----------
            // begin(): trả null nếu cùng khóa đang chạy (nhấn lặp bị bỏ qua). Ngược lại trả handle { end, succeed, fail }.
            function begin(opts) {
                opts = opts || {};
                const key = opts.key || '';
                if (key && locks.has(key)) {
                    if (!opts.silentBusy) toast({ type: 'info', key: 'busy:' + key, message: opts.busyMessage || 'Thao tác đang được xử lý, vui lòng chờ...', duration: 2500 });
                    return null;
                }
                const token = ++tokenSeq;
                if (key) locks.set(key, token);
                const btn = opts.btn || null;
                const peers = (opts.peers || []).filter(Boolean);
                setBusy(btn, opts.label);
                peers.forEach(lockPeer);
                let tHandle = null, slowTimer = null, forceTimer = null, released = false;
                const tcfg = opts.toast || {};
                if (tcfg.loading) {
                    tHandle = toast({ type: 'loading', key: key ? 'op:' + key : '', message: tcfg.loading });
                    slowTimer = setTimeout(function () {
                        if (!released && tHandle) tHandle.update('loading', tcfg.slow || 'Hệ thống phản hồi chậm, vui lòng chờ và KHÔNG nhấn lại...');
                    }, SLOW_MS);
                }
                function release() {
                    if (released) return;
                    released = true;
                    clearTimeout(slowTimer); clearTimeout(forceTimer);
                    if (key && locks.get(key) === token) locks.delete(key);
                    clearBusy(btn);
                    peers.forEach(unlockPeer);
                }
                // Chỉ thao tác TẠO có requestId (an toàn gửi lại) mới được tự mở khóa sau khi chờ quá lâu
                if (opts.safeRetryAfterMs) {
                    forceTimer = setTimeout(function () {
                        if (released) return;
                        release();
                        toast({ type: 'info', key: 'op:' + key, duration: 9000, message: 'Chưa nhận được phản hồi từ máy chủ. Bạn có thể thử lại: hệ thống sẽ đối soát và không tạo bản ghi trùng.' });
                    }, opts.safeRetryAfterMs);
                }
                function finish(type, msg) {
                    release();
                    if (type && msg) {
                        if (tHandle) tHandle.update(type, msg); else toast({ type: type, message: msg });
                    } else if (tHandle) {
                        tHandle.close();
                    }
                }
                return {
                    end: function () { finish(null); },
                    succeed: function (msg) { finish('success', msg); },
                    fail: function (msg) { finish('error', msg); }
                };
            }

            function failText(err, base) {
                base = base || 'Thao tác không thành công.';
                if (err && (err.isNetworkError || err.code === 'NETWORK_ERROR')) return base + ' Mất kết nối nên chưa xác định được kết quả.';
                return base + (err && err.message ? ' ' + err.message : '');
            }

            // run(): tiện ích cho thao tác bất đồng bộ đơn giản (try/catch/finally đầy đủ, không bao giờ để nút khóa vĩnh viễn)
            async function run(opts, fn) {
                opts = opts || {};
                const op = begin(opts);
                if (!op) return { ok: false, busy: true };
                const tcfg = opts.toast || {};
                try {
                    const value = await fn(op);
                    if (opts.requireTrue && value !== true) { op.end(); return { ok: false, handled: true, value: value }; }
                    if (tcfg.success) op.succeed(tcfg.success); else op.end();
                    return { ok: true, value: value };
                } catch (err) {
                    console.error('[QNS_UI] Thao tác lỗi:', err);
                    if (err && err.code === 'UNAUTHENTICATED') { op.end(); return { ok: false, error: err, handled: true }; }
                    op.fail(failText(err, tcfg.error));
                    return { ok: false, error: err };
                }
            }

            // requestId ổn định: cùng thao tác + cùng nội dung => cùng requestId (gửi lại sau lỗi mạng không tạo bản ghi trùng)
            function requestId(scope, fingerprint) {
                const cur = pendingIds.get(scope);
                if (cur && cur.fp === fingerprint) return cur.id;
                const id = 'req_' + String(scope).replace(/[^a-z0-9]/gi, '').slice(0, 12) + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
                pendingIds.set(scope, { fp: fingerprint, id: id });
                return id;
            }
            function clearRequestId(scope) { pendingIds.delete(scope); }

            return {
                toast: toast,
                begin: begin,
                run: run,
                failText: failText,
                requestId: requestId,
                clearRequestId: clearRequestId,
                snapshotHtml: snapshotHtml,
                isLocked: function (key) { return locks.has(key); },
                structureTrigger: function () { return (lastStructureBtn && document.body.contains(lastStructureBtn)) ? lastStructureBtn : null; }
            };
        })();

        // ============================================================
        // LỚP GIAO TIẾP DỮ LIỆU TẬP TRUNG (API CLIENT)
        // ============================================================
        const API = window.API = {
            async request(action, payload = {}) {
                // Không bao giờ gửi vai trò do trình duyệt tự khai báo (máy chủ tự xác định từ phiên đăng nhập)
                payload = Object.assign({}, payload);
                ['role', 'userRole', 'currentRole'].forEach(function (k) { delete payload[k]; });
                // [MULTI-COURSE] courseId do QNS_COURSE (khai báo trong HTML) quyết định; payload không được ghi đè.
                delete payload.courseId;
                if (payload.payload && typeof payload.payload === 'object') {
                    payload.payload = Object.assign({}, payload.payload);
                    delete payload.payload.courseId;
                }
                let scopedCourseId = '';
                if (QNS_COURSE.isCourseScopedAction(action)) {
                    if (!QNS_COURSE.isValid()) {
                        throw QNS_AUTH.createApiError({ code: 'COURSE_CONFIG_INVALID', message: QNS_COURSE.getError() });
                    }
                    scopedCourseId = QNS_COURSE.getId();
                }
                // [L4] Phiên đã bị vô hiệu: dừng mọi request nghiệp vụ, không gọi mạng nữa
                if (QNS_AUTH.isSessionInvalidated()) {
                    throw QNS_AUTH.createApiError({ code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập đã hết hạn.' });
                }
                // Tự đính kèm token phiên nếu chưa có. Máy chủ xác định người dùng và vai trò từ token, không từ dữ liệu trình duyệt.
                if (!payload.token) {
                    const sessionToken = QNS_AUTH.getToken();
                    if (sessionToken) payload.token = sessionToken;
                }
                if (!isApiBaseUrlConfigured()) {
                    console.warn('API_BASE_URL chưa cấu hình. Đang chạy chế độ Local (Mô phỏng).');
                    return this.mockStorage(action, payload);
                }
                try {
                    const response = await fetch(API_BASE_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        // [BACKEND-TODO] KHÔNG gửi role. Máy chủ phải tự xác định người dùng và quyền từ phiên/token đã xác thực,
                        // không tin studentId hay vai trò do trình duyệt gửi lên.
                        body: JSON.stringify(Object.assign({ action, studentId: currentStudentId }, payload, scopedCourseId ? { courseId: scopedCourseId } : {}))
                    });
                    const result = await response.json();
                    if (!result.success) {
                        throw QNS_AUTH.createApiError({
                            code: result.code,
                            message: result.message || 'Lỗi hệ thống',
                            data: result.data,
                            status: response.status,
                            retryable: result.retryable
                        });
                    }
                    
                    // Tự động chuẩn hóa trường Type cho dữ liệu bài học trả về từ Google Sheets
                    if (Array.isArray(result.data)) {
                        result.data.forEach(item => {
                            if (item.type || item.Type || item.loaiBaiHoc) {
                                item.type = normalizeLessonType(item.type || item.Type || item.loaiBaiHoc);
                            }
                        });
                    }
                    return result.data;
                } catch (err) {
                    if (err && !err.code) { err.code = 'NETWORK_ERROR'; err.isNetworkError = true; } // fetch/parse lỗi: KHÔNG đồng nghĩa hết phiên
                    if (err && err.code === 'UNAUTHENTICATED') QNS_AUTH.handleUnauthenticated(err.message); // chỉ chạy một lần
                    console.error(`API Error [${action}]:`, err);
                    // ADR-10: Backend đã cấu hình thì không rơi về mock, báo lỗi thật cho giao diện
                    throw err;
                    return this.mockStorage(action, payload);
                }
            },
            // Chế độ mô phỏng lưu vào LocalStorage nếu chưa có Google Apps Script thực tế
            mockStorage(action, payload) {
                if (action === 'getSubmission') {
                    const subs = JSON.parse(localStorage.getItem(QNS_COURSE.storageKey('qns_mock_subs')) || '{}');
                    return subs[payload.lessonId + '_' + currentStudentId] || null;
                }
                if (action === 'saveSubmission') {
                    let subs = JSON.parse(localStorage.getItem(QNS_COURSE.storageKey('qns_mock_subs')) || '{}');
                    subs[payload.lessonId + '_' + currentStudentId] = payload;
                    localStorage.setItem(QNS_COURSE.storageKey('qns_mock_subs'), JSON.stringify(subs));
                    return true;
                }
                return null;
            }
        };

        

        // ============================================================
        // CẤU HÌNH TẬP TRUNG: LOẠI TỆP ĐÍNH KÈM / TÀI NGUYÊN (9 LOẠI CHUẨN)
        // ============================================================
        const ATTACHMENT_TYPE_CONFIG = {
            pdf: {
                id: "pdf",
                name: "Tài liệu PDF",
                icon: "fa-file-pdf",
                iconColor: "#dc2626",
                backgroundColor: "#fee2e2",
                cssClass: "attachment-type-pdf"
            },
            word: {
                id: "word",
                name: "Tài liệu Word",
                icon: "fa-file-word",
                iconColor: "#2563eb",
                backgroundColor: "#dbeafe",
                cssClass: "attachment-type-word"
            },
            excel: {
                id: "excel",
                name: "Bảng tính Excel",
                icon: "fa-file-excel",
                iconColor: "#16a34a",
                backgroundColor: "#dcfce7",
                cssClass: "attachment-type-excel"
            },
            powerpoint: {
                id: "powerpoint",
                name: "Slide PowerPoint",
                icon: "fa-file-powerpoint",
                iconColor: "#ea580c",
                backgroundColor: "#ffedd5",
                cssClass: "attachment-type-powerpoint"
            },
            archive: {
                id: "archive",
                name: "Tệp nén ZIP/RAR",
                icon: "fa-file-zipper",
                iconColor: "#ca8a04",
                backgroundColor: "#fef9c3",
                cssClass: "attachment-type-archive"
            },
            form: {
                id: "form",
                name: "Biểu mẫu Google Forms",
                icon: "fa-clipboard-list",
                iconColor: "#9333ea",
                backgroundColor: "#f3e8ff",
                cssClass: "attachment-type-form"
            },
            link: {
                id: "link",
                name: "Liên kết bên ngoài",
                icon: "fa-link",
                iconColor: "#0d9488",
                backgroundColor: "#ccfbf1",
                cssClass: "attachment-type-link"
            },
            image: {
                id: "image",
                name: "Hình ảnh",
                icon: "fa-file-image",
                iconColor: "#db2777",
                backgroundColor: "#fce7f3",
                cssClass: "attachment-type-image"
            },
            video: {
                id: "video",
                name: "Video clip",
                icon: "fa-file-video",
                iconColor: "#4f46e5",
                backgroundColor: "#e0e7ff",
                cssClass: "attachment-type-video"
            },
            audio: {
                id: "audio",
                name: "Tệp âm thanh",
                icon: "fa-file-audio",
                iconColor: "#0284c7",
                backgroundColor: "#e0f2fe",
                cssClass: "attachment-type-audio"
            },
            document: {
                id: "document",
                name: "Tài liệu chung",
                icon: "fa-file-lines",
                iconColor: "#0284c7",
                backgroundColor: "#e0f2fe",
                cssClass: "attachment-type-document"
            },
            other: {
                id: "other",
                name: "Tài liệu khác",
                icon: "fa-file-lines",
                iconColor: "#64748b",
                backgroundColor: "#f1f5f9",
                cssClass: "attachment-type-other"
            }
        };

        // Hàm lấy cấu hình tệp đính kèm trực tiếp từ giá trị được khai báo
        function getAttachmentTypeConfig(attachmentType) {
            if (!attachmentType) return ATTACHMENT_TYPE_CONFIG.other;
            const key = String(attachmentType).trim().toLowerCase();
            return ATTACHMENT_TYPE_CONFIG[key] || ATTACHMENT_TYPE_CONFIG.other;
        }

        // ============================================================
        // CẤU HÌNH TẬP TRUNG: BIỂU TƯỢNG LOẠI BÀI HỌC (8 LOẠI CHUẨN)
        // ============================================================
        const LESSON_TYPE_CONFIG = {
            lesson: {
                id: "lesson",
                name: "Buổi học",
                icon: "fa-video",
                iconColor: "#0284c7",
                backgroundColor: "#e0f2fe",
                cssClass: "lesson-type-lesson"
            },
            pdf: {
                id: "pdf",
                name: "Tài liệu (.pdf)",
                icon: "fa-file-pdf",
                iconColor: "#dc2626",
                backgroundColor: "#fee2e2",
                cssClass: "lesson-type-pdf"
            },
            test: {
                id: "test",
                name: "Bài kiểm tra",
                icon: "fa-file-circle-question",
                iconColor: "#d97706",
                backgroundColor: "#fef3c7",
                cssClass: "lesson-type-test"
            },
            assignment: {
                id: "assignment",
                name: "Bài tập nộp file",
                icon: "fa-file-arrow-up",
                iconColor: "#059669",
                backgroundColor: "#d1fae5",
                cssClass: "lesson-type-assignment"
            },
            video: {
                id: "video",
                name: "Video ghi sẵn",
                icon: "fa-circle-play",
                iconColor: "#4f46e5",
                backgroundColor: "#e0e7ff",
                cssClass: "lesson-type-video"
            },
            survey: {
                id: "survey",
                name: "Khảo sát & Phản hồi",
                icon: "fa-square-poll-vertical",
                iconColor: "#c026d3",
                backgroundColor: "#fae8ff",
                cssClass: "lesson-type-survey"
            },
            link: {
                id: "link",
                name: "Liên kết tham khảo",
                icon: "fa-link",
                iconColor: "#0d9488",
                backgroundColor: "#ccfbf1",
                cssClass: "lesson-type-link"
            },
            forum: {
                id: "forum",
                name: "Diễn đàn thảo luận",
                icon: "fa-comments",
                iconColor: "#e11d48",
                backgroundColor: "#ffe4e6",
                cssClass: "lesson-type-forum"
            },
            document: {
                id: "document",
                name: "Tài liệu chung",
                icon: "fa-file-lines",
                iconColor: "#0284c7",
                backgroundColor: "#e0f2fe",
                cssClass: "lesson-type-document"
            },
            default: {
                id: "default",
                name: "Nội dung học tập",
                icon: "fa-file-lines",
                iconColor: "#0284c7",
                backgroundColor: "#e0f2fe",
                cssClass: "lesson-type-default"
            }
        };

        // Nhận diện nhóm Office: ưu tiên MIME đầy đủ (so khớp CHÍNH XÁC, không dùng includes chung);
        // nếu MIME rỗng/chung chung/không có trong bảng thì dùng phần mở rộng tệp làm dự phòng.
        // Trả về 'word' | 'excel' | 'csv' | 'powerpoint' | null. Mỗi tệp chỉ thuộc tối đa MỘT nhóm.
        function detectOfficeKind(mimeType, extension) {
            const MIME_MAP = {
                'application/msword': 'word',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
                'application/vnd.ms-word.document.macroenabled.12': 'word',
                'application/vnd.ms-excel': 'excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
                'application/vnd.ms-excel.sheet.macroenabled.12': 'excel',
                'text/csv': 'csv',
                'application/csv': 'csv',
                'application/vnd.ms-powerpoint': 'powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
                'application/vnd.ms-powerpoint.presentation.macroenabled.12': 'powerpoint',
                // Tương thích bản ghi bài nộp cũ: trường type đã lưu là id loại tệp, không phải MIME
                'word': 'word',
                'excel': 'excel',
                'powerpoint': 'powerpoint'
            };
            const EXT_MAP = {
                '.doc': 'word', '.docx': 'word',
                '.xls': 'excel', '.xlsx': 'excel',
                '.csv': 'csv',
                '.ppt': 'powerpoint', '.pptx': 'powerpoint'
            };
            const mime = String(mimeType || '').toLowerCase().split(';')[0].trim();
            if (mime && Object.prototype.hasOwnProperty.call(MIME_MAP, mime)) return MIME_MAP[mime];
            const ext = String(extension || '').toLowerCase();
            if (ext && Object.prototype.hasOwnProperty.call(EXT_MAP, ext)) return EXT_MAP[ext];
            return null;
        }

        // Hàm nhận diện định dạng tệp tập trung cho học sinh tải lên (getUploadedFileType)
        function getUploadedFileType(file) {
            if (!file) return ATTACHMENT_TYPE_CONFIG.other;
            
            const fileName = (file.name || "").toLowerCase();
            const fileType = (file.type || "").toLowerCase();
            const rawExtension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
            // [LỖI 19] formatName được suy ra từ phần mở rộng nên chỉ chấp nhận chữ và số
            const extension = /^\.[a-z0-9]{1,10}$/.test(rawExtension) ? rawExtension : '';
            const officeKind = detectOfficeKind(fileType, extension);

            // 0. Nhận diện Tệp nén (Archive: ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ)
            if (!officeKind && (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(extension) || fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar') || fileType.includes('compressed') || fileType.includes('archive'))) {
                let archiveFormat = extension ? extension.replace('.', '').toUpperCase() : 'ZIP';
                return { ...ATTACHMENT_TYPE_CONFIG.archive, formatName: archiveFormat, sizeStr: formatFileSize(file.size) };
            }

            // 1. Nhận diện PDF
            if (extension === '.pdf' || fileType === 'application/pdf') {
                return { ...ATTACHMENT_TYPE_CONFIG.pdf, formatName: 'PDF', sizeStr: formatFileSize(file.size) };
            }

            // 2. Nhận diện Word
            if (officeKind === 'word') {
                const extName = extension === '.doc' ? 'DOC' : 'DOCX';
                return { ...ATTACHMENT_TYPE_CONFIG.word, formatName: extName, sizeStr: formatFileSize(file.size) };
            }

            // 3. Nhận diện Excel
            if (officeKind === 'excel' || officeKind === 'csv') {
                const extName = extension === '.csv' ? 'CSV' : (extension === '.xls' ? 'XLS' : 'XLSX');
                return { ...ATTACHMENT_TYPE_CONFIG.excel, formatName: extName, sizeStr: formatFileSize(file.size) };
            }

            // 4. Nhận diện PowerPoint
            if (officeKind === 'powerpoint') {
                const extName = extension === '.ppt' ? 'PPT' : 'PPTX';
                return { ...ATTACHMENT_TYPE_CONFIG.powerpoint, formatName: extName, sizeStr: formatFileSize(file.size) };
            }

            // 5. Nhận diện Video
            if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(extension) || fileType.startsWith('video/')) {
                return { ...ATTACHMENT_TYPE_CONFIG.video, formatName: extension ? extension.replace('.', '').toUpperCase() : 'VIDEO', sizeStr: formatFileSize(file.size) };
            }

            // 6. Nhận diện Ảnh – Loại thứ 10 mới bổ sung (PNG, JPG, JPEG, GIF, WEBP, SVG, v.v.)
            if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.tif', '.tiff', '.heic', '.heif'].includes(extension) || fileType.startsWith('image/')) {
                let imgFormat = extension ? extension.replace('.', '').toUpperCase() : 'IMG';
                if (imgFormat === 'JPEG') imgFormat = 'JPG';
                return { ...ATTACHMENT_TYPE_CONFIG.image, formatName: imgFormat, sizeStr: formatFileSize(file.size) };
            }

            // 7. Các định dạng còn lại
            return { ...ATTACHMENT_TYPE_CONFIG.other, formatName: extension ? extension.replace('.', '').toUpperCase() : 'FILE', sizeStr: formatFileSize(file.size) };
        }

        // Hàm phụ trợ định dạng dung lượng tệp
        function formatFileSize(bytes) {
            if (!bytes || bytes === 0) return '0 KB';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        // ============================================================
        // [LỖI 18] METADATA TỆP BÀI NỘP & ĐIỂM TÍCH HỢP BACKEND
        // Phân biệt: (1) tệp mới chọn trên thiết bị  (2) tệp đã tải lên hệ thống lưu trữ
        // (3) tệp đã có fileId + url do Backend trả về. Frontend KHÔNG tự tạo fileId/url.
        // ============================================================
        function escapeSubmissionText(value) {
            return String(value === undefined || value === null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // URL hợp lệ: chuỗi http(s) thật. Loại '#', rỗng, null, javascript:...
        function isValidFileUrl(url) {
            if (typeof url !== 'string') return false;
            const trimmed = url.trim();
            if (!trimmed || trimmed === '#') return false;
            try {
                const parsed = new URL(trimmed);
                return parsed.protocol === 'https:' || parsed.protocol === 'http:';
            } catch (e) {
                return false;
            }
        }

        // Tạo metadata cho tệp vừa được chọn. Chưa có xác nhận từ hệ thống lưu trữ nên luôn là 'pending'.
        function buildSubmissionFileMetadata(file) {
            const ft = getUploadedFileType(file);
            return {
                name: file.name,
                size: file.size,
                type: ft.id,
                formatName: ft.formatName,
                mimeType: file.type || '',
                sizeStr: ft.sizeStr,
                icon: ft.icon,
                cssClass: ft.cssClass,
                storageProvider: null,
                fileId: null,
                url: null,
                uploadStatus: 'pending',
                uploadedAt: null
            };
        }

        // Chuẩn hóa mọi bản ghi tệp (kể cả dữ liệu cũ có url: '#'). Chỉ coi là 'uploaded'
        // khi uploadStatus === 'uploaded' VÀ có URL hợp lệ. Không làm mất tên, dung lượng, định dạng.
        function normalizeSubmissionFile(rawFile) {
            const base = rawFile || {};
            const cfg = getUploadedFileType({ name: base.name || '', type: base.mimeType || base.type || '', size: base.size || 0 });
            const confirmed = base.uploadStatus === 'uploaded' && base.fileId;
            return Object.assign({}, base, {
                name: base.name || 'Tệp không tên',
                size: base.size || 0,
                type: base.type || cfg.id,
                formatName: base.formatName || cfg.formatName,
                mimeType: base.mimeType || '',
                sizeStr: base.sizeStr || cfg.sizeStr,
                icon: base.icon || cfg.icon,
                cssClass: base.cssClass || cfg.cssClass,
                storageProvider: confirmed ? (base.storageProvider || null) : null,
                fileId: confirmed ? (base.fileId || null) : null,
                url: confirmed ? (base.url || ('#download-' + base.fileId)) : null,
                uploadStatus: confirmed ? 'uploaded' : 'pending',
                uploadedAt: confirmed ? (base.uploadedAt || null) : null
            });
        }

        function renderSubmissionFileItemHtml(rawFile) {
            const file = normalizeSubmissionFile(rawFile);
            const nameHtml = escapeSubmissionText(file.name);
            const infoHtml = escapeSubmissionText(file.formatName) + ' · ' + escapeSubmissionText(file.sizeStr);
            if (file.uploadStatus === 'uploaded' && file.fileId) {
                return `<a href="#" data-qns-download="1" data-file-id="${escapeSubmissionText(file.fileId)}" data-file-name="${escapeSubmissionText(file.name)}" class="submission-file-link" title="${infoHtml}"><i class="fa-solid fa-file-arrow-down"></i> ${nameHtml} <small>(${infoHtml})</small></a>`;
            }
            return `<span class="submission-file-link" style="cursor: default; background: #f1f5f9; color: #64748b;" title="Tệp chưa có trên hệ thống lưu trữ"><i class="fa-solid fa-file"></i> ${nameHtml} <small>(${infoHtml} · chưa có tệp trên hệ thống lưu trữ)</small></span>`;
        }

        function applyUploadResultsToMetadata(metaList, results) {
            if (!Array.isArray(results)) return metaList;
            return metaList.map(function (meta, index) {
                const r = results[index];
                if (r && r.fileId) {
                    return Object.assign({}, meta, {
                        storageProvider: r.storageProvider || null,
                        fileId: String(r.fileId),
                        url: r.url ? r.url.trim() : null,
                        mimeType: r.mimeType || meta.mimeType,
                        uploadStatus: 'uploaded',
                        uploadedAt: r.uploadedAt || new Date().toISOString()
                    });
                }
                return meta;
            });
        }

        // [P1] Thử lại có kiểm soát: chỉ lỗi tạm thời. chunk/finish idempotent nên được thử lại cả lỗi mạng; begin chỉ thử lại khi máy chủ báo bận
        window.qnsRequestWithRetry = async function (action, payload, maxTries, retryNetwork) {
            let lastErr = null;
            for (let attempt = 1; attempt <= maxTries; attempt++) {
                try {
                    return await API.request(action, payload);
                } catch (err) {
                    lastErr = err;
                    const code = err && err.code;
                    const transient = !!err && (err.retryable === true || code === 'SERVER_BUSY' ||
                        (retryNetwork === true && (code === 'NETWORK_ERROR' || code === 'INTERNAL')));
                    if (!transient || attempt === maxTries) throw err;
                    await new Promise(function (resolve) { setTimeout(resolve, 1000 * attempt); });
                }
            }
            throw lastErr;
        };

        window.uploadSubmissionFilesToBackend = async function (files, context) {
            if (!QNS_AUTH.isBackendConfigured()) return { ok: false, reason: 'backend-not-configured', files: [] };
            const list = Array.from(files || []);
            const lessonId = context.lessonId;
            const results = new Array(list.length).fill(null);

            // (1) Lần nộp trước (cùng requestId) đã được máy chủ xử lý xong nhưng trình duyệt không nhận được phản hồi
            if (context.requestId) {
                try {
                    const st = await API.request('submission.status', { lessonId: lessonId, requestId: context.requestId });
                    const prev = (st && st.found && st.result && st.result.success) ? st.result.data : null;
                    if (prev && Array.isArray(prev.files)) {
                        const usedSrv = new Set();
                        const aligned = list.map(function (f) {
                            const idx = prev.files.findIndex(function (s, i) { return !usedSrv.has(i) && s.name === f.name && Number(s.sizeBytes) === f.size; });
                            if (idx < 0) return null;
                            usedSrv.add(idx);
                            return prev.files[idx];
                        });
                        if (aligned.length > 0 && aligned.every(Boolean)) return { ok: true, files: aligned, replay: true };
                    }
                } catch (e) {
                    if (e && e.code === 'UNAUTHENTICATED') return { ok: false, reason: e.message, files: [] };
                }
            }

            // (2) Dùng lại tệp đã tải lên thành công ở lần thử trước (cùng tên + dung lượng, trong 3 giờ gần nhất)
            try {
                const sr = await API.request('upload.listStaged', { lessonId: lessonId });
                const staged = (sr && Array.isArray(sr.files)) ? sr.files : [];
                const usedStaged = new Set();
                list.forEach(function (f, i) {
                    const idx = staged.findIndex(function (s, j) { return !usedStaged.has(j) && s.name === f.name && Number(s.sizeBytes) === f.size; });
                    if (idx >= 0) { usedStaged.add(idx); results[i] = staged[idx]; }
                });
            } catch (e) {
                if (e && e.code === 'UNAUTHENTICATED') return { ok: false, reason: e.message, files: [] };
            }

            // (3) Tải các tệp còn lại; tệp đã xong KHÔNG bị mất khi tệp sau lỗi
            for (let i = 0; i < list.length; i++) {
                if (results[i]) continue;
                const file = list[i];
                try {
                    const fileBase64 = await new Promise(function (resolve, reject) {
                        const reader = new FileReader();
                        reader.onload = function () { resolve(reader.result); };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    const base64Data = String(fileBase64).split(';base64,')[1] || '';
                    if (!base64Data) throw new Error('Không đọc được nội dung tệp "' + file.name + '".');
                    const chunkSize = 1024 * 1024;
                    const expectedChunks = Math.ceil(base64Data.length / chunkSize);
                    const formatName = getUploadedFileType(file).formatName;

                    const beginRes = await window.qnsRequestWithRetry('upload.begin', {
                        lessonId: lessonId, fileName: file.name, fileSize: file.size,
                        mimeType: file.type, formatName: formatName, expectedChunks: expectedChunks
                    }, 2, false);
                    if (!beginRes || !beginRes.uploadId) throw new Error('Không thể khởi tạo phiên kết nối upload.');

                    for (let c = 0; c < expectedChunks; c++) {
                        const chunkRes = await window.qnsRequestWithRetry('upload.chunk', {
                            uploadId: beginRes.uploadId, chunkIndex: c,
                            data: base64Data.substring(c * chunkSize, (c + 1) * chunkSize)
                        }, 4, true);
                        if (!chunkRes || !chunkRes.received) throw new Error('Máy chủ không xác nhận phần ' + (c + 1) + '/' + expectedChunks + ' của tệp "' + file.name + '".');
                    }

                    const finishRes = await window.qnsRequestWithRetry('upload.finish', {
                        uploadId: beginRes.uploadId, fileName: file.name, mimeType: file.type, formatName: formatName
                    }, 3, true);
                    if (!finishRes || !finishRes.fileId) throw new Error('Thao tác chốt Metadata Upload thất bại.');
                    results[i] = finishRes;
                } catch (err) {
                    console.error('Lỗi upload file', file.name, err);
                    return { ok: false, reason: (err && err.message) ? err.message : 'Lỗi upload', files: results.filter(Boolean), failedFile: file.name };
                }
            }
            return { ok: true, files: results };
        };

        window.uploadSubmissionFilesToBackend_V1_DISABLED = async function (files, context) {
            if (!QNS_AUTH.isBackendConfigured()) return { ok: false, reason: 'backend-not-configured', files: [] };
            let results = [];
            for (let file of files) {
                try {
                    let fileBase64 = await new Promise((resolve, reject) => {
                        let reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    let base64Data = fileBase64.split(';base64,')[1];
                    let chunkSize = 1024 * 1024;
                    let expectedChunks = Math.ceil(base64Data.length / chunkSize);

                    let beginRes = await API.request('upload.begin', {
                        lessonId: context.lessonId,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.type,
                        formatName: getUploadedFileType(file).formatName,
                        expectedChunks: expectedChunks
                    });
                    
                    if (!beginRes || !beginRes.uploadId) throw new Error("Không thể khởi tạo phiên kết nối upload.");
                    
                    for (let i = 0; i < expectedChunks; i++) {
                        let chunk = base64Data.substring(i * chunkSize, (i + 1) * chunkSize);
                        let success = false;
                        for (let retry = 0; retry < 3; retry++) {
                            let chunkRes = await API.request('upload.chunk', {
                                uploadId: beginRes.uploadId,
                                chunkIndex: i,
                                data: chunk
                            });
                            if (chunkRes && chunkRes.received) {
                                success = true;
                                break;
                            }
                        }
                        if (!success) throw new Error("Gửi dữ liệu thất bại tại Payload phần " + (i + 1));
                    }
                    
                    let finishRes = await API.request('upload.finish', {
                        uploadId: beginRes.uploadId,
                        fileName: file.name,
                        mimeType: file.type,
                        formatName: getUploadedFileType(file).formatName
                    });
                    if (!finishRes || !finishRes.fileId) throw new Error("Thao tác chốt Metadata Upload thất bại.");
                    
                    results.push(finishRes);
                } catch (err) {
                    console.error("Lỗi upload file", file.name, err);
                    return { ok: false, reason: err.message, files: [] };
                }
            }
            return { ok: true, files: results };
        };

        // [T21] requestId ổn định cho cùng một thao tác nộp (lessonId + tệp trên máy + ghi chú); không phụ thuộc fileId do máy chủ cấp
        window.qnsSubmitPending = null;
        window.qnsGetSubmitRequestId = function (lessonId, localFiles, note) {
            const key = [
                lessonId,
                (localFiles || []).map(function (f) { return f.name + ':' + f.size + ':' + (f.lastModified || 0); }).sort().join(','),
                note || ''
            ].join('|');
            if (!window.qnsSubmitPending || window.qnsSubmitPending.key !== key) {
                window.qnsSubmitPending = { key: key, requestId: 'req_sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10) };
            }
            return window.qnsSubmitPending.requestId;
        };
        window.qnsClearSubmitRequestId = function () { window.qnsSubmitPending = null; };

        // [T24] Tải tệp qua data-attribute + trình nghe chung, KHÔNG đưa dữ liệu người dùng vào chuỗi JS của onclick
        // (HTML-escape không bảo vệ trong ngữ cảnh JS: trình duyệt giải mã &#39; thành dấu nháy trước khi chạy JS).
        if (!window.qnsDownloadDelegated) {
            window.qnsDownloadDelegated = true;
            document.addEventListener('click', function (ev) {
                const el = ev.target && ev.target.closest ? ev.target.closest('[data-qns-download]') : null;
                if (!el) return;
                ev.preventDefault();
                window.downloadQNSFile(el.getAttribute('data-file-id') || '', el.getAttribute('data-file-name') || '');
            });
        }

        window.downloadQNSFile = async function(fileId, fileName) {
            const dlOp = QNS_UI.begin({
                key: 'file.download:' + fileId,
                toast: { loading: 'Đang tải tệp' + (fileName ? ' "' + fileName + '"' : '') + '...', slow: 'Tệp có dung lượng lớn nên cần thêm thời gian, vui lòng chờ...' },
                busyMessage: 'Tệp này đang được tải, vui lòng chờ...'
            });
            if (!dlOp) return;
            try {
                let res = await API.request('file.getDownload', { fileId: fileId });
                if (!res || !res.base64Data) throw new Error("Không lấy được dữ liệu nhị phân của tệp.");
                
                let binary = atob(res.base64Data);
                let array = new Uint8Array(binary.length);
                for(let i = 0; i < binary.length; i++) {
                    array[i] = binary.charCodeAt(i);
                }
                let blob = new Blob([array], {type: res.mimeType || 'application/octet-stream'});
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a');
                a.href = url;
                a.download = fileName || 'download';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                
                dlOp.succeed('Đã tải tệp xong.');
            } catch(e) {
                if (e && e.code === 'UNAUTHENTICATED') { dlOp.end(); return; }
                dlOp.fail('Không tải được tệp: ' + ((e && e.message) ? e.message : 'lỗi không xác định.'));
            }
        };

        // Hàm chuẩn hóa dữ liệu đầu vào (Hỗ trợ cả Type ID lẫn Tên tiếng Việt cũ từ Sheets)
        function normalizeLessonType(rawType) {
            if (!rawType) return "default";
            const cleanType = String(rawType).trim().toLowerCase();
            
            // Khớp trực tiếp nếu đã là Type ID chuẩn
            if (LESSON_TYPE_CONFIG[cleanType]) {
                return cleanType;
            }

            // Ánh xạ tương thích ngược từ dữ liệu tiếng Việt cũ
            if (cleanType.includes("buoi hoc") || cleanType.includes("buổi học") || cleanType.includes("truc tuyen")) return "lesson";
            if (cleanType.includes("pdf")) return "pdf";
            if (cleanType.includes("document") || cleanType.includes("tai lieu") || cleanType.includes("tài liệu")) return "document";
            if (cleanType.includes("kiem tra") || cleanType.includes("kiểm tra") || cleanType.includes("test")) return "test";
            if (cleanType.includes("bai tap") || cleanType.includes("bài tập") || cleanType.includes("nop file") || cleanType.includes("assignment")) return "assignment";
            if (cleanType.includes("video") || cleanType.includes("ghi san") || cleanType.includes("ghi sẵn")) return "video";
            if (cleanType.includes("khao sat") || cleanType.includes("khảo sát") || cleanType.includes("phan hoi") || cleanType.includes("phản hồi")) return "survey";
            if (cleanType.includes("lien ket") || cleanType.includes("liên kết") || cleanType.includes("tham khao") || cleanType.includes("link")) return "link";
            if (cleanType.includes("thao luan") || cleanType.includes("thảo luận") || cleanType.includes("dien dan") || cleanType.includes("diễn đàn")) return "forum";

            return "default";
        }

        // Mở hàm ra phạm vi toàn cục để renderStudentLessons (nằm ngoài IIFE này) gọi được. Function declaration được hoist nên gán trước vẫn hợp lệ.
    window.getLessonTypeConfig = getLessonTypeConfig;

    // Hàm lấy cấu hình loại bài học tập trung
        function getLessonTypeConfig(type) {
            const normalizedId = normalizeLessonType(type);
            return LESSON_TYPE_CONFIG[normalizedId] || LESSON_TYPE_CONFIG.default;
        }

        // ============================================================
        // HỆ THỐNG COMMENT (TRAO ĐỔI BÀI HỌC) - KIẾN TRÚC 3 TẦNG SẴN SÀNG BACKEND
        // ============================================================
        
        // TẦNG 3 & 2: HỆ THỐNG COMMENT TÍCH HỢP BACKEND & POLLING
        const QNS_COMMENT_MANAGER = {
            cachedComments: [],
            currentVersion: 0,
            cachedLessonId: null,
            currentLessonId: null,
            pollInterval: null,
            pendingSend: null,

            // Chuyển sang bài học khác: xóa sạch cache + phiên bản của bài trước, dừng polling cũ
            switchLesson(lessonId) {
                if (this.cachedLessonId !== lessonId) {
                    this.stopPolling();
                    this.cachedLessonId = lessonId;
                    this.cachedComments = [];
                    this.currentVersion = 0;
                    this.pendingSend = null;
                }
            },

            // Thêm hoặc cập nhật theo commentId (không bao giờ tạo bản sao); không ghi đè bản mới hơn bằng bản cũ hơn
            _upsert(comment) {
                if (!comment || !comment.commentId) return;
                const idx = this.cachedComments.findIndex(c => c.commentId === comment.commentId);
                if (idx < 0) {
                    this.cachedComments.push(comment);
                } else if (Number(comment.version) >= Number(this.cachedComments[idx].version)) {
                    this.cachedComments[idx] = comment;
                }
            },

            async getComments(lessonId) {
                if (!lessonId) throw new Error('Không xác định được bài học.');
                this.switchLesson(lessonId);
                const res = await API.request('comment.list', { lessonId: lessonId, token: QNS_AUTH.getToken() });
                // Người dùng đã sang bài khác trong lúc chờ: bỏ kết quả cũ, không ghi vào cache của bài mới
                if (this.cachedLessonId !== lessonId) return [];
                this.cachedComments = (res && Array.isArray(res.comments)) ? res.comments : [];
                this.currentVersion = (res && Number(res.latestVersion)) || 0;
                return this.cachedComments;
            },

            async addComment(lessonId, content, parentId = null) {
                if (!lessonId) throw new Error('Không xác định được bài học.');
                this.switchLesson(lessonId);
                const cleanContent = String(content || '').trim();
                if (!cleanContent) throw new Error('Nội dung bình luận không được để trống.');
                if (cleanContent.length > 5000) throw new Error('Bình luận không được vượt quá 5.000 ký tự.');

                // Cùng nội dung + cùng nơi gửi: dùng lại requestId để lần gửi lại sau lỗi mạng không tạo bản trùng
                const sendKey = lessonId + '|' + (parentId || '') + '|' + cleanContent;
                if (!this.pendingSend || this.pendingSend.key !== sendKey) {
                    this.pendingSend = { key: sendKey, requestId: 'req_cmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) };
                }
                const res = await API.request('comment.create', {
                    lessonId: lessonId,
                    parentId: parentId,
                    content: cleanContent,
                    requestId: this.pendingSend.requestId,
                    token: QNS_AUTH.getToken()
                });

                if (res && res.comment) {
                    this.pendingSend = null;
                    // Không nâng currentVersion ở đây: nếu người khác vừa gửi bình luận có số phiên bản nhỏ hơn thì sẽ bị bỏ sót.
                    // Lần polling kế tiếp sẽ trả lại bản này, _upsert loại trùng.
                    if (this.cachedLessonId === lessonId) this._upsert(res.comment);
                    return res.comment;
                }
                throw new Error('Máy chủ không xác nhận việc gửi bình luận.');
            },

            async deleteComment(commentId) {
                if (!commentId) throw new Error('Không xác định được bình luận cần xóa.');
                const res = await API.request('comment.delete', { commentId: commentId, token: QNS_AUTH.getToken() });
                if (res && res.comment) {
                    this._upsert(res.comment); // Cập nhật theo dữ liệu máy chủ trả về; KHÔNG tải lại bằng lessonId rỗng
                    return true;
                }
                throw new Error('Máy chủ không xác nhận việc xóa bình luận.');
            },

            async pollComments(lessonId) {
                if (!lessonId) return false;
                this.switchLesson(lessonId);
                const res = await API.request('comment.poll', { lessonId: lessonId, sinceVersion: this.currentVersion, token: QNS_AUTH.getToken() });
                if (this.cachedLessonId !== lessonId) return false;
                if (!res || !res.hasChanges) return false;
                if (res.reset) this.cachedComments = [];
                (res.changes || []).forEach(c => this._upsert(c));
                this.currentVersion = Number(res.latestVersion) || this.currentVersion;
                return true;
            },

            startPolling(lessonId, callback) {
                this.stopPolling();
                this.currentLessonId = lessonId;
                const self = this;
                let busy = false; // Không cho hai lượt poll chạy chồng nhau
                this.pollInterval = setInterval(async () => {
                    if (document.hidden || busy || self.currentLessonId !== lessonId) return; // Tiết kiệm hạn mức khi tab ẩn
                    busy = true;
                    try {
                        const changed = await self.pollComments(lessonId);
                        if (changed && self.currentLessonId === lessonId && typeof callback === 'function') callback();
                    } catch (e) {
                        console.error('Lỗi đồng bộ bình luận:', e);
                    } finally {
                        busy = false;
                    }
                }, 15000);
            },

            stopPolling() {
                if (this.pollInterval) {
                    clearInterval(this.pollInterval);
                    this.pollInterval = null;
                }
                this.currentLessonId = null;
            }
        };

        // ============================================================
        // ĐIỀU HƯỚNG GIAO DIỆN CHI TIẾT BÀI HỌC / BÀI TẬP (VÀO HỌC)
        // ============================================================
        const dynamicMainView = document.getElementById('dynamic-main-view');
        let originalMainHtml = dynamicMainView ? dynamicMainView.innerHTML : '';

        // Hàm điều hướng tập trung: quay lại danh sách bài học (an toàn khi gọi nhiều lần)
        let isReturningToCourseList = false;
        function returnToCourseList() {
            if (!dynamicMainView || isReturningToCourseList) return;
            isReturningToCourseList = true;
            try {
                // Hủy mọi lần dựng chi tiết bài học đang chờ (openLessonDetail là hàm async)
                window.qnsDetailRenderToken = (window.qnsDetailRenderToken || 0) + 1;

                // Đóng các modal thuộc luồng chi tiết bài học (không đụng tới hộp thoại hệ thống app-dialog-overlay)
                QNS_COMMENT_MANAGER.stopPolling(); // Không để polling chạy ngầm sau khi rời bài học
                ['lesson-comment-modal', 'submission-modal', 'teacher-grading-modal'].forEach(function (modalId) {
                    const modalEl = document.getElementById(modalId);
                    if (modalEl) modalEl.classList.remove('active');
                });
                document.body.style.overflow = '';
                if (window.qnsCommentEscListener) {
                    document.removeEventListener('keydown', window.qnsCommentEscListener);
                    window.qnsCommentEscListener = null;
                }

                // Chỉ khôi phục khi đang không hiển thị danh sách (tránh ghi đè danh sách đang hiển thị)
                if (originalMainHtml && !document.querySelector('.course-header-card')) {
                    dynamicMainView.innerHTML = originalMainHtml;
                }

                window.currentActiveLessonId = null;
                window.currentActiveLesson = null;

                if (typeof window.rebindCourseHomeEvents === 'function') window.rebindCourseHomeEvents();
            } finally {
                isReturningToCourseList = false;
            }
        }

        // Event delegation trên phần tử cha ổn định: nút Quay lại luôn hoạt động dù DOM được render lại bao nhiêu lần
        if (dynamicMainView) {
            dynamicMainView.addEventListener('click', function (e) {
                const backBtn = e.target && e.target.closest ? e.target.closest('#btn-back-to-course') : null;
                if (!backBtn) return;
                e.preventDefault();
                returnToCourseList();
            });
        }

        // ============================================================
        // [LỖI 21] NGUỒN DỮ LIỆU THÍ SINH CHO BẢNG CHẤM ĐIỂM
        // ============================================================
        // [T23] Đã gỡ qnsReadJsonSafe (đọc LocalStorage, không còn nơi gọi).

        // Trả về mảng: { studentId, fullName, submission, grading } (mỗi thí sinh đúng một lần).
        // [BACKEND-TODO] Khi có Google Apps Script: thay phần đọc LocalStorage bên dưới bằng
        // API lấy danh sách thí sinh + bài nộp theo lessonId, giữ nguyên định dạng giá trị trả về.
    async function getStudentsForGrading(lessonId) {
            const targetLessonId = String(lessonId === undefined || lessonId === null ? '' : lessonId).trim();
            if (!targetLessonId) return [];
            try {
                const token = QNS_AUTH.getToken();
                const res = await API.request('grading.listStudents', {
                    payload: { lessonId: targetLessonId },
                    token: token
                });
                if (res && res.students) {
                    return res.students;
                }
                return [];
            } catch (error) {
                console.error('[LỖI 21] Không thể lấy danh sách thí sinh chấm điểm từ Backend:', error);
                throw error;
                return [];
            }
        }
        window.getStudentsForGrading = getStudentsForGrading;

        // ===== [LỖI 22] CÔNG BỐ ĐIỂM THEO CÀI ĐẶT CỦA GIÁO VIÊN =====
        // Cấu hình thực tế của hệ thống: gradingSettings.scoreRelease = 'immediate' | 'after_grading' | 'manual'
        // (hệ thống KHÔNG có khóa publishMode). Thiếu hoặc sai giá trị => mặc định CHƯA công bố.
        function qnsGetLessonGradingSettings(lessonId) {
            let lessons = [];
            try {
                // [T23] Chỉ lấy từ getStoredLessons (QNS_STORE khi đã cấu hình backend); không đọc LocalStorage trực tiếp
                lessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
            } catch (e) {
                lessons = [];
            }
            if (!Array.isArray(lessons)) return null;
            const lesson = lessons.find(function (l) { return l && l.id === lessonId; });
            return lesson && lesson.gradingSettings && typeof lesson.gradingSettings === 'object'
                ? lesson.gradingSettings : null;
        }

        function qnsShouldPublishOnSave(lessonId) {
            const gs = qnsGetLessonGradingSettings(lessonId);
            if (!gs || typeof gs.scoreRelease !== 'string') return false;
            // manual => false. 'immediate' giữ tương thích: điểm hiện ngay khi giáo viên lưu.
            return gs.scoreRelease === 'after_grading' || gs.scoreRelease === 'immediate';
        }

        // [T23] Đã gỡ qnsRestoreStorageKey và các bản LocalStorage cũ của lưu/công bố điểm (mã chết sau GĐ6).
        // Điểm do máy chủ lưu: grading.save / grading.publish.
        function qnsPersistGrade(lessonId, studentId, gradeFields, published) {
            // Đã chuyển sang xử lý thông qua Backend API Grading (grading.save)
            return true;
        }

        // Trả về: 'ok' | 'denied' | 'invalid' | 'not_graded' | 'error'
        function qnsPublishGrade(lessonId, studentId) {
            console.warn('[GĐ6] qnsPublishGrade (LocalStorage) đã ngừng sử dụng; dùng API grading.publish.');
            return 'error';
        }

        window.openLessonDetail = async function(lessonId, lessonType, lessonTitle, lessonMeta, lessonDesc, lessonLink, attachmentType) {

            // Không mở bài khi thiếu ID để tránh ghi nhầm dữ liệu
            if (!lessonId) {
                console.warn('[LESSON-ID] openLessonDetail bị gọi nhưng thiếu lessonId, đã bỏ qua.');
                return;
            }

            // Lưu đầy đủ thông tin bài học đang mở (dùng khi nộp bài để làm mới đúng bài này)
            // [LỖI 18] Tệp đang chọn (có thể được giữ lại khi chưa tải lên được) không được lẫn sang bài khác
            if (window.selectedFilesLessonId && window.selectedFilesLessonId !== lessonId && selectedSubmissionFiles.length > 0) {
                selectedSubmissionFiles = [];
                window.selectedFilesLessonId = null;
                renderSelectedFilesCards();
            }
            window.currentActiveLessonId = lessonId;
            QNS_COMMENT_MANAGER.stopPolling();
            QNS_COMMENT_MANAGER.switchLesson(lessonId); // Bài khác: xóa cache bình luận bài trước
            window.currentActiveLesson = {
                id: lessonId,
                type: lessonType,
                title: lessonTitle,
                meta: lessonMeta,
                desc: lessonDesc,
                link: lessonLink,
                attachmentType: attachmentType
            };
            if (!dynamicMainView) return;

            // Cập nhật bộ nhớ đệm nếu đây là lần mở đầu tiên
            if (document.querySelector('.course-header-card')) { // Chỉ chụp khi ĐANG hiển thị danh sách, không bao giờ chụp trang chi tiết
                originalMainHtml = QNS_UI.snapshotHtml(dynamicMainView);   // [QNS_UI] bản chụp luôn ở trạng thái nút bình thường
            }

    // [L3] Nội dung bài học (link, tài nguyên, mô tả chi tiết) CHỈ lấy từ Backend qua lesson.get
            const lessonGetToken = (window.qnsDetailRenderToken = (window.qnsDetailRenderToken || 0) + 1);
            let serverLessonContent = null;
            if (QNS_AUTH.isBackendConfigured()) {
                try {
                    serverLessonContent = await API.request('lesson.get', { lessonId: lessonId });
                    if (!serverLessonContent || !serverLessonContent.lessonId) throw new Error('Máy chủ không trả về nội dung bài học.');
                } catch (accessError) {
                    if (lessonGetToken !== window.qnsDetailRenderToken) return; // đã mở bài khác: bỏ kết quả cũ
                    returnToCourseList(); // không giữ lại nội dung bài cũ trên màn hình
                    await window.showAppAlert({ type: 'warning', title: 'Không thể mở bài học', message: (accessError && accessError.message) ? accessError.message : 'Bạn chưa được phép truy cập bài học này.' });
                    return;
                }
                if (lessonGetToken !== window.qnsDetailRenderToken) return;
                lessonLink = serverLessonContent.link || ''; // bỏ giá trị cũ lấy từ danh sách
            }

    // Lấy dữ liệu bài nộp & điểm từ Backend
            let submissionData = { status: 'Chưa nộp', files: [], note: '' };
            let gradeData = { score: null, published: false, comment: '' };

            try {
                const token = QNS_AUTH.getToken();
                if (token) {
                    const res = await API.request('grading.getMyGrade', {
                        lessonId: lessonId,
                        token: token
                    });
                    if (res) {
                        if (res.submission) submissionData = res.submission;
                        window.qnsSetServerAttempts(lessonId, currentStudentId, submissionData && submissionData.attempts); // [T23]
                        if (res.grade) {
                            gradeData = res.grade;
                            // Quyền truy cập điểm nghiêm ngặt: 
                            // Nếu chưa published mà user không phải Teacher thì cấm xem.
                            if (!gradeData.published) {
                                gradeData = { score: null, published: false, comment: '' };
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Lỗi đồng bộ dữ liệu điểm từ Backend:", e);
            }
            
            // Đồng bộ trạng thái nút hoàn thành với nút ngoài danh sách (Từ Backend Cache)
            const storageKey = window.qnsCompletionKey(lessonId); // Giữ biến key để duy trì tương thích HTML (nếu cần dùng CSS query)
            const isCompleted = window.QNS_STORE.progress && window.QNS_STORE.progress.includes(lessonId);

            let isAssignment = lessonType === 'assignment' || lessonType === 'test';
            
            // CẤU HÌNH 1: Icon loại bài học cho tiêu đề trang chi tiết
            const lessonConfig = getLessonTypeConfig(lessonType);

            // CẤU HÌNH 2: Icon định dạng tệp đính kèm (Lấy từ trường attachmentType đã khai báo độc lập)
            const attachConfig = getAttachmentTypeConfig(attachmentType);

            // Kiểm tra cấu hình chấm điểm và nội dung bài học (getStoredLessons: QNS_STORE khi đã cấu hình backend)
            let allCustomLessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
            let currentLessonObj = allCustomLessons.find(l => l.id === lessonId);
            if (serverLessonContent) {
                currentLessonObj = Object.assign({}, currentLessonObj || {}, {
                    detailedDesc: serverLessonContent.detailedDesc || '',
                    link: serverLessonContent.link || '',
                    resources: Array.isArray(serverLessonContent.resources) ? serverLessonContent.resources : []
                });
            }
            let isTestLesson = currentLessonObj?.gradingSettings?.isGraded === true || currentLessonObj?.gradingSettings?.isTest === true; // isGraded là thuộc tính chuẩn; isTest chỉ để tương thích dữ liệu cũ
            let lessonMaxScore = Number(currentLessonObj?.gradingSettings?.maxScore) || 10;

            // Kiểm tra quyền Giáo viên nghiêm ngặt (User: Admin && ID: Administrator)
            // Quyền giáo viên chỉ ở mức giao diện (có thể bị giả mạo khi chưa có Backend) - xem QNS_AUTH
            let isTeacherUser = QNS_AUTH.checkTeacherPermission().allowed;

            // [LỖI 21] Nạp danh sách thí sinh chấm điểm (chỉ giáo viên + bài kiểm tra) trước khi dựng giao diện
            const detailRenderToken = lessonGetToken;
            if (detailRenderToken !== window.qnsDetailRenderToken) return; // người dùng đã chuyển bài/quay lại trong lúc chờ
            let gradingStudents = [];
            if (isTestLesson && isTeacherUser) {
                try {
                    gradingStudents = await getStudentsForGrading(lessonId);
                } catch (rosterError) {
                    console.error('[LỖI 21] Lỗi nạp danh sách thí sinh:', rosterError);
                    window.showAppAlert({ type: 'error', title: 'Không tải được danh sách chấm điểm', message: rosterError.message });
                    gradingStudents = [];
                }
                // Nếu trong lúc chờ có lần mở bài khác thì bỏ lần dựng này
                if (detailRenderToken !== window.qnsDetailRenderToken) return;
            }

            // Xây dựng giao diện 2:1 kèm khung quản lý giáo viên nếu là bài kiểm tra và đúng quyền
            dynamicMainView.innerHTML = `
                <div>
                    <button class="btn-back-course" id="btn-back-to-course">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span>Quay lại danh sách bài học</span>
                    </button>
                </div>
                <div class="lesson-detail-container">
                    <div class="lesson-main-pane">
                        <div class="content-detail-card">
                            <h2 class="detail-header-title">
                                <div class="lesson-icon-wrapper ${lessonConfig.cssClass}" style="margin-right: 0; width: 38px; height: 38px; font-size: 18px;">
                                    <i class="fa-solid ${lessonConfig.icon}"></i>
                                </div>
                                <span>${window.qnsEscapeHtml(lessonTitle)}</span>
                            </h2>
                            <div class="detail-meta-row">
                                <div class="detail-meta-item"><i class="fa-solid fa-user-tie"></i> <span>GV: Nguyễn Hải Quân</span></div>
                                <div class="detail-meta-item"><i class="fa-regular fa-calendar"></i> <span>Mới cập nhật</span></div>
                                ${isAssignment ? '<div class="detail-meta-item"><i class="fa-regular fa-clock"></i> <span>Hạn nộp: Xem trên hệ thống</span></div>' : ''}
                                ${isTestLesson ? `<div class="detail-meta-item" style="color: #d97706; font-weight: 600;"><i class="fa-solid fa-star"></i> <span>Bài kiểm tra (${lessonMaxScore} điểm)</span></div>` : ''}
                            </div>
                            <div class="detail-description">${window.qnsEscapeHtml((currentLessonObj && currentLessonObj.detailedDesc) ? currentLessonObj.detailedDesc : (lessonDesc || 'Đây là nội dung được quản lý tập trung trên hệ thống Quân Nguyễn Study.'))}</div>
                            
                            ${(() => {
                                let listRes = [];
                                if (currentLessonObj && Array.isArray(currentLessonObj.resources) && currentLessonObj.resources.length > 0) {
                                    listRes = currentLessonObj.resources;
                                } else if (lessonLink && lessonLink !== '#' && lessonLink !== 'home.html') {
                                    listRes = [{ type: attachmentType || 'document', name: lessonTitle, url: lessonLink }];
                                }

                                if (listRes.length === 0) return '';

                                let cardsHtml = listRes.map((res, index) => {
                                    const cfg = getAttachmentTypeConfig(res.type);
                                    const displayName = res.name || `${lessonTitle} - Tài liệu ${index + 1}`;
                                    return `
                                        <div class="attachment-card" style="cursor: ${window.qnsSafeUrl(res.url) ? 'pointer' : 'default'}; padding: 0; overflow: hidden; display: flex; margin-bottom: 10px;" ${window.qnsSafeUrl(res.url) ? `data-open-url="${window.qnsEscapeHtml(window.qnsSafeUrl(res.url))}"` : 'data-invalid-url="1"'}>
                                            <div style="padding: 12px 16px; flex: 1; display: flex; align-items: center; gap: 14px;">
                                                <div class="attachment-icon-wrapper ${cfg.cssClass}">
                                                    <i class="fa-solid ${cfg.icon}"></i>
                                                </div>
                                                <div>
                                                    <div class="attachment-name" style="margin-bottom: 2px;">${window.qnsEscapeHtml(displayName)}${window.qnsSafeUrl(res.url) ? '' : ' <small style="color: #b91c1c;">(Liên kết không hợp lệ)</small>'}</div>
                                                    <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">${cfg.name}</div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('');

                                return `
                                    <div style="margin-top: 24px;">
                                        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; color: var(--text-color);">Tệp đính kèm / Tài nguyên</h4>
                                        <div style="display: flex; flex-direction: column; gap: 8px;">
                                            ${cardsHtml}
                                        </div>
                                    </div>
                                `;
                            })()}

                            <!-- NÚT MỞ COMMENT BÀI HỌC -->
                            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px dashed var(--border-color);">
                                <button id="btn-open-lesson-comments" class="btn" style="background-color: #f8f9fa; border: 1px solid var(--border-color); color: var(--text-color); width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; font-size: 0.95rem; transition: background 0.2s;">
                                    <i class="fa-regular fa-comments" style="color: var(--primary-color); font-size: 1.2rem;"></i>
                                    <span style="font-weight: 600;">Trao đổi về bài học</span>
                                    <span id="comment-count-badge" style="background: var(--primary-light); color: var(--primary-color); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 700; margin-left: auto;">0</span>
                                </button>
                            </div>

                        </div>

                        <!-- KHUNG QUẢN LÝ BÀI NỘP VÀ CHẤM ĐIỂM (DÀNH RIÊNG CHO GIÁO VIÊN KHI LÀ BÀI KIỂM TRA) -->
                        ${isTestLesson && isTeacherUser ? (() => {
                            // [LỖI 21] Dữ liệu thí sinh do getStudentsForGrading() cung cấp (biến gradingStudents)
                            
                            const rosterStudents = Array.isArray(gradingStudents) ? gradingStudents : [];
                            let totalStudents = rosterStudents.length;
                            let submittedCount = 0;
                            let gradedCount = 0;

                            let tableRowsHtml = rosterStudents.map((st, idx) => {
                                let subInfo = st.submission;
                                let hasSubmitted = subInfo && (subInfo.status === 'Đã nộp' || subInfo.status === 'Nộp muộn' || subInfo.statusLabel === 'Đã nộp' || subInfo.statusLabel === 'Nộp muộn');
                                if (hasSubmitted) submittedCount++;

                                let gradeInfo = st.grading || { score: null, status: 'pending' };
                                let isGraded = gradeInfo.status === 'graded' && gradeInfo.score !== null;
                                if (isGraded) gradedCount++;

                                let isPublished = gradeInfo.published === true;

                                let filesHtml = hasSubmitted && subInfo.files && subInfo.files.length > 0 
                                    ? subInfo.files.map(f => renderSubmissionFileItemHtml(f)).join('')
                                    : '<span style="color: var(--text-muted); font-size: 0.82rem;">Chưa có tệp</span>';

                                return `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td><strong>${window.qnsEscapeHtml(st.fullName)}</strong></td>
                                        <td>${window.qnsEscapeHtml(st.studentId)}</td>
                                        <td><span class="submission-status-pill ${hasSubmitted ? (subInfo.statusLabel === 'Nộp muộn' || subInfo.status === 'Nộp muộn' || subInfo.status === 'late' ? 'late' : 'submitted') : ''}">${hasSubmitted ? (subInfo.statusLabel || subInfo.status) : 'Chưa nộp'}</span>${hasSubmitted ? window.qnsSubmitMetaHtml(subInfo) : ''}</td>
                                        <td>${filesHtml}</td>
                                        <td><strong>${isGraded ? `${window.qnsEscapeHtml(gradeInfo.score)} / ${lessonMaxScore}` : 'Chưa chấm'}</strong></td>
                                        <td><div class="grade-status-cell"><span class="submission-status-pill ${isGraded ? 'submitted' : ''}">${isGraded ? 'Đã chấm' : 'Chưa chấm'}</span>${isGraded ? `<span class="submission-status-pill grade-publish-pill ${isPublished ? 'published' : 'unpublished'}">${isPublished ? 'Đã công bố' : 'Chưa công bố'}</span>` : ''}
                                            ${isGraded && !isPublished ? `<button type="button" class="btn-publish-grade" data-studentid="${window.qnsEscapeHtml(st.studentId)}" data-studentname="${window.qnsEscapeHtml(st.fullName)}"><i class="fa-solid fa-bullhorn"></i> Công bố điểm</button>` : ''}
                                            ${isGraded && isPublished ? `<button type="button" class="btn-unpublish-grade" data-studentid="${window.qnsEscapeHtml(st.studentId)}" data-studentname="${window.qnsEscapeHtml(st.fullName)}" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 6px; border: 1px solid #d97706; background: #fff; color: #d97706; cursor: pointer; margin-top: 4px;"><i class="fa-solid fa-eye-slash"></i> Thu hồi</button>` : ''}
                                        </div></td>
                                        <td>
                                            <button class="btn btn-primary btn-grade-detail-modal" data-studentid="${window.qnsEscapeHtml(st.studentId)}" data-studentname="${window.qnsEscapeHtml(st.fullName)}" style="padding: 4px 10px; font-size: 0.78rem;">
                                                <i class="fa-solid fa-pen-to-square"></i> Chấm điểm
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('');

                            if (rosterStudents.length === 0) {
                                tableRowsHtml = `
                                    <tr class="grading-empty-row">
                                        <td colspan="8">
                                            <div class="grading-empty-state">
                                                <i class="fa-regular fa-folder-open grading-empty-icon"></i>
                                                <p>Chưa có dữ liệu học sinh hoặc bài nộp cho bài học này.</p>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }

                            let pendingCount = totalStudents - gradedCount;
                            let unsubmittedCount = totalStudents - submittedCount;

                            return `
                                <div class="teacher-grading-card">
                                    <h3 class="teacher-grading-title">
                                        <i class="fa-solid fa-clipboard-check"></i>
                                        <span>QUẢN LÝ BÀI NỘP VÀ CHẤM ĐIỂM</span>
                                    </h3>
                                    <div class="grading-stats-row">
                                        <div class="grading-stat-box">
                                            <div class="grading-stat-number">${totalStudents}</div>
                                            <div class="grading-stat-label">Tổng thí sinh</div>
                                        </div>
                                        <div class="grading-stat-box">
                                            <div class="grading-stat-number" style="color: #15803d;">${submittedCount}</div>
                                            <div class="grading-stat-label">Đã nộp bài</div>
                                        </div>
                                        <div class="grading-stat-box">
                                            <div class="grading-stat-number" style="color: #b91c1c;">${unsubmittedCount}</div>
                                            <div class="grading-stat-label">Chưa nộp bài</div>
                                        </div>
                                        <div class="grading-stat-box">
                                            <div class="grading-stat-number" style="color: #1d4ed8;">${gradedCount}</div>
                                            <div class="grading-stat-label">Đã chấm</div>
                                        </div>
                                        <div class="grading-stat-box">
                                            <div class="grading-stat-number" style="color: #d97706;">${pendingCount}</div>
                                            <div class="grading-stat-label">Chưa chấm</div>
                                        </div>
                                    </div>
                                    <div class="grading-table-container">
                                        <table class="grading-table">
                                            <thead>
                                                <tr>
                                                    <th>STT</th>
                                                    <th>Họ và tên</th>
                                                    <th>Số báo danh</th>
                                                    <th>Trạng thái</th>
                                                    <th>Tệp bài làm</th>
                                                    <th>Điểm</th>
                                                    <th>Trạng thái chấm</th>
                                                    <th>Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${tableRowsHtml}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            `;
                        })() : ''}
                    </div>
                    <div class="lesson-side-pane">
                        <div class="sidebar-card">
                            <div class="card-title-action">
                                <span>Bài tập của bạn</span>
                                <span class="submission-status-pill ${submissionData.status === 'Đã nộp' ? 'submitted' : (submissionData.status === 'Nộp muộn' ? 'late' : '')}">${window.qnsEscapeHtml(submissionData.status)}</span>
                            </div>
                            ${isAssignment ? `
                                <div id="submission-box-content">
                                    <div style="margin-bottom: 12px; font-size: 0.88rem; color: var(--text-muted);">
                                        ${submissionData.files && submissionData.files.length > 0 ? `Đã đính kèm ${submissionData.files.length} tệp.` : 'Chưa có tệp nào được tải lên.'}
                                    </div>
                                    ${(() => {
                                        if (!submissionData.files || submissionData.files.length === 0) return '';
                                        return `
                                            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; max-height: 220px; overflow-y: auto;">
                                                ${submissionData.files.map(file => {
                                                    const fileConfig = getUploadedFileType(file);
                                                    const v = normalizeSubmissionFile(file);
                                                    const isUploaded = v.uploadStatus === 'uploaded' && v.fileId;
                                                    return `
                                                        <div class="attachment-card" style="margin-top: 0; padding: 10px 12px; ${isUploaded ? 'cursor: pointer;' : ''}" ${isUploaded ? `data-qns-download="1" data-file-id="${window.qnsEscapeHtml(v.fileId)}" data-file-name="${window.qnsEscapeHtml(v.name)}"` : ''}>
                                                            <div class="attachment-info">
                                                                <div class="attachment-icon-wrapper ${fileConfig.cssClass}" style="width: 38px; height: 38px; min-width: 38px; min-height: 38px; font-size: 18px;">
                                                                    <i class="fa-solid ${fileConfig.icon}"></i>
                                                                </div>
                                                                <div style="min-width: 0; flex-grow: 1;">
                                                                    <div class="attachment-name" style="font-size: 0.85rem;">${window.qnsEscapeHtml(file.name)}</div>
                                                                    <div style="font-size: 0.73rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
                                                                        ${window.qnsEscapeHtml(file.formatName || fileConfig.formatName)} · ${window.qnsEscapeHtml(file.sizeStr || formatFileSize(file.size))}${isUploaded ? '' : ' · Chưa tải lên hệ thống lưu trữ'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    `;
                                                }).join('')}
                                            </div>
                                        `;
                                    })()}
                                    <button class="btn btn-primary" id="btn-open-submit-modal" style="width: 100%; margin-bottom: 8px;">
                                        <i class="fa-solid fa-upload" style="margin-right: 6px;"></i> ${(submissionData.status === 'Đã nộp' || submissionData.status === 'Nộp muộn') ? 'Nộp lại bài' : 'Thêm tệp bài làm'}
                                    </button>
                                    <button class="btn btn-status btn-complete-detail ${isCompleted ? 'completed' : ''}" data-key="${window.qnsEscapeHtml(storageKey)}" style="width: 100%;">
                                        <span class="btn-complete-text">${isCompleted ? '✓ Đã hoàn thành' : 'Đánh dấu là đã hoàn thành'}</span>
                                    </button>
                                </div>
                            ` : `
                                <div>
                                    <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 12px;">Bài học này không yêu cầu nộp tệp.</p>
                                    <button class="btn btn-status btn-complete-detail ${isCompleted ? 'completed' : ''}" data-key="${window.qnsEscapeHtml(storageKey)}" style="width: 100%;">
                                        <span class="btn-complete-text">${isCompleted ? '✓ Đã hoàn thành' : 'Đánh dấu là đã hoàn thành'}</span>
                                    </button>
                                </div>
                            `}
                        </div>
                        <div class="sidebar-card">
                            <div class="card-title-action">
                                <span>Điểm của bạn</span>
                            </div>
                            <div class="grade-display-box">
                                ${(() => {
                                    let currentLessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
                                    let currentLessonObj = currentLessons.find(l => l.id === lessonId);
                                    let gradingSettings = currentLessonObj?.gradingSettings || { isGraded: false };
                                    let isGradedLesson = gradingSettings.isGraded === true;
                                    let maxScoreLimit = Number(gradingSettings.maxScore) || 10;

                                    if (!isGradedLesson) {
                                        return `
                                            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">Bài học thông thường</div>
                                        `;
                                    }

                                    let isScoreReleased = false;
                                    let releaseMode = gradingSettings.scoreRelease || 'after_grading';

                                    if (releaseMode === 'immediate' && (submissionData.status === 'Đã nộp' || submissionData.status === 'Nộp muộn')) {
                                        isScoreReleased = gradeData.published === true && gradeData.score !== null && gradeData.score !== '' && isFinite(Number(gradeData.score));
                                    } else if (releaseMode === 'after_grading') {
                                        isScoreReleased = gradeData.published === true && gradeData.score !== null && gradeData.score !== '' && isFinite(Number(gradeData.score));
                                    } else if (releaseMode === 'manual') {
                                        isScoreReleased = gradeData.published === true && gradeData.score !== null && gradeData.score !== '' && isFinite(Number(gradeData.score));
                                    }

                                    if (isScoreReleased && gradeData.score !== null) {
                                        return `
                                            <div class="grade-number">${window.qnsEscapeHtml(gradeData.score)} / ${maxScoreLimit}</div>
                                            <div class="grade-note">Trạng thái: Đã công bố điểm</div>
                                        `;
                                    } else {
                                        return `
                                            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">Chưa có điểm / Đang chờ công bố</div>
                                            <div class="grade-note" style="margin-top: 4px;">Điểm tối đa: ${maxScoreLimit} điểm</div>
                                        `;
                                    }
                                })()}
                            </div>
                            ${(() => {
                                let currentLessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
                                let currentLessonObj = currentLessons.find(l => l.id === lessonId);
                                let gradingSettings = currentLessonObj?.gradingSettings || { isGraded: false };
                                if (!gradingSettings.isGraded) return '';

                                let releaseMode = gradingSettings.scoreRelease || 'after_grading';
                                let isScoreReleased = false;
                                if (releaseMode === 'immediate' && (submissionData.status === 'Đã nộp' || submissionData.status === 'Nộp muộn')) {
                                    isScoreReleased = gradeData.published === true && gradeData.score !== null && gradeData.score !== '' && isFinite(Number(gradeData.score));
                                } else if (releaseMode === 'after_grading' || releaseMode === 'manual') {
                                    isScoreReleased = gradeData.published === true && gradeData.score !== null && gradeData.score !== '' && isFinite(Number(gradeData.score));
                                }

                                let extraHtml = '';
                                // Rule 7: Quyền xem nhận xét
                                if (isScoreReleased && gradingSettings.showTeacherComments !== false && gradeData.comment) {
                                    extraHtml += `
                                        <div style="margin-top: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                                            <div style="font-weight: 600; font-size: 0.85rem; color: var(--primary-color); margin-bottom: 4px;"><i class="fa-solid fa-comment-dots"></i> Nhận xét của giáo viên:</div>
                                            <div style="font-size: 0.85rem; color: var(--text-color);">${window.qnsEscapeHtml(gradeData.comment)}</div>
                                        </div>
                                    `;
                                }
                                // Rule 8: Quyền xem đáp án
                                if (isScoreReleased && gradingSettings.showAnswers === true) {
                                    extraHtml += `
                                        <div style="margin-top: 10px; background: #dcfce7; padding: 12px; border-radius: 8px; border: 1px solid #bbf7d0;">
                                            <div style="font-weight: 600; font-size: 0.85rem; color: #15803d;"><i class="fa-solid fa-circle-check"></i> Đáp án bài học đã được mở.</div>
                                        </div>
                                    `;
                                }
                                return extraHtml;
                            })()}
                        </div>
                    </div>
                </div>
            `;

            // [LỖI 19] Mở tài nguyên/tệp bằng addEventListener; URL được kiểm tra lại ngay trước khi mở
            dynamicMainView.querySelectorAll('[data-open-url]').forEach(function (openEl) {
                openEl.addEventListener('click', function () {
                    window.qnsOpenSafeUrl(openEl.getAttribute('data-open-url'));
                });
            });

            // ============================================================
            // TẦNG 1: GIAO DIỆN (UI) - LOGIC COMMENT BÀI HỌC
            // ============================================================
            let currentReplyParentId = null;
            let isFetchingComments = false;

            const updateCommentCount = async (useCache = false) => {
                const badge = document.getElementById('comment-count-badge');
                if (!badge) return;
                try {
                    const comments = useCache ? QNS_COMMENT_MANAGER.cachedComments : await QNS_COMMENT_MANAGER.getComments(lessonId);
                    const activeCount = comments.filter(c => c.status !== 'deleted').length;
                    badge.textContent = activeCount;
                } catch (e) { console.error('Lỗi đếm số lượng bình luận:', e); }
            };
            updateCommentCount(false); // Lấy số đếm lúc mở bài (bên ngoài modal)

            const renderCommentThread = async (useCache = false) => {
                const container = document.getElementById('comment-list-container');
                if (!container) return;
                
                if (isFetchingComments) return;
                isFetchingComments = true;
                if (!useCache) {
                    container.innerHTML = `<div class="comment-empty-state"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i><p style="margin-top: 10px;">Đang tải cuộc trò chuyện...</p></div>`;
                }

                try {
                    const comments = useCache ? QNS_COMMENT_MANAGER.cachedComments : await QNS_COMMENT_MANAGER.getComments(lessonId);
                    if (window.currentActiveLessonId !== lessonId || QNS_COMMENT_MANAGER.cachedLessonId !== lessonId) return; // Đã chuyển bài: bỏ kết quả cũ
                    const roots = comments.filter(c => !c.parentId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                    
                    if (roots.length === 0) {
                        container.innerHTML = `
                            <div class="comment-empty-state">
                                <i class="fa-regular fa-comments" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5;"></i>
                                <p>Chưa có trao đổi nào về bài học này. Hãy bắt đầu cuộc trò chuyện!</p>
                            </div>`;
                        isFetchingComments = false;
                        return;
                    }

                    let html = '';

                    const buildItemHtml = (cmt, isReply = false, hasActiveReplies = false) => {
                        const isDeleted = cmt.status === 'deleted';
                        if (isDeleted && !hasActiveReplies) return '';
                        if (isDeleted) {
                            return `
                                <div class="comment-item ${isReply ? 'comment-reply' : ''}">
                                    <div class="comment-avatar" style="background:#e2e8f0; color:#94a3b8;"><i class="fa-solid fa-ban"></i></div>
                                    <div class="comment-body" style="background:#f8f9fa; border-style:dashed;">
                                        <div class="comment-text" style="color:var(--text-muted); font-style:italic; font-size: 0.85rem;">Bình luận này đã bị tác giả hoặc Quản trị viên xóa.</div>
                                    </div>
                                </div>
                            `;
                        }

                        const dateObj = new Date(cmt.createdAt);
                        const timeStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ', ' + dateObj.toLocaleDateString('vi-VN');
                        
                        const safeName = window.qnsEscapeHtml(cmt.authorName);
                        const safeContent = window.qnsEscapeHtml(cmt.content);
                        const safeId = window.qnsEscapeHtml(cmt.commentId);
                        const avatarText = safeName.charAt(0).toUpperCase();
                        const roleBadge = cmt.authorRole === 'teacher' ? '<span class="comment-role teacher">Giáo viên</span>' : '<span class="comment-role student">Học sinh</span>';
                        
                        const canDelete = cmt.canDelete === true; // Máy chủ tính quyền xóa; nút chỉ là gợi ý giao diện, quyền thật kiểm ở comment.delete
                        const deleteBtn = canDelete ? `<button class="btn-comment-act delete" data-action="delete" data-id="${safeId}">Xóa</button>` : '';
                        
                        const canReply = !isReply || isTeacherUser; 
                        const replyBtn = canReply ? `<button class="btn-comment-act" data-action="reply" data-id="${isReply ? window.qnsEscapeHtml(cmt.parentId) : safeId}" data-name="${safeName}">Trả lời</button>` : '';

                        return `
                            <div class="comment-item ${isReply ? 'comment-reply' : ''}">
                                <div class="comment-avatar">${avatarText}</div>
                                <div class="comment-body">
                                    <div class="comment-header">
                                        <span class="comment-author">${safeName}</span>
                                        ${roleBadge}
                                        <span class="comment-time">${timeStr}</span>
                                    </div>
                                    <div class="comment-text">${safeContent}</div>
                                    <div class="comment-actions">
                                        ${replyBtn}
                                        ${deleteBtn}
                                    </div>
                                </div>
                            </div>
                        `;
                    };

                    roots.forEach(root => {
                        const replies = comments.filter(c => c.parentId === root.commentId).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
                        const activeRepliesCount = replies.filter(r => r.status !== 'deleted').length;
                        
                        const rootHtml = buildItemHtml(root, false, activeRepliesCount > 0);
                        if (!rootHtml) return;

                        html += `<div class="comment-thread">${rootHtml}`;
                        replies.forEach(reply => { html += buildItemHtml(reply, true, false); });
                        html += `</div>`;
                    });

                    container.innerHTML = html;
                } catch (error) {
                    container.innerHTML = `<div class="comment-empty-state" style="color: #dc2626;"><i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; margin-bottom:10px;"></i><p>Đã xảy ra lỗi khi tải dữ liệu bình luận.</p></div>`;
                } finally {
                    isFetchingComments = false;
                }
            };

            const updateCharCount = () => {
                const txt = document.getElementById('comment-input-textarea');
                const cnt = document.getElementById('comment-char-count');
                if (txt && cnt) cnt.textContent = `${txt.value.length} / 5000`;
            };

            const cancelReply = () => {
                currentReplyParentId = null;
                const ind = document.getElementById('replying-to-indicator');
                const txt = document.getElementById('comment-input-textarea');
                if (ind) ind.style.display = 'none';
                if (txt) txt.focus();
            };

            const toggleModalScrollLock = (lock) => {
                document.body.style.overflow = lock ? 'hidden' : '';
            };


            // Gắn sự kiện Textarea
            const txtArea = document.getElementById('comment-input-textarea');
            if (txtArea) {
                txtArea.oninput = updateCharCount;
                txtArea.onkeydown = (e) => {
                    if (e.ctrlKey && e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('btn-send-comment')?.click();
                    }
                };
            }

            // Sự kiện: Mở Modal
            const btnOpenComments = document.getElementById('btn-open-lesson-comments');
            if (btnOpenComments) {
                btnOpenComments.onclick = () => {
                    const titleEl = document.getElementById('comment-modal-lesson-title');
                    if (titleEl) titleEl.textContent = lessonTitle;
                    cancelReply();
                    if (txtArea) { txtArea.value = ''; updateCharCount(); }
                    
                    renderCommentThread(false); // Fetch từ server lần đầu
                    
                    // Khởi chạy Polling (chạy ngầm mỗi 15s)
                    QNS_COMMENT_MANAGER.startPolling(lessonId, async () => {
                        await renderCommentThread(true); // Chỉ merge từ cache để tránh UI Flash
                        await updateCommentCount(true);
                    });

                    const modal = document.getElementById('lesson-comment-modal');
                    if (modal) modal.classList.add('active');
                    toggleModalScrollLock(true);
                };
            }

            const closeCommentModal = () => {
                const modal = document.getElementById('lesson-comment-modal');
                if (modal) modal.classList.remove('active');
                toggleModalScrollLock(false);
                QNS_COMMENT_MANAGER.stopPolling(); // Dừng Polling để tiết kiệm Quota Apps Script
            };

            const btnCloseCommentModal = document.getElementById('close-comment-modal');
            if (btnCloseCommentModal) btnCloseCommentModal.onclick = closeCommentModal;

            const commentModal = document.getElementById('lesson-comment-modal');
            if (commentModal) {
                commentModal.onclick = (e) => {
                    const content = document.getElementById('comment-input-textarea')?.value.trim();
                    if (e.target === commentModal && !content) closeCommentModal();
                };
            }
            
            const escListener = (e) => {
                const activeModal = document.getElementById('lesson-comment-modal');
                if (e.key === 'Escape' && activeModal && activeModal.classList.contains('active')) {
                    const content = document.getElementById('comment-input-textarea')?.value.trim();
                    if (!content) closeCommentModal();
                }
            };
            document.removeEventListener('keydown', window.qnsCommentEscListener);
            window.qnsCommentEscListener = escListener;
            document.addEventListener('keydown', escListener);

            const btnCancelReply = document.getElementById('btn-cancel-reply');
            if (btnCancelReply) btnCancelReply.onclick = cancelReply;

            const btnSendComment = document.getElementById('btn-send-comment');
            if (btnSendComment) {
                btnSendComment.onclick = async () => {
                    const txt = document.getElementById('comment-input-textarea');
                    const content = txt.value;
                    if (!content.trim()) {
                        txt.focus();
                        return;
                    }

                    btnSendComment.disabled = true;
                    const originalHtml = btnSendComment.innerHTML;
                    btnSendComment.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Đang gửi...';

                    try {
                        await QNS_COMMENT_MANAGER.addComment(lessonId, content, currentReplyParentId);
                        txt.value = '';
                        updateCharCount();
                        cancelReply();
                        await renderCommentThread(true);
                        await updateCommentCount(true);
                    } catch (error) {
                        window.showAppAlert({ type: 'error', title: 'Không thể gửi bình luận', message: error.message });
                    } finally {
                        btnSendComment.disabled = false;
                        btnSendComment.innerHTML = originalHtml;
                    }
                };
            }

            const listContainer = document.getElementById('comment-list-container');
            if (listContainer) {
                listContainer.onclick = async (e) => {
                    const btn = e.target.closest('.btn-comment-act');
                    if (!btn) return;

                    const action = btn.getAttribute('data-action');
                    const targetId = btn.getAttribute('data-id');

                    if (action === 'reply') {
                        currentReplyParentId = targetId;
                        const repName = document.getElementById('replying-to-name');
                        const ind = document.getElementById('replying-to-indicator');
                        const txt = document.getElementById('comment-input-textarea');
                        
                        if (repName) repName.textContent = btn.getAttribute('data-name');
                        if (ind) ind.style.display = 'flex';
                        if (txt) {
                            txt.focus();
                            const len = txt.value.length;
                            txt.setSelectionRange(len, len);
                        }
                    } 
                    else if (action === 'delete') {
                        const confirmed = await window.showAppConfirm({ 
                            title: 'Xóa bình luận', 
                            message: 'Bạn có chắc chắn muốn xóa bình luận này? Thao tác không thể hoàn tác.',
                            confirmText: 'Xóa bình luận'
                        });
                        if (confirmed) {
                            const delCmtOp = QNS_UI.begin({
                                key: 'comment.delete:' + targetId,
                                btn: btn,
                                label: 'Đang xóa...',
                                toast: { loading: 'Đang xóa bình luận...' },
                                silentBusy: true
                            });
                            if (!delCmtOp) return;
                            try {
                                await QNS_COMMENT_MANAGER.deleteComment(targetId);
                                await renderCommentThread(true);
                                await updateCommentCount(true);
                                delCmtOp.succeed('Đã xóa bình luận.');
                            } catch (error) {
                                delCmtOp.end();
                                window.showAppAlert({ type: 'error', title: 'Không thể xóa', message: error.message });
                            }
                        }
                    }
                };
            }

            // Nút "Quay lại danh sách bài học" được xử lý bằng event delegation + returnToCourseList() (khai báo phía trên)

            // Sự kiện: Mở modal nộp bài
            const openSubmitModalBtn = document.getElementById('btn-open-submit-modal');
            if (openSubmitModalBtn) {
                openSubmitModalBtn.addEventListener('click', function() {
                    const allLessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
                    const currentLessonObj = allLessons.find(l => l.id === window.currentActiveLessonId);
                    
                    // Kiểm tra Ghi chú
                    const noteGroup = document.getElementById('submission-note').closest('.form-group');
                    if (currentLessonObj && currentLessonObj.settings?.submission?.allowNote === false) {
                        noteGroup.style.display = 'none';
                    } else {
                        noteGroup.style.display = 'flex';
                    }
                    
                    // Cập nhật thông tin hạn nộp / giới hạn lên Form Modal cho học sinh thấy
                    let infoHtml = '';
                    if (currentLessonObj && currentLessonObj.settings?.submission) {
                        const rawSubmissionRules = currentLessonObj.settings.submission;
                        const s = {
                            maxFiles: Number(rawSubmissionRules.maxFiles) || 0,
                            maxSizeMB: Number(rawSubmissionRules.maxSizeMB) || 0,
                            allowedFormats: Array.isArray(rawSubmissionRules.allowedFormats) ? rawSubmissionRules.allowedFormats.map(function (fmt) { return window.qnsEscapeHtml(fmt); }) : []
                        };
                        infoHtml = `<div style="font-size: 0.8rem; color: var(--primary-color); margin-bottom: 8px;">`;
                        if (s.maxFiles) infoHtml += `Tối đa ${s.maxFiles} tệp. `;
                        if (s.maxSizeMB) infoHtml += `Mỗi tệp <= ${s.maxSizeMB}MB. `;
                        if (s.allowedFormats && s.allowedFormats.length > 0) infoHtml += `<br>Định dạng: ${s.allowedFormats.join(', ')}.`;
                        infoHtml += `</div>`;
                    }
                    let infoEl = document.getElementById('modal-submission-rules-info');
                    if (!infoEl) {
                        infoEl = document.createElement('div');
                        infoEl.id = 'modal-submission-rules-info';
                        document.getElementById('dropzone-area').insertAdjacentElement('beforebegin', infoEl);
                    }
                    infoEl.innerHTML = infoHtml;
                    
                    document.getElementById('submission-modal').classList.add('active');
                });
            }

            // Xử lý sự kiện mở Modal chấm điểm dành cho Giáo viên
            let activeGradingStudentId = null;
            let gradingDirty = false; // [LỖI 20] true khi đã lưu điểm mà bảng thống kê phía sau chưa được làm mới
            document.querySelectorAll('.btn-grade-detail-modal').forEach(btn => {
                btn.addEventListener('click', function() {
                    if (!QNS_AUTH.requireTeacher('openGradingModal')) return;
                    activeGradingStudentId = this.getAttribute('data-studentid');
                    let studentName = this.getAttribute('data-studentname');

                    document.getElementById('modal-student-name-display').textContent = `Họ và tên: ${studentName}`;
                    document.getElementById('modal-student-id-display').textContent = `Số báo danh: ${activeGradingStudentId}`;
                    document.getElementById('modal-max-score-label').textContent = `/ ${lessonMaxScore} điểm`;

                    // Đọc dữ liệu bài nộp và điểm đã lưu trước đó (nếu có)
                    const st = gradingStudents.find(s => String(s.studentId) === String(activeGradingStudentId));
                    let studentSub = st ? st.submission : null;
                    if (!studentSub) studentSub = { files: [] };
                    let gInfo = st ? st.grading : null;

                    let filesContainer = document.getElementById('modal-student-files-list');
                    if (studentSub.files && studentSub.files.length > 0) {
                        filesContainer.innerHTML = studentSub.files.map(f => renderSubmissionFileItemHtml(f)).join('<br>');
                    } else {
                        filesContainer.innerHTML = '<span style="color: var(--text-muted);">Thí sinh chưa nộp tệp bài làm nào.</span>';
                    }

                    document.getElementById('teacher-input-score').value = (gInfo && gInfo.score !== null && gInfo.score !== undefined) ? gInfo.score : '';
                    document.getElementById('teacher-input-comment').value = (gInfo && gInfo.comment) ? gInfo.comment : '';
                    window.activeGradingStudentVersion = (gInfo && gInfo.version) ? gInfo.version : 0;

                    document.getElementById('teacher-grading-modal').classList.add('active');
                });
            });

    document.querySelectorAll('.btn-publish-grade').forEach(btn => {
                btn.addEventListener('click', async function() {
                    if (!QNS_AUTH.requireTeacher('publishStudentGrade')) return;
                    const studentId = this.getAttribute('data-studentid');
                    const studentName = this.getAttribute('data-studentname') || studentId;
                    if (!studentId) return;

                    if (!await window.showAppConfirm({ title: 'Công bố điểm', message: `Công bố điểm của thí sinh "${studentName}"?`, confirmText: 'Công bố' })) return;

                    if (!QNS_AUTH.isBackendConfigured()) { await window.showAppAlert({ type: 'error', title: 'Chưa kết nối máy chủ', message: 'Không thể thực hiện khi chưa cấu hình API_BASE_URL.' }); return; }
                    const st = gradingStudents.find(s => String(s.studentId) === String(studentId));
                    const pubOp = QNS_UI.begin({
                        key: 'grading.publish:' + lessonId + ':' + studentId,
                        btn: btn,
                        label: 'Đang công bố...',
                        toast: { loading: 'Đang công bố điểm...' }
                    });
                    if (!pubOp) return;
                    try {
                        const token = QNS_AUTH.getToken();
                        await API.request('grading.publish', {
                            token: token,
                            payload: { lessonId: lessonId, studentId: studentId, expectedVersion: st?.grading?.version || 0, requestId: 'req_pub_' + Date.now() }
                        });
                        pubOp.end();
                        await window.showAppAlert({ type: 'success', title: 'Đã công bố điểm', message: `Thí sinh ${studentName} đã có thể xem điểm.` });
                        openLessonDetail(lessonId, lessonType, lessonTitle, lessonMeta, lessonDesc, lessonLink, attachmentType);
                    } catch (error) {
                        pubOp.end();
                        await window.showAppAlert({ type: 'error', title: 'Công bố thất bại', message: error.message });
                    }
                });
            });

            document.querySelectorAll('.btn-unpublish-grade').forEach(btn => {
                btn.addEventListener('click', async function() {
                    if (!QNS_AUTH.requireTeacher('unpublishStudentGrade')) return;
                    const studentId = this.getAttribute('data-studentid');
                    const studentName = this.getAttribute('data-studentname') || studentId;
                    if (!studentId) return;

                    if (!await window.showAppConfirm({ title: 'Thu hồi công bố', message: `Thu hồi điểm của thí sinh "${studentName}"? Thí sinh sẽ không xem được điểm nữa.`, confirmText: 'Thu hồi' })) return;

                    if (!QNS_AUTH.isBackendConfigured()) { await window.showAppAlert({ type: 'error', title: 'Chưa kết nối máy chủ', message: 'Không thể thực hiện khi chưa cấu hình API_BASE_URL.' }); return; }
                    const st = gradingStudents.find(s => String(s.studentId) === String(studentId));
                    const unpOp = QNS_UI.begin({
                        key: 'grading.unpublish:' + lessonId + ':' + studentId,
                        btn: btn,
                        label: 'Đang thu hồi...',
                        toast: { loading: 'Đang thu hồi điểm...' }
                    });
                    if (!unpOp) return;
                    try {
                        const token = QNS_AUTH.getToken();
                        await API.request('grading.unpublish', {
                            token: token,
                            payload: { lessonId: lessonId, studentId: studentId, expectedVersion: st?.grading?.version || 0, reason: 'Giáo viên điều chỉnh', requestId: 'req_unp_' + Date.now() }
                        });
                        unpOp.end();
                        await window.showAppAlert({ type: 'success', title: 'Thành công', message: `Đã thu hồi điểm của thí sinh ${studentName}.` });
                        openLessonDetail(lessonId, lessonType, lessonTitle, lessonMeta, lessonDesc, lessonLink, attachmentType);
                    } catch (error) {
                        unpOp.end();
                        await window.showAppAlert({ type: 'error', title: 'Thu hồi thất bại', message: error.message });
                    }
                });
            });

            // Đóng modal chấm điểm
            ['close-teacher-grading-modal', 'btn-grading-close'].forEach(id => {
                ((closeEl, closeHandler) => { if (closeEl) closeEl.onclick = closeHandler; })(document.getElementById(id), () => {
                    if (gradingDirty) {
                        gradingDirty = false;
                        setTimeout(() => openLessonDetail(lessonId, lessonType, lessonTitle, lessonMeta, lessonDesc, lessonLink, attachmentType), 0);
                    }
                    document.getElementById('teacher-grading-modal').classList.remove('active');
                });
            });

            // Hàm lưu điểm chung
    async function saveTeacherGradingScore(isNext = false) {
                try {
                    return await saveTeacherGradingScoreCore(isNext);
                } catch (saveError) {
                    console.error('[LỖI 20] Lưu điểm thất bại:', saveError);
                    window.showAppAlert({ type: 'error', title: 'Không thể lưu điểm', message: 'Hệ thống bận hoặc lỗi kết nối. Vui lòng thử lại.' });
                    return false;
                }
            }

            async function saveTeacherGradingScoreCore(isNext = false) {
                if (!QNS_AUTH.requireTeacher('saveTeacherGradingScore')) return false;
                if (!QNS_AUTH.isBackendConfigured()) {
                    window.showAppAlert({ type: 'error', title: 'Chưa kết nối máy chủ', message: 'Không thể lưu điểm khi chưa cấu hình API_BASE_URL.' });
                    return false;
                }
                
                const btnGradingSave = document.getElementById('btn-grading-save');
                const btnGradingSaveNext = document.getElementById('btn-grading-save-next');
                
                let scoreInput = document.getElementById('teacher-input-score');
                let commentInput = document.getElementById('teacher-input-comment');
                
                if (!activeGradingStudentId) {
                    window.showAppAlert({ type: 'error', title: 'Lỗi', message: 'Không xác định được thí sinh.' });
                    return false;
                }
                
                let valScore = parseFloat(scoreInput.value);
                if (isNaN(valScore) || valScore < 0 || valScore > lessonMaxScore) {
                    window.showAppAlert({ type: 'warning', title: 'Điểm số không hợp lệ', message: `Vui lòng nhập từ 0 đến ${lessonMaxScore} điểm.` });
                    scoreInput.focus();
                    return false;
                }

                const gradeOp = QNS_UI.begin({
                    key: 'grading.save:' + lessonId + ':' + activeGradingStudentId,
                    btn: isNext ? btnGradingSaveNext : btnGradingSave,
                    peers: [isNext ? btnGradingSave : btnGradingSaveNext],
                    label: isNext ? 'Đang lưu và chuyển tiếp...' : 'Đang lưu điểm...',
                    toast: { loading: 'Đang lưu điểm...' }
                });
                if (!gradeOp) return false;   // đang lưu: bỏ qua nhấn lặp

                try {
                    const token = QNS_AUTH.getToken();
                    const res = await API.request('grading.save', {
                        token: token,
                        payload: {
                            lessonId: lessonId,
                            studentId: activeGradingStudentId,
                            score: valScore,
                            comment: commentInput.value.trim(),
                            expectedVersion: window.activeGradingStudentVersion || 0,
                            requestId: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                        }
                    });

                    gradingDirty = true;
                    if (!res || !res.grading) throw new Error('Máy chủ không xác nhận việc lưu điểm.');
                    if (isNext) gradeOp.succeed('Đã lưu điểm.'); else gradeOp.end();   // [QNS_UI]
                    const gradingData = res.grading;
                    const stSaved = gradingStudents.find(s => String(s.studentId) === String(activeGradingStudentId));
                    if (stSaved) stSaved.grading = gradingData;
                    window.activeGradingStudentVersion = gradingData.version || 0;
                    const publishedMsg = gradingData.published ? 'Điểm đã tự động công bố.' : 'Điểm CHƯA công bố, hãy bấm "Công bố" khi sẵn sàng.';

                    if (isNext) {
                        const gradeButtons = Array.from(document.querySelectorAll('.btn-grade-detail-modal'));
                        const currentIndex = gradeButtons.findIndex(b => b.getAttribute('data-studentid') === activeGradingStudentId);
                        if (currentIndex < 0 || !gradeButtons[currentIndex + 1]) {
                            await window.showAppAlert({ type: 'info', title: 'Hoàn thành', message: 'Đã lưu điểm. Bạn đã chấm xong thí sinh cuối cùng. ' + publishedMsg });
                        } else {
                            const nextButton = gradeButtons[currentIndex + 1];
                            nextButton.click();
                            return true;
                        }
                    } else {
                        await window.showAppAlert({ type: 'success', title: 'Thành công', message: 'Đã lưu điểm và nhận xét thành công! ' + publishedMsg });
                    }
                    
                    document.getElementById('teacher-grading-modal').classList.remove('active');
                    openLessonDetail(lessonId, lessonType, lessonTitle, lessonMeta, lessonDesc, lessonLink, attachmentType);
                    return true;
                } catch (error) {
                    window.showAppAlert({ type: 'error', title: 'Từ chối lưu điểm', message: error.message });
                    return false;
                } finally {
                    gradeOp.end();   // [QNS_UI] luôn khôi phục nút; gọi lặp là vô hại
                }
            }

            // Sử dụng .onclick thay vì .addEventListener để tránh tích lũy listener (Giải quyết Lỗi 10)
            const btnGradingSave = document.getElementById('btn-grading-save');
            if (btnGradingSave) btnGradingSave.onclick = () => saveTeacherGradingScore(false);

            const btnGradingSaveNext = document.getElementById('btn-grading-save-next');
            if (btnGradingSaveNext) btnGradingSaveNext.onclick = () => saveTeacherGradingScore(true);
            

            // Sự kiện: Đồng bộ Nút Hoàn Thành trong trang chi tiết (Tích hợp API)
            const detailCompleteBtn = document.querySelector('.btn-complete-detail');
            if (detailCompleteBtn) {
                detailCompleteBtn.onclick = async function(e) {
                    e.preventDefault();
                    const isCurrentlyCompleted = this.classList.contains("completed");
                    const newState = !isCurrentlyCompleted;

                    // 1. Optimistic UI Update (Chi tiết & Cache)
                    if (newState) {
                        this.classList.add("completed");
                        this.querySelector(".btn-complete-text").textContent = "✓ Đã hoàn thành";
                        if (!window.QNS_STORE.progress.includes(lessonId)) window.QNS_STORE.progress.push(lessonId);
                    } else {
                        this.classList.remove("completed");
                        this.querySelector(".btn-complete-text").textContent = "Đánh dấu là đã hoàn thành";
                        window.QNS_STORE.progress = window.QNS_STORE.progress.filter(id => id !== lessonId);
                    }

                    // Cập nhật ngay bản ghi lưu nền gốc (originalMainHtml)
                    if (originalMainHtml) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = originalMainHtml;
                        const matchingBtn = tempDiv.querySelector(`.btn-complete[data-schedule-id="${(window.CSS && CSS.escape) ? CSS.escape(String(lessonId)) : String(lessonId).replace(/[\\"]/g, '')}"]`);
                        if (matchingBtn) {
                            if (newState) {
                                matchingBtn.classList.add("completed");
                                matchingBtn.querySelector(".btn-complete-text").textContent = "✓ Hoàn thành";
                            } else {
                                matchingBtn.classList.remove("completed");
                                matchingBtn.querySelector(".btn-complete-text").textContent = "Hoàn thành";
                            }
                            originalMainHtml = tempDiv.innerHTML;
                        }
                    }

                    // 2. Gọi Backend Update
                    try {
                        const token = QNS_AUTH.getToken();
                        if (!token) throw new Error("Chưa đăng nhập");
                        await API.request(newState ? 'progress.complete' : 'progress.uncomplete', {
                            token: token,
                            lessonId: lessonId
                        });
                    } catch(err) {
                        console.error("Lỗi đồng bộ tiến độ chi tiết:", err);
                        if (err && err.code === 'UNAUTHENTICATED') return;
                        window.showAppAlert({type: 'error', title: 'Lỗi', message: 'Không thể đồng bộ trạng thái: ' + err.message});
                        // Tự động Rollback UI nếu cần...
                    }
                };
            }
        };

        // Hàm gắn lại sự kiện cho các nút Hoàn thành ngoài danh sách (Tích hợp Backend Giai đoạn 8)
        function rebindCompletionButtons() {
            const completeButtons = document.querySelectorAll(".btn-complete");
            completeButtons.forEach(function (btn) {
                const lessonItem = btn.closest('.lesson-item');
                const lessonId = lessonItem ? lessonItem.getAttribute('data-schedule-id') : null;
                if (!lessonId) return;

                const textSpan = btn.querySelector(".btn-complete-text");

                // Cập nhật DOM từ Cache
                const isCompleted = window.QNS_STORE.progress && window.QNS_STORE.progress.includes(lessonId);
                if (isCompleted) {
                    btn.classList.add("completed");
                    textSpan.textContent = "✓ Hoàn thành";
                } else {
                    btn.classList.remove("completed");
                    textSpan.textContent = "Hoàn thành";
                }

                // Xóa listener cũ và gán listener gọi API
                btn.onclick = async function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    const isCurrentlyCompleted = btn.classList.contains("completed");
                    const newState = !isCurrentlyCompleted;

                    // 1. Optimistic UI Update (Cập nhật giao diện trước)
                    if (newState) {
                        btn.classList.add("completed");
                        textSpan.textContent = "✓ Hoàn thành";
                        if (!window.QNS_STORE.progress.includes(lessonId)) window.QNS_STORE.progress.push(lessonId);
                    } else {
                        btn.classList.remove("completed");
                        textSpan.textContent = "Hoàn thành";
                        window.QNS_STORE.progress = window.QNS_STORE.progress.filter(id => id !== lessonId);
                    }
                    
                    if (typeof updateCourseProgress === 'function') updateCourseProgress();
                    if (typeof applyCourseFilters === 'function') applyCourseFilters();

                    // 2. Gọi Backend
                    try {
                        const token = QNS_AUTH.getToken();
                        if (!token) throw new Error("Yêu cầu đăng nhập");
                        const res = await API.request(newState ? 'progress.complete' : 'progress.uncomplete', {
                            token: token,
                            lessonId: lessonId
                        });
                        if (!res) throw new Error("Máy chủ không phản hồi");
                    } catch(err) {
                        console.error("Lỗi đồng bộ tiến độ:", err);
                        if (err && err.code === 'UNAUTHENTICATED') return;
                        window.showAppAlert({type: 'error', title: 'Lỗi', message: 'Không thể đồng bộ tiến độ với máy chủ: ' + err.message});
                        
                        // Rollback nếu gọi API thất bại
                        if (!newState) {
                            btn.classList.add("completed");
                            textSpan.textContent = "✓ Hoàn thành";
                            if (!window.QNS_STORE.progress.includes(lessonId)) window.QNS_STORE.progress.push(lessonId);
                        } else {
                            btn.classList.remove("completed");
                            textSpan.textContent = "Hoàn thành";
                            window.QNS_STORE.progress = window.QNS_STORE.progress.filter(id => id !== lessonId);
                        }
                        if (typeof updateCourseProgress === 'function') updateCourseProgress();
                        if (typeof applyCourseFilters === 'function') applyCourseFilters();
                    }
                };
            });
            
            if (typeof applyCourseFilters === 'function') applyCourseFilters();
            if (typeof updateCourseProgress === 'function') updateCourseProgress();
        }

        // Hàm khôi phục toàn bộ sự kiện của giao diện danh sách khóa học (Giải quyết Lỗi 11)
        window.rebindCourseHomeEvents = function() {
            bindAllLessonEvents();
            rebindCompletionButtons();
            
            const searchInput = document.getElementById("course-search-input");
            const filterSelect = document.getElementById("course-filter-select");
            if (searchInput) searchInput.oninput = window.applyCourseFilters;
            if (filterSelect) filterSelect.onchange = window.applyCourseFilters;
            
            const chapterHeaders = document.querySelectorAll(".chapter-card .chapter-header");
            chapterHeaders.forEach((header) => {
                header.onclick = function(e) {
                    if (e.target.closest("a, button:not(.chapter-toggle)")) return;
                    const chapterCard = this.closest(".chapter-card");
                    if (chapterCard && typeof window.toggleChapter === "function") {
                        window.toggleChapter(chapterCard);
                    }
                };
            });
            
            if (typeof window.updateCourseScheduleUI === 'function') window.updateCourseScheduleUI();
            if (typeof window.updateCourseProgress === 'function') window.updateCourseProgress();
            if (typeof window.applyCourseFilters === 'function') window.applyCourseFilters();
        };

        // ============================================================
        // TỰ ĐỘNG CẬP NHẬT BIỂU TƯỢNG VÀ BẮT SỰ KIỆN CARD BÀI HỌC
        // ============================================================
        function applyDynamicIconsToCards() {
            document.querySelectorAll('.lessons-list .lesson-item').forEach(item => {
                const rawType = item.getAttribute('data-type');
                const config = getLessonTypeConfig(rawType);

                // Gán lại Type ID chuẩn trên DOM Element
                item.setAttribute('data-type', config.id);

                // Tìm hoặc tạo mới khối icon wrapper
                let iconWrapper = item.querySelector('.lesson-icon-wrapper');
                if (!iconWrapper) {
                    iconWrapper = document.createElement('div');
                    item.insertBefore(iconWrapper, item.firstElementChild);
                }

                // Gắn class chuẩn và thẻ icon Font Awesome 6
                iconWrapper.className = `lesson-icon-wrapper ${config.cssClass}`;
                iconWrapper.innerHTML = `<i class="fa-solid ${config.icon}"></i>`;
            });
        }

        function bindAllLessonEvents() {
            // Theo dõi ID đã gặp để phát hiện ID trùng trong cùng một lần quét danh sách
            const seenLessonIds = new Set();
            // Tự động quét và vẽ đúng biểu tượng cho mọi Card bài học hiện có
            applyDynamicIconsToCards();

            document.querySelectorAll('.lessons-list .lesson-item').forEach(item => {
                const actionBtn = item.querySelector('.btn-action');
                if (!actionBtn) return;

                const lessonTitle = item.querySelector('.lesson-title').textContent;
                const lessonMeta = item.querySelector('.lesson-meta').textContent;
                const lessonType = item.getAttribute('data-type') || 'lesson';
                // ID bài học PHẢI khớp với `id` của bài học đã lưu (ví dụ sample_1, lesson_<timestamp>)
                // [BACKEND-TODO] Khi có API, ID này sẽ là mã bài học do máy chủ cấp.
                const lessonId = (item.getAttribute('data-schedule-id') || '').trim();
                if (!lessonId || seenLessonIds.has(lessonId)) {
                    // Không dùng ID giả: chặn mở bài để tránh ghi nhầm/ghi đè dữ liệu giữa các bài
                    console.warn('[LESSON-ID] Thẻ bài học thiếu hoặc trùng data-schedule-id, đã chặn mở bài:', lessonId || '(trống)', item);
                    actionBtn.addEventListener('click', function(e) {
                        if (actionBtn.classList.contains('disabled')) return;
                        e.preventDefault();
                        window.showAppAlert({
                            type: 'error',
                            title: 'Không thể mở bài học',
                            message: 'Không xác định được mã bài học nên chưa thể mở bài này. Vui lòng liên hệ giáo viên hoặc quản trị viên.'
                        });
                    });
                    return;
                }
                seenLessonIds.add(lessonId);
                let attachmentType = item.getAttribute('data-attachment-type');

                // Nếu không khai báo data-attachment-type rõ ràng là pdf, mặc định hiển thị biểu tượng tài liệu chung (fa-file-lines)
                if (!attachmentType) {
                    attachmentType = (lessonType === 'pdf' && item.getAttribute('data-attachment-type') === 'pdf') ? 'pdf' : 'document';
                }

                const originalHref = actionBtn.getAttribute('href');

                actionBtn.addEventListener('click', function(e) {
                    if (actionBtn.classList.contains('disabled')) return;
                    e.preventDefault();
                    // [QNS_UI] Spinner ngay tại nút, khóa theo từng bài học (bài khác vẫn bấm được)
                    QNS_UI.run({
                        key: 'lesson.open:' + lessonId,
                        btn: actionBtn,
                        label: 'Đang mở bài học...',
                        silentBusy: true,
                        toast: { error: 'Không thể mở bài học. Vui lòng thử lại.' }
                    }, function () {
                        return openLessonDetail(lessonId, lessonType, lessonTitle, lessonMeta, '', originalHref, attachmentType);
                    });
                });
            });
        }

        // ============================================================
        // SỰ KIỆN MODAL NỘP BÀI CỦA HỌC SINH & QUẢN LÝ DANH SÁCH FILE CARD
        // ============================================================
        let selectedSubmissionFiles = [];

        const dropzoneArea = document.getElementById('dropzone-area');
        const fileInput = document.getElementById('submission-file-input');
        const cardsContainer = document.getElementById('selected-files-cards-container');

        document.getElementById('close-submission-modal')?.addEventListener('click', () => {
            document.getElementById('submission-modal').classList.remove('active');
        });

        document.getElementById('btn-cancel-submission')?.addEventListener('click', () => {
            document.getElementById('submission-modal').classList.remove('active');
        });

        if (dropzoneArea && fileInput) {
            dropzoneArea.addEventListener('click', () => fileInput.click());

            // Hỗ trợ kéo thả tệp (Drag and Drop)
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzoneArea.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzoneArea.style.borderColor = 'var(--primary-color)';
                    dropzoneArea.style.backgroundColor = 'var(--primary-light)';
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzoneArea.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzoneArea.style.borderColor = 'var(--border-color)';
                    dropzoneArea.style.backgroundColor = '#f8f9fa';
                }, false);
            });

            dropzoneArea.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files) {
                    handleNewSelectedFiles(dt.files);
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', function() {
                if (this.files && this.files.length > 0) {
                    handleNewSelectedFiles(this.files);
                    this.value = ''; // Reset input để có thể chọn lại cùng một file nếu muốn
                }
            });
        }

        function handleNewSelectedFiles(incomingFiles) {
            if (window.qnsSubmitBusy) {
                window.showAppAlert({ type: 'info', title: 'Đang nộp bài', message: 'Vui lòng chờ hệ thống nộp bài xong rồi mới thay đổi danh sách tệp.' });
                return;
            }
            const activeLessonId = window.currentActiveLessonId;
            const allLessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
            const currentLessonObj = allLessons.find(l => l.id === activeLessonId);

            const newFilesArray = [...selectedSubmissionFiles];
            for (let i = 0; i < incomingFiles.length; i++) {
                const file = incomingFiles[i];
                const isDuplicate = newFilesArray.some(f => f.name === file.name && f.size === file.size);
                if (!isDuplicate) {
                    newFilesArray.push(file);
                }
            }

            // Kiểm tra cấu hình cài đặt giới hạn và định dạng trước khi hiển thị thẻ tệp
            if (currentLessonObj && typeof window.validateSubmissionSettings === 'function') {
                const validation = window.validateSubmissionSettings(currentLessonObj, newFilesArray);
                if (!validation.valid) {
                    window.showAppAlert({ type: 'warning', title: 'Không thể thêm tệp', message: validation.error });
                    return;
                }
            }

            selectedSubmissionFiles = newFilesArray;
            window.selectedFilesLessonId = activeLessonId; // [LỖI 18] Biết danh sách tệp đang chọn thuộc bài nào
            renderSelectedFilesCards();
        }

        function removeSelectedFile(index) {
            selectedSubmissionFiles.splice(index, 1);
            renderSelectedFilesCards();
        }

        function renderSelectedFilesCards() {
            if (!cardsContainer) return;

            if (selectedSubmissionFiles.length === 0) {
                cardsContainer.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 8px;">Chưa chọn tệp nào.</div>';
                return;
            }

            cardsContainer.innerHTML = selectedSubmissionFiles.map((file, index) => {
                const fileConfig = getUploadedFileType(file);
                return `
                    <div class="attachment-card" style="margin-top: 0; padding: 10px 14px;">
                        <div class="attachment-info">
                            <div class="attachment-icon-wrapper ${fileConfig.cssClass}" style="width: 42px; height: 42px; min-width: 42px; min-height: 42px; font-size: 20px;">
                                <i class="fa-solid ${fileConfig.icon}"></i>
                            </div>
                            <div style="min-width: 0; flex-grow: 1;">
                                <div class="attachment-name">${window.qnsEscapeHtml(file.name)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
                                    ${fileConfig.formatName} · ${fileConfig.sizeStr}
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn-remove-selected-file" onclick="window.removeSubmissionFile(${index})" title="Xóa tệp này">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }

        // Đưa hàm xóa ra window để gọi trực tiếp từ sự kiện onclick template string
        window.removeSubmissionFile = function(index) {
            if (window.qnsSubmitBusy) return;
            removeSelectedFile(index);
        };

        // ============================================================
        // HỆ THỐNG HỘP THOẠI DÙNG CHUNG (ALERT, CONFIRM, PROMPT)
        // ============================================================
        window.showAppAlert = function(options) {
            if (QNS_AUTH.isSessionInvalidated() && options && options.type === 'error') return Promise.resolve(true);
            return new Promise((resolve) => {
                const overlay = document.getElementById('app-dialog-overlay');
                const iconWrapper = document.getElementById('app-dialog-icon-wrapper');
                const iconI = document.getElementById('app-dialog-icon-i');
                const titleEl = document.getElementById('app-dialog-title');
                const bodyEl = document.getElementById('app-dialog-body');
                const extraContainer = document.getElementById('app-dialog-extra-content');
                const btnCancel = document.getElementById('app-dialog-btn-cancel');
                const btnConfirm = document.getElementById('app-dialog-btn-confirm');

                const type = options.type || 'info'; // success, warning, error, info
                titleEl.textContent = options.title || 'Thông báo';
                bodyEl.textContent = options.message || ''; // [LỖI 19] message luôn là văn bản thuần
                extraContainer.innerHTML = window.qnsSanitizeDialogHtml(options.extraHtml || ''); // [LỖI 19] chỉ giữ thẻ/thuộc tính an toàn

                iconWrapper.className = `app-dialog-icon ${type}`;
                if (type === 'success') iconI.className = 'fa-solid fa-circle-check';
                else if (type === 'warning') iconI.className = 'fa-solid fa-triangle-exclamation';
                else if (type === 'error') iconI.className = 'fa-solid fa-circle-xmark';
                else iconI.className = 'fa-solid fa-circle-info';

                btnCancel.style.display = 'none';
                btnConfirm.textContent = options.confirmText || 'Xác nhận';
                overlay.classList.add('active');

                const cleanup = () => {
                    btnConfirm.onclick = null;
                    overlay.classList.remove('active');
                    resolve(true);
                };

                btnConfirm.onclick = cleanup;
            });
        };

        window.showAppConfirm = function(options) {
            return new Promise((resolve) => {
                const overlay = document.getElementById('app-dialog-overlay');
                const iconWrapper = document.getElementById('app-dialog-icon-wrapper');
                const iconI = document.getElementById('app-dialog-icon-i');
                const titleEl = document.getElementById('app-dialog-title');
                const bodyEl = document.getElementById('app-dialog-body');
                const extraContainer = document.getElementById('app-dialog-extra-content');
                const btnCancel = document.getElementById('app-dialog-btn-cancel');
                const btnConfirm = document.getElementById('app-dialog-btn-confirm');

                titleEl.textContent = options.title || 'Xác nhận thao tác';
                bodyEl.textContent = options.message || 'Bạn có chắc chắn muốn thực hiện thao tác này không?'; // [LỖI 19] message luôn là văn bản thuần
                extraContainer.innerHTML = window.qnsSanitizeDialogHtml(options.extraHtml || ''); // [LỖI 19] chỉ giữ thẻ/thuộc tính an toàn

                iconWrapper.className = 'app-dialog-icon warning';
                iconI.className = 'fa-solid fa-triangle-exclamation';

                btnCancel.style.display = 'inline-flex';
                btnCancel.textContent = options.cancelText || 'Hủy';
                btnConfirm.textContent = options.confirmText || 'Xác nhận';
                overlay.classList.add('active');

                const handleClose = (result) => {
                    btnCancel.onclick = null;
                    btnConfirm.onclick = null;
                    overlay.classList.remove('active');
                    resolve(result);
                };

                btnCancel.onclick = () => handleClose(false);
                btnConfirm.onclick = () => handleClose(true);
            });
        };

        window.showAppPrompt = function(options) {
            return new Promise((resolve) => {
                const extraHtml = `
                    <div class="form-group" style="margin-top: 12px;">
                        <input type="text" id="app-prompt-input" class="form-input" placeholder="${window.qnsEscapeHtml(options.placeholder)}" value="${window.qnsEscapeHtml(options.defaultValue)}">
                    </div>
                `;
                window.showAppConfirm({
                    title: options.title || 'Nhập thông tin',
                    message: options.message || 'Vui lòng nhập nội dung:',
                    extraHtml: extraHtml,
                    confirmText: options.confirmText || 'Xác nhận',
                    cancelText: options.cancelText || 'Hủy'
                }).then((confirmed) => {
                    if (confirmed) {
                        const inputVal = document.getElementById('app-prompt-input')?.value || '';
                        resolve(inputVal);
                    } else {
                        resolve(null);
                    }
                });
            });
        };

        // Ghi đè alert, confirm, prompt mặc định toàn cục để an toàn tuyệt đối
        window.alert = (msg) => window.showAppAlert({ type: 'info', title: 'Thông báo', message: msg });
        window.confirm = (msg) => window.showAppConfirm({ title: 'Xác nhận', message: msg });

        // ============================================================
        // XỬ LÝ NỘP BÀI TẬP VÀ HIỂN HỘP THOẠI THÀNH CÔNG (ĐÃ SỬA LỖI ĐIỀU HƯỚNG)
        // ============================================================
        // [BACKEND-TODO] Các hàm kiểm tra điều kiện nộp bài chuẩn bị cho Backend
        window.validateSubmissionSettings = function(lessonObj, files) {
            if (!lessonObj || !lessonObj.settings || !lessonObj.settings.submission) return { valid: true, error: null };
            const subSet = lessonObj.settings.submission;
            
            if (subSet.maxFiles && files.length > subSet.maxFiles) {
                return { valid: false, error: `Bài tập này chỉ cho phép nộp tối đa ${subSet.maxFiles} tệp.` };
            }
            if (subSet.maxSizeMB) {
                const maxBytes = subSet.maxSizeMB * 1024 * 1024;
                for (let i = 0; i < files.length; i++) {
                    if (files[i].size > maxBytes) return { valid: false, error: `Tệp "${files[i].name}" vượt quá dung lượng tối đa ${subSet.maxSizeMB}MB.` };
                }
            }
            if (subSet.allowedFormats && subSet.allowedFormats.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const ft = getUploadedFileType(files[i]);
                    if (!subSet.allowedFormats.includes(ft.formatName)) return { valid: false, error: `Định dạng tệp "${ft.formatName}" không được phép. Định dạng cho phép: ${subSet.allowedFormats.join(', ')}` };
                }
            }
            return { valid: true, error: null };
        };

        // [T23] Số lần nộp CHỈ để gợi ý trên giao diện: lấy từ máy chủ (grading.getMyGrade / submission.submit), giữ trong bộ nhớ trang,
        // KHÔNG đọc/ghi LocalStorage. Máy chủ (submission.submit) mới là nơi quyết định cuối cùng (ATTEMPTS_EXCEEDED).
        window.qnsServerAttempts = window.qnsServerAttempts || {};
        window.qnsSetServerAttempts = function (lessonId, studentId, attempts) {
            const n = Number(attempts);
            window.qnsServerAttempts[String(lessonId) + '|' + String(studentId)] = (isFinite(n) && n > 0) ? n : 0;
        };
        window.qnsGetServerAttempts = function (lessonId, studentId) {
            const n = Number(window.qnsServerAttempts[String(lessonId) + '|' + String(studentId)]);
            return (isFinite(n) && n > 0) ? n : 0;
        };

        window.validateSubmissionDeadlineAndAttempts = function(lessonObj, studentId) {
            if (!lessonObj) return { valid: true, error: null, isLate: false };
            let isLate = false;
            
            if (lessonObj.settings && lessonObj.settings.schedule && lessonObj.settings.schedule.hasDueDate) {
                const sched = lessonObj.settings.schedule;
                if (sched.dueAt) {
                    const dueMs = new Date(sched.dueAt).getTime();
                    const nowMs = Date.now();
                    if (nowMs > dueMs) {
                        if (!sched.allowLateSubmission || sched.latePolicy === 'reject') {
                            return { valid: false, error: 'Đã hết hạn nộp bài. Bài tập không cho phép nộp muộn.', isLate: true };
                        }
                        isLate = true;
                    }
                }
            }

            if (lessonObj.settings && lessonObj.settings.submission) {
                const subSet = lessonObj.settings.submission;
                // [T23] Chỉ là gợi ý phía giao diện; thiếu dữ liệu (=0) thì để máy chủ quyết định
                let currentAttempts = window.qnsGetServerAttempts(lessonObj.id, studentId);
                if (currentAttempts > 0) {
                    if (!subSet.allowMultiple) {
                        return { valid: false, error: 'Bạn đã nộp bài rồi. Bài tập này không cho phép nộp lại.', isLate: isLate };
                    }
                    if (subSet.maxAttempts !== 'unlimited') {
                        const max = parseInt(subSet.maxAttempts) || 1;
                        if (currentAttempts >= max) {
                            return { valid: false, error: `Bạn đã hết số lần nộp bài (${currentAttempts}/${max} lần).`, isLate: isLate };
                        }
                    }
                }
            }
            return { valid: true, error: null, isLate: isLate };
        };

        // ============================================================
        // [GĐ2] TIẾN ĐỘ NỘP BÀI: GIAO DIỆN, UPLOAD TỪNG TỆP, THỬ LẠI, ĐỐI SOÁT
        // Tiến độ tệp = số chunk ĐÃ ĐƯỢC máy chủ xác nhận (upload.chunk -> received:true) / tổng chunk.
        // "Đã tải lên" chỉ khi upload.finish trả fileId; "Thành công" chỉ khi submission.submit
        // (hoặc submission.status) xác nhận bài nộp có đủ các fileId.
        // ============================================================
        window.qnsSubmitTracker = null;   // trạng thái lượt nộp hiện tại (giữ khi lỗi để thử lại, xóa khi thành công)
        window.qnsSubmitBusy = false;

        window.qnsFormatSubmitTime = function (iso) {
            const d = iso ? new Date(iso) : null;
            return (d && !isNaN(d.getTime())) ? d.toLocaleString('vi-VN') : '';
        };

        window.qnsSubmitMetaHtml = function (sub) {
            const attempts = Number(sub && sub.attempts) || 0;
            const when = window.qnsFormatSubmitTime(sub && sub.submittedAt);
            if (!attempts && !when) return '';
            return '<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">' +
                (attempts ? 'Lần nộp ' + window.qnsEscapeHtml(attempts) : '') +
                (attempts && when ? ' · ' : '') + window.qnsEscapeHtml(when) + '</div>';
        };

        const QNS_SUBMIT_UI = (function () {
            const STATUS_LABEL = {
                waiting: 'Đang chờ', uploading: 'Đang tải lên', processing: 'Đang xử lý', uploaded: 'Đã tải lên',
                linking: 'Đang liên kết', success: 'Thành công', failed: 'Thất bại', retrying: 'Đang thử lại'
            };
            const CONFIRMED = ['uploaded', 'linking', 'success'];
            let panel = null, tracker = null, hideTimer = null, busy = false, retryHandler = null;

            function ensureStyle() {
                if (document.getElementById('qns-sp-style')) return;
                const st = document.createElement('style');
                st.id = 'qns-sp-style';
                st.textContent = `
.qns-sp{position:fixed;right:16px;bottom:16px;width:360px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #cfe0f5;border-radius:12px;box-shadow:0 10px 30px rgba(21,101,192,.18);z-index:var(--qns-sp-z,5000);overflow:hidden;font-size:.88rem;color:#1f2937}
.qns-sp [hidden]{display:none!important}
.qns-sp[hidden]{display:none}
.qns-sp-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#e3f2fd;color:rgb(21,101,192);font-weight:700}
.qns-sp-title{flex:1;min-width:0}
.qns-sp-icon-btn{border:0;background:transparent;color:inherit;cursor:pointer;width:30px;height:30px;border-radius:6px;font-size:.95rem}
.qns-sp-icon-btn:hover:not(:disabled){background:rgba(21,101,192,.12)}
.qns-sp-icon-btn:disabled{opacity:.4;cursor:not-allowed}
.qns-sp-body{padding:12px}
.qns-sp.is-collapsed .qns-sp-body{display:none}
.qns-sp-msg{margin-bottom:10px;line-height:1.4}
.qns-sp-msg[data-kind="ok"]{color:#15803d;font-weight:600}
.qns-sp-msg[data-kind="warn"]{color:#b45309}
.qns-sp-msg[data-kind="error"]{color:#b91c1c}
.qns-sp-bar{height:8px;background:#e5eaf2;border-radius:99px;overflow:hidden}
.qns-sp-fill{height:100%;width:0;background:rgb(21,101,192);border-radius:99px;transition:width .25s ease}
.qns-sp-overall-text{margin:6px 0 10px;font-size:.8rem;color:#64748b}
.qns-sp-list{list-style:none;margin:0;padding:0;max-height:40vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.qns-sp-item{border:1px solid #e5eaf2;border-radius:8px;padding:8px 10px;background:#f8fbff}
.qns-sp-row{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.qns-sp-name{font-weight:600;word-break:break-all;min-width:0}
.qns-sp-size{color:#64748b;font-size:.75rem;white-space:nowrap}
.qns-sp-item .qns-sp-bar{margin:6px 0 4px}
.qns-sp-status{font-size:.78rem;font-weight:600;color:rgb(21,101,192)}
.qns-sp-pct{font-size:.78rem;color:#64748b;text-align:right}
.qns-sp-err{margin-top:4px;font-size:.78rem;color:#b91c1c;line-height:1.35}
.qns-sp-item[data-state="waiting"] .qns-sp-status{color:#64748b}
.qns-sp-item[data-state="uploaded"] .qns-sp-status,.qns-sp-item[data-state="success"] .qns-sp-status{color:#15803d}
.qns-sp-item[data-state="uploaded"] .qns-sp-fill,.qns-sp-item[data-state="success"] .qns-sp-fill{background:#16a34a}
.qns-sp-item[data-state="retrying"] .qns-sp-status,.qns-sp-item[data-state="processing"] .qns-sp-status{color:#d97706}
.qns-sp-item[data-state="retrying"] .qns-sp-fill,.qns-sp-item[data-state="processing"] .qns-sp-fill{background:#f59e0b}
.qns-sp-item[data-state="failed"]{border-color:#fca5a5;background:#fef2f2}
.qns-sp-item[data-state="failed"] .qns-sp-status{color:#b91c1c}
.qns-sp-item[data-state="failed"] .qns-sp-fill{background:#dc2626}
.qns-sp-btn{border:1px solid rgb(21,101,192);background:#fff;color:rgb(21,101,192);border-radius:8px;padding:8px 14px;min-height:38px;font-weight:600;cursor:pointer}
.qns-sp-btn.primary{background:rgb(21,101,192);color:#fff}
.qns-sp-btn:disabled{opacity:.5;cursor:not-allowed}
.qns-sp-actions{margin-top:10px;display:flex;justify-content:flex-end}
.qns-sp-retry-one{margin-top:6px}
@media (max-width:600px){.qns-sp{left:8px;right:8px;bottom:8px;width:auto;max-width:none}.qns-sp-list{max-height:32vh}}`;
                document.head.appendChild(st);
            }

            function onPanelClick(e) {
                const el = e.target && e.target.closest ? e.target.closest('[data-sp]') : null;
                if (!el || el.disabled) return;
                const act = el.getAttribute('data-sp');
                if (act === 'toggle') panel.classList.toggle('is-collapsed');
                else if (act === 'close') { if (!busy) hide(); }
                else if (act === 'retry') { if (!busy && retryHandler) retryHandler(null); }
                else if (act === 'retry-one') { if (!busy && retryHandler) retryHandler(Number(el.getAttribute('data-idx'))); }
            }

            function ensurePanel() {
                if (panel) return panel;
                ensureStyle();
                panel = document.createElement('div');
                panel.id = 'qns-submit-panel';
                panel.className = 'qns-sp';
                panel.hidden = true;
                panel.innerHTML =
                    '<div class="qns-sp-head"><i class="fa-solid fa-cloud-arrow-up"></i><span class="qns-sp-title" data-role="title">Đang nộp bài...</span>' +
                    '<button type="button" class="qns-sp-icon-btn" data-sp="toggle" aria-label="Thu gọn hoặc mở rộng"><i class="fa-solid fa-minus"></i></button>' +
                    '<button type="button" class="qns-sp-icon-btn" data-sp="close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button></div>' +
                    '<div class="qns-sp-body"><div class="qns-sp-msg" data-role="msg" data-kind="info" aria-live="polite"></div>' +
                    '<div class="qns-sp-bar"><div class="qns-sp-fill" data-role="overall-fill"></div></div>' +
                    '<div class="qns-sp-overall-text" data-role="overall-text"></div>' +
                    '<ul class="qns-sp-list" data-role="list"></ul>' +
                    '<div class="qns-sp-actions" data-role="actions" hidden><button type="button" class="qns-sp-btn primary" data-sp="retry" data-role="retry-btn">Thử lại</button></div></div>';
                document.body.appendChild(panel);
                panel.addEventListener('click', onPanelClick);
                return panel;
            }

            function q(role) { return panel ? panel.querySelector('[data-role="' + role + '"]') : null; }

            function itemPercent(it) {
                if (['processing', 'uploaded', 'linking', 'success'].indexOf(it.status) !== -1) return 100;
                if (it.total > 0 && it.done) return Math.min(100, Math.round(it.done.size * 100 / it.total));
                return 0;
            }

            function itemHtml(it) {
                return '<li class="qns-sp-item" data-idx="' + it.idx + '" data-state="waiting">' +
                    '<div class="qns-sp-row"><span class="qns-sp-name">' + window.qnsEscapeHtml(it.name) + '</span><span class="qns-sp-size">' + window.qnsEscapeHtml(it.sizeStr) + '</span></div>' +
                    '<div class="qns-sp-bar"><div class="qns-sp-fill"></div></div>' +
                    '<div class="qns-sp-row"><span class="qns-sp-status"></span><span class="qns-sp-pct"></span></div>' +
                    '<div class="qns-sp-err" hidden></div>' +
                    '<button type="button" class="qns-sp-btn qns-sp-retry-one" data-sp="retry-one" data-idx="' + it.idx + '" hidden>Thử lại tệp này</button></li>';
            }

            function renderItem(it) {
                const list = q('list');
                const li = list ? list.querySelector('li[data-idx="' + it.idx + '"]') : null;
                if (!li) return;
                const pct = itemPercent(it);
                li.setAttribute('data-state', it.status);
                li.querySelector('.qns-sp-fill').style.width = pct + '%';
                let label = STATUS_LABEL[it.status] || it.status;
                if ((it.status === 'uploading' || it.status === 'retrying') && it.total > 1) label += ' (' + it.done.size + '/' + it.total + ' phần)';
                li.querySelector('.qns-sp-status').textContent = label;
                li.querySelector('.qns-sp-pct').textContent = it.status === 'processing' ? '100% · chờ máy chủ xác nhận' : pct + '%';
                const errEl = li.querySelector('.qns-sp-err');
                errEl.textContent = it.error || '';
                errEl.hidden = !it.error;
                const btn = li.querySelector('.qns-sp-retry-one');
                btn.hidden = !(it.status === 'failed' && it.retryable);
                btn.disabled = busy;
            }

            function updateOverall() {
                if (!panel || !tracker) return;
                const items = tracker.items, n = items.length;
                const fill = q('overall-fill'), txt = q('overall-text');
                if (n === 0) { fill.style.width = '0%'; txt.textContent = 'Không có tệp đính kèm.'; return; }
                const sum = items.reduce(function (s, it) { return s + itemPercent(it); }, 0);
                const confirmed = items.filter(function (it) { return CONFIRMED.indexOf(it.status) !== -1; }).length;
                const allSuccess = items.every(function (it) { return it.status === 'success'; });
                let pct = Math.round(sum / n);
                if (!allSuccess) pct = Math.min(pct, 99);   // chưa được 100% khi bài nộp chưa được máy chủ xác nhận
                fill.style.width = pct + '%';
                txt.textContent = allSuccess ? ('Đã nộp ' + n + '/' + n + ' tệp') : ('Đã tải lên ' + confirmed + '/' + n + ' tệp · ' + pct + '%');
            }

            function open(tr) {
                ensurePanel();
                if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                if (tracker !== tr) {
                    tracker = tr;
                    q('list').innerHTML = tr.items.map(itemHtml).join('');
                }
                tr.items.forEach(renderItem);
                updateOverall();
                panel.hidden = false;
                panel.classList.remove('is-collapsed');
                setBusy(busy);
            }

            function hide() {
                if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                if (panel) panel.hidden = true;
            }

            function updateItem(it) {
                if (!panel || !tracker || tracker.items[it.idx] !== it) return;
                renderItem(it);
                updateOverall();
            }

            function setMessage(text, kind) {
                if (!panel) return;
                const k = kind || 'info';
                const m = q('msg');
                m.textContent = text;
                m.setAttribute('data-kind', k);
                q('title').textContent = k === 'ok' ? 'Nộp bài thành công' : ((k === 'warn' || k === 'error') ? 'Nộp bài chưa hoàn tất' : 'Đang nộp bài...');
            }

            function showRetry(show, label) {
                if (!panel) return;
                q('actions').hidden = !show;
                if (label) q('retry-btn').textContent = label;
            }

            function setBusy(b) {
                busy = !!b;
                if (!panel) return;
                panel.querySelectorAll('[data-sp="close"],[data-sp="retry"],[data-sp="retry-one"]').forEach(function (btn) { btn.disabled = busy; });
            }

            function autoHide(ms) {
                if (hideTimer) clearTimeout(hideTimer);
                hideTimer = setTimeout(function () { hideTimer = null; if (!busy) hide(); }, ms);
            }

            return {
                open: open, hide: hide, updateItem: updateItem, setMessage: setMessage, showRetry: showRetry,
                setBusy: setBusy, autoHide: autoHide,
                onRetry: function (fn) { retryHandler = fn; }
            };
        })();

        function qnsSpSleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

        function qnsSpMakeError(code, message, retryable) {
            const e = new Error(message);
            e.code = code;
            e.retryable = !!retryable;
            return e;
        }

        function qnsSpReadDataUrl(file) {
            return new Promise(function (resolve, reject) {
                const reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = function () { reject(qnsSpMakeError('FILE_UNREADABLE', 'Không đọc được tệp "' + file.name + '". Hãy xóa tệp rồi chọn lại.', false)); };
                reader.readAsDataURL(file);
            });
        }

        // Nhóm A (retryable): lỗi tạm thời. Nhóm B: học sinh phải xử lý, KHÔNG cho thử lại.
        function qnsSpDescribeError(err) {
            const code = (err && err.code) || 'UNKNOWN';
            const msg = (err && err.message) ? String(err.message) : '';
            switch (code) {
                case 'NETWORK_ERROR': return { message: 'Mất kết nối hoặc máy chủ không phản hồi. Hãy kiểm tra mạng rồi thử lại.', retryable: true };
                case 'SERVER_BUSY': return { message: 'Hệ thống đang bận. Vui lòng thử lại sau ít giây.', retryable: true };
                case 'UPLOAD_EXPIRED': return { message: 'Phiên tải tệp đã hết hạn. Bấm "Thử lại" để tải lại tệp này.', retryable: true };
                case 'INTERNAL': return { message: 'Máy chủ gặp lỗi tạm thời. Vui lòng thử lại.', retryable: true };
                case 'CHUNK_NOT_CONFIRMED':
                case 'FINISH_NOT_CONFIRMED':
                case 'BEGIN_FAILED': return { message: msg || 'Máy chủ chưa xác nhận dữ liệu. Vui lòng thử lại.', retryable: true };
                case 'DEADLINE_PASSED':
                case 'ATTEMPTS_EXCEEDED':
                case 'ACCESS_CLOSED':
                case 'ACCESS_NOT_OPEN':
                case 'FORBIDDEN':
                case 'NOT_FOUND':
                case 'CONFLICT':
                case 'FILE_UNREADABLE':
                case 'VALIDATION_FAILED': return { message: msg || 'Không đủ điều kiện nộp bài.', retryable: false };
                default: return { message: msg || 'Đã xảy ra lỗi không xác định.', retryable: !!(err && err.retryable === true) };
            }
        }

        function qnsSpSetItem(it, status, extra) {
            it.status = status;
            if (extra) Object.assign(it, extra);
            QNS_SUBMIT_UI.updateItem(it);
        }

        function qnsSpCreateTracker(requestId, opts) {
            return {
                requestId: requestId,
                lessonId: opts.lesson.id,
                note: opts.note || '',
                needVerify: false,
                stagedChecked: false,
                items: (opts.files || []).map(function (f, i) {
                    return {
                        idx: i, file: f, name: f.name, size: f.size, sizeStr: formatFileSize(f.size),
                        status: 'waiting', done: new Set(), total: 0, uploadId: null,
                        result: null, error: '', retryable: false, failCount: 0
                    };
                })
            };
        }

        // Tái dùng tệp đã upload xong ở lần thử trước (cùng tên + dung lượng), tránh tạo tệp Drive trùng
        async function qnsSpApplyStaged(tr) {
            const pending = tr.items.filter(function (it) { return !it.result; });
            if (!pending.length) return;
            try {
                const sr = await API.request('upload.listStaged', { lessonId: tr.lessonId });
                const staged = (sr && Array.isArray(sr.files)) ? sr.files : [];
                const used = new Set();
                pending.forEach(function (it) {
                    const idx = staged.findIndex(function (s, j) { return !used.has(j) && s.name === it.name && Number(s.sizeBytes) === it.size; });
                    if (idx >= 0) {
                        used.add(idx);
                        qnsSpSetItem(it, 'uploaded', { result: staged[idx], error: '', retryable: false });
                    }
                });
            } catch (e) {
                if (e && e.code === 'UNAUTHENTICATED') throw e;   // lỗi khác: bỏ qua, upload bình thường
            }
        }

        async function qnsSpUploadOne(tr, it) {
            const file = it.file;
            const formatName = getUploadedFileType(file).formatName;
            qnsSpSetItem(it, it.failCount > 0 ? 'retrying' : 'uploading', { error: '', retryable: false });
            try {
                const CHUNK = 1024 * 1024;
                let uploadId = null, total = 0, chunkSize = CHUNK;
                let done = new Set();

                // Phục hồi phiên cũ: chỉ gửi bù các chunk máy chủ chưa có
                if (it.uploadId) {
                    try {
                        const st = await window.qnsRequestWithRetry('upload.status', { uploadId: it.uploadId }, 2, true);
                        if (st && (st.status === 'completed' || (st.status === 'pending' && !st.expired))) {
                            uploadId = it.uploadId;
                            total = Number(st.expectedChunks) || 0;
                            const missing = new Set((st.missingChunks || []).map(Number));
                            for (let i = 0; i < total; i++) { if (st.status === 'completed' || !missing.has(i)) done.add(i); }
                        }
                    } catch (e) {
                        if (e && e.code === 'UNAUTHENTICATED') throw e;
                    }
                    if (!uploadId) it.uploadId = null;
                }

                if (!uploadId) {
                    const expected = Math.ceil(Math.ceil(file.size / 3) * 4 / CHUNK);   // cùng công thức với upload.begin ở máy chủ
                    const begin = await window.qnsRequestWithRetry('upload.begin', {
                        lessonId: tr.lessonId, fileName: file.name, fileSize: file.size,
                        mimeType: file.type, formatName: formatName, expectedChunks: expected
                    }, 2, false);
                    if (!begin || !begin.uploadId) throw qnsSpMakeError('BEGIN_FAILED', 'Không thể khởi tạo phiên tải tệp.', true);
                    uploadId = begin.uploadId;
                    it.uploadId = uploadId;
                    total = Number(begin.expectedChunks) || expected;
                    chunkSize = Number(begin.chunkSize) || CHUNK;
                }
                if (total < 1) throw qnsSpMakeError('BEGIN_FAILED', 'Phiên tải tệp không hợp lệ.', true);

                it.done = done;
                it.total = total;
                qnsSpSetItem(it, it.status);

                if (done.size < total) {
                    const dataUrl = await qnsSpReadDataUrl(file);
                    const base64 = String(dataUrl).split(';base64,')[1] || '';
                    if (!base64) throw qnsSpMakeError('FILE_UNREADABLE', 'Không đọc được nội dung tệp "' + file.name + '". Hãy xóa tệp rồi chọn lại.', false);
                    for (let c = 0; c < total; c++) {
                        if (done.has(c)) continue;
                        const r = await window.qnsRequestWithRetry('upload.chunk', {
                            uploadId: uploadId, chunkIndex: c, data: base64.substring(c * chunkSize, (c + 1) * chunkSize)
                        }, 4, true);
                        if (!r || !r.received) throw qnsSpMakeError('CHUNK_NOT_CONFIRMED', 'Máy chủ chưa xác nhận phần ' + (c + 1) + '/' + total + ' của tệp.', true);
                        done.add(c);   // chỉ tính khi máy chủ đã xác nhận
                        qnsSpSetItem(it, it.status);
                    }
                }

                qnsSpSetItem(it, 'processing');   // đã gửi đủ, chờ máy chủ ghép và lưu
                const fin = await window.qnsRequestWithRetry('upload.finish', {
                    uploadId: uploadId, fileName: file.name, mimeType: file.type, formatName: formatName
                }, 3, true);
                if (!fin || !fin.fileId) throw qnsSpMakeError('FINISH_NOT_CONFIRMED', 'Máy chủ chưa xác nhận đã lưu tệp.', true);
                qnsSpSetItem(it, 'uploaded', { result: fin, error: '', retryable: false });
            } catch (err) {
                if (err && err.code === 'UNAUTHENTICATED') throw err;   // đã chuyển trang đăng nhập, dừng cả luồng
                console.error('[GĐ2] Upload thất bại:', file.name, err);
                const info = qnsSpDescribeError(err);
                it.failCount++;
                if (err && err.code === 'UPLOAD_EXPIRED') it.uploadId = null;
                if (!info.retryable) it.uploadId = null;
                if (info.retryable && it.failCount >= 5) {
                    info.retryable = false;
                    info.message += ' Đã thử lại nhiều lần không được, hãy xóa tệp rồi chọn lại hoặc liên hệ giáo viên.';
                }
                qnsSpSetItem(it, 'failed', { error: info.message, retryable: info.retryable });
            }
        }

        function qnsSpReportFailures(tr) {
            const ui = QNS_SUBMIT_UI;
            const failed = tr.items.filter(function (it) { return !it.result; });
            const ok = tr.items.length - failed.length;
            const anyRetry = failed.some(function (it) { return it.retryable; });
            ui.setMessage(failed.length + '/' + tr.items.length + ' tệp chưa tải lên được. ' + ok + ' tệp đã tải lên thành công được giữ nguyên, không phải tải lại. ' +
                (anyRetry ? 'Bấm "Thử lại" để tải lại các tệp lỗi.' : 'Hãy xóa tệp lỗi khỏi danh sách rồi chọn lại.'), 'error');
            ui.showRetry(anyRetry, 'Thử lại tệp lỗi');
        }

        function qnsSpNormalizeInterrupted(tr) {
            tr.items.forEach(function (it) {
                if (it.result) { if (it.status !== 'success') qnsSpSetItem(it, 'uploaded'); return; }
                if (['uploading', 'processing', 'linking', 'retrying'].indexOf(it.status) !== -1) {
                    qnsSpSetItem(it, 'failed', { error: 'Bị gián đoạn. Bấm "Thử lại" để tiếp tục.', retryable: true });
                }
            });
        }

        // Đối soát: kết quả (nếu có) của đúng requestId này. Trả dữ liệu bài nộp hoặc null.
        async function qnsSpVerify(tr) {
            for (let i = 0; i < 3; i++) {
                try {
                    const st = await API.request('submission.status', { lessonId: tr.lessonId, requestId: tr.requestId });
                    if (st && st.found && st.result && st.result.success && st.result.data) return st.result.data;
                } catch (e) {
                    if (e && e.code === 'UNAUTHENTICATED') throw e;
                }
                if (i < 2) await qnsSpSleep(1500 * (i + 1));
            }
            return null;
        }

        async function qnsSpComplete(tr, data) {
            const ui = QNS_SUBMIT_UI;
            const serverFiles = Array.isArray(data && data.files) ? data.files : [];
            const missing = tr.items.filter(function (it) {
                return !serverFiles.some(function (f) { return String(f.fileId) === String(it.result.fileId); });
            });
            if (missing.length) {
                tr.needVerify = true;
                tr.items.forEach(function (it) { qnsSpSetItem(it, 'uploaded'); });
                ui.setMessage('Máy chủ chưa xác nhận đủ các tệp trong bài nộp. Bấm "Kiểm tra lại" để đối soát.', 'warn');
                ui.showRetry(true, 'Kiểm tra lại');
                return false;
            }

            tr.items.forEach(function (it) { qnsSpSetItem(it, 'success', { error: '', retryable: false }); });
            ui.setMessage('Nộp bài thành công! Bài nộp đã được máy chủ xác nhận.', 'ok');
            ui.showRetry(false);

            window.qnsClearSubmitRequestId();
            window.qnsSubmitTracker = null;
            window.qnsSetServerAttempts(tr.lessonId, currentStudentId, data && data.attempts);

            selectedSubmissionFiles = [];
            window.selectedFilesLessonId = null;
            renderSelectedFilesCards();
            const noteEl = document.getElementById('submission-note');
            if (noteEl) noteEl.value = '';
            const modalEl = document.getElementById('submission-modal');
            if (modalEl) modalEl.classList.remove('active');
            ui.autoHide(6000);

            // Làm mới từ Backend (grading.getMyGrade), không dựa vào biến tạm
            const act = window.currentActiveLesson;
            if (act && String(act.id) === String(tr.lessonId) && typeof window.openLessonDetail === 'function') {
                try {
                    await window.openLessonDetail(act.id, act.type, act.title, act.meta, act.desc, act.link, act.attachmentType);
                } catch (e) { console.error('[GĐ2] Không làm mới được chi tiết bài học:', e); }
            }
            return true;
        }

        async function qnsSpFinalize(tr) {
            const ui = QNS_SUBMIT_UI;
            tr.items.forEach(function (it) { if (it.result) qnsSpSetItem(it, 'linking'); });

            let data = null;
            if (tr.needVerify) {
                ui.setMessage('Đang xác minh trạng thái nộp bài...', 'warn');
                data = await qnsSpVerify(tr);
            } else {
                ui.setMessage('Đang xác nhận bài nộp với máy chủ...', 'info');
            }

            if (!data) {
                try {
                    // Luôn dùng ĐÚNG requestId của lượt này: máy chủ trả lại kết quả cũ nếu đã xử lý, không tạo lần nộp mới
                    data = await window.qnsRequestWithRetry('submission.submit', {
                        requestId: tr.requestId,
                        lessonId: tr.lessonId,
                        fileIds: tr.items.map(function (it) { return String(it.result.fileId); }),
                        note: tr.note
                    }, 3, true);
                } catch (err) {
                    if (err && err.code === 'UNAUTHENTICATED') throw err;
                    tr.items.forEach(function (it) { qnsSpSetItem(it, 'uploaded'); });
                    const code = err && err.code;
                    if (code === 'NETWORK_ERROR' || code === 'INTERNAL' || !code) {
                        // Kết quả KHÔNG xác định: máy chủ có thể đã xử lý xong. Đối soát trước khi kết luận.
                        ui.setMessage('Đang xác minh trạng thái nộp bài...', 'warn');
                        data = await qnsSpVerify(tr);
                        if (!data) {
                            tr.needVerify = true;
                            ui.setMessage('Chưa xác định được kết quả nộp bài (có thể do mất kết nối). Các tệp đã tải lên vẫn được giữ. Bấm "Kiểm tra lại": hệ thống sẽ đối soát trước và không tạo lần nộp mới.', 'warn');
                            ui.showRetry(true, 'Kiểm tra lại');
                            return false;
                        }
                    } else {
                        tr.needVerify = false;   // lỗi nghiệp vụ rõ ràng: lần nộp này chắc chắn chưa được ghi
                        const info = qnsSpDescribeError(err);
                        ui.setMessage('Chưa thể hoàn tất nộp bài: ' + info.message + (info.retryable ? ' Bấm "Thử lại" để gửi lại.' : ''), 'error');
                        ui.showRetry(info.retryable, 'Thử lại');
                        return false;
                    }
                }
            }
            return qnsSpComplete(tr, data);
        }

        // opts: { lesson, files, note } cho lượt mới; { resume: true, only } khi bấm Thử lại trên bảng tiến độ
        async function qnsRunSubmission(opts) {
            const ui = QNS_SUBMIT_UI;
            let tr = window.qnsSubmitTracker;
            const resuming = !!(opts.resume || (tr && tr.needVerify && opts.lesson && tr.lessonId === opts.lesson.id));

            if (resuming) {
                if (!tr) return;   // không còn gì để tiếp tục
            } else {
                if (tr && tr.needVerify) {
                    await window.showAppAlert({
                        type: 'warning', title: 'Chưa xác định kết quả lần nộp trước',
                        message: 'Một lần nộp ở bài học khác chưa xác định được kết quả. Hãy bấm "Kiểm tra lại" trên bảng tiến độ trước khi nộp bài mới.'
                    });
                    ui.open(tr);
                    ui.showRetry(true, 'Kiểm tra lại');
                    return;
                }
                const requestId = window.qnsGetSubmitRequestId(opts.lesson.id, opts.files, opts.note);
                if (!tr || tr.requestId !== requestId) tr = window.qnsSubmitTracker = qnsSpCreateTracker(requestId, opts);
            }

            ui.open(tr);
            ui.showRetry(false);
            ui.setMessage('Đang chuẩn bị nộp bài...', 'info');
            const only = (typeof opts.only === 'number') ? opts.only : null;

            try {
                if (!tr.needVerify) {
                    if (!tr.stagedChecked) { await qnsSpApplyStaged(tr); tr.stagedChecked = true; }
                    const todo = tr.items.filter(function (it) {
                        return !it.result && (only === null || it.idx === only) && (it.status !== 'failed' || it.retryable);
                    });
                    if (todo.length) ui.setMessage('Đang tải tệp lên...', 'info');
                    for (let i = 0; i < todo.length; i++) { await qnsSpUploadOne(tr, todo[i]); }
                    if (tr.items.some(function (it) { return !it.result; })) { qnsSpReportFailures(tr); return; }
                }
                await qnsSpFinalize(tr);
            } catch (err) {
                if (err && err.code === 'UNAUTHENTICATED') { ui.hide(); return; }
                console.error('[GĐ2] Lỗi không mong đợi khi nộp bài:', err);
                qnsSpNormalizeInterrupted(tr);
                ui.setMessage('Đã xảy ra lỗi không mong đợi. Bấm "Thử lại" để tiếp tục; các tệp đã tải lên thành công được giữ nguyên.', 'error');
                ui.showRetry(true, 'Thử lại');
            }
        }

        function qnsSetSubmitButtonBusy(btn, isBusy) {
            if (!btn) return;
            if (isBusy) {
                if (!btn.dataset.idleHtml) btn.dataset.idleHtml = btn.innerHTML;
                btn.disabled = true;
                btn.setAttribute('aria-busy', 'true');
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Đang nộp bài...';
            } else {
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                if (btn.dataset.idleHtml) { btn.innerHTML = btn.dataset.idleHtml; delete btn.dataset.idleHtml; }
            }
        }

        // Khóa thao tác: DUY NHẤT một lượt nộp tại một thời điểm (chặn nhấn liên tục)
        async function qnsRunLocked(fn) {
            if (window.qnsSubmitBusy) return;
            window.qnsSubmitBusy = true;
            const btn = document.getElementById('btn-confirm-submission');
            qnsSetSubmitButtonBusy(btn, true);   // phản hồi tức thì, trước mọi thao tác bất đồng bộ
            QNS_SUBMIT_UI.setBusy(true);
            try {
                await fn();
            } catch (err) {
                console.error('[GĐ2] Lỗi khi nộp bài:', err);
                if (!(err && err.code === 'UNAUTHENTICATED')) {
                    await window.showAppAlert({ type: 'error', title: 'Không thể nộp bài', message: (err && err.message) ? err.message : 'Đã xảy ra lỗi không xác định.' });
                }
            } finally {
                window.qnsSubmitBusy = false;
                qnsSetSubmitButtonBusy(btn, false);
                QNS_SUBMIT_UI.setBusy(false);
            }
        }

        QNS_SUBMIT_UI.onRetry(function (onlyIdx) {
            qnsRunLocked(function () { return qnsRunSubmission({ resume: true, only: onlyIdx }); });
        });

        if (!window.qnsSubmitUnloadBound) {
            window.qnsSubmitUnloadBound = true;
            window.addEventListener('beforeunload', function (e) {
                if (window.qnsSubmitBusy) { e.preventDefault(); e.returnValue = ''; }
            });
        }

        window.qnsSubmitFlow = async function () {
            const activeLesson = window.currentActiveLesson;
            if (!activeLesson || !activeLesson.id) {
                await window.showAppAlert({ type: 'error', title: 'Không xác định được bài học', message: 'Vui lòng quay lại danh sách và mở lại bài học.' });
                return;
            }
            const allLessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
            const currentLessonObj = allLessons.find(l => l.id === activeLesson.id);
            const tr = window.qnsSubmitTracker;
            const resuming = !!(tr && tr.needVerify && tr.lessonId === activeLesson.id);   // đang đối soát: không chặn bằng kiểm tra hạn/số lần

            if (!resuming) {
                if (currentLessonObj && currentLessonObj.settings?.submission?.requireFile !== false && selectedSubmissionFiles.length === 0) {
                    await window.showAppAlert({ type: 'warning', title: 'Thiếu tệp bài làm', message: 'Bài tập này yêu cầu bạn phải đính kèm tệp bài làm!' });
                    return;
                }
                if (currentLessonObj) {
                    const fileCheck = window.validateSubmissionSettings(currentLessonObj, selectedSubmissionFiles);
                    if (!fileCheck.valid) {
                        await window.showAppAlert({ type: 'warning', title: 'Lỗi tệp bài làm', message: fileCheck.error });
                        return;
                    }
                    const timeCheck = window.validateSubmissionDeadlineAndAttempts(currentLessonObj, currentStudentId);
                    if (!timeCheck.valid) {
                        await window.showAppAlert({ type: 'error', title: 'Không thể nộp bài', message: timeCheck.error });
                        return;
                    }
                    window.currentSubmissionIsLate = timeCheck.isLate;
                } else {
                    window.currentSubmissionIsLate = false;
                }
            }

            if (!QNS_AUTH.isBackendConfigured()) {
                await window.showAppAlert({ type: 'error', title: 'Chưa kết nối máy chủ', message: 'Không thể nộp bài khi chưa cấu hình API_BASE_URL.' });
                return;
            }

            const noteText = document.getElementById('submission-note') ? document.getElementById('submission-note').value.trim() : '';
            await qnsRunSubmission({ lesson: activeLesson, files: selectedSubmissionFiles.slice(), note: noteText });
        };

        document.getElementById('btn-confirm-submission')?.addEventListener('click', function () {
            qnsRunLocked(window.qnsSubmitFlow);
        });

        // [GĐ2] Handler CŨ đã bị vô hiệu hóa (gắn vào id không tồn tại). Có thể xóa cả khối này sau khi nghiệm thu.
        document.getElementById('btn-confirm-submission-legacy-disabled')?.addEventListener('click', async function() {
            const activeLesson = window.currentActiveLesson;
            const allLessons = typeof window.getStoredLessons === 'function' ? window.getStoredLessons() : [];
            const currentLessonObj = allLessons.find(l => l.id === (activeLesson ? activeLesson.id : null));

            if (currentLessonObj && currentLessonObj.settings?.submission?.requireFile !== false && selectedSubmissionFiles.length === 0) {
                await window.showAppAlert({ type: 'warning', title: 'Thiếu tệp bài làm', message: 'Bài tập này yêu cầu bạn phải đính kèm tệp bài làm!' });
                return;
            }

            // Kiểm tra độc lập các cấu hình tệp tin, số lần nộp và thời gian của từng ID bài
            if (currentLessonObj) {
                const fileCheck = window.validateSubmissionSettings(currentLessonObj, selectedSubmissionFiles);
                if (!fileCheck.valid) {
                    await window.showAppAlert({ type: 'warning', title: 'Lỗi tệp bài làm', message: fileCheck.error });
                    return;
                }
                const timeCheck = window.validateSubmissionDeadlineAndAttempts(currentLessonObj, currentStudentId);
                if (!timeCheck.valid) {
                    await window.showAppAlert({ type: 'error', title: 'Không thể nộp bài', message: timeCheck.error });
                    return;
                }
                window.currentSubmissionIsLate = timeCheck.isLate;
            } else {
                window.currentSubmissionIsLate = false;
            }

            const noteText = document.getElementById('submission-note') ? document.getElementById('submission-note').value.trim() : '';
            
            // [LỖI 18] A. Chuẩn bị metadata: chưa tải lên nên url = null, uploadStatus = 'pending'
            let filesPayload = selectedSubmissionFiles.map(f => buildSubmissionFileMetadata(f));

            // B. Điểm tích hợp Backend
            let uploadResult = { ok: false, reason: 'upload-error', files: [] };
            try {
                uploadResult = await window.uploadSubmissionFilesToBackend(selectedSubmissionFiles, {
                    lessonId: activeLesson ? activeLesson.id : null,
                    requestId: window.qnsGetSubmitRequestId(activeLesson ? activeLesson.id : null, selectedSubmissionFiles, noteText),
                    studentId: currentStudentId
                });
            } catch (uploadError) {
                console.error('Tải tệp thất bại:', uploadError);
                uploadResult = { ok: false, reason: 'upload-exception', files: [] };
            }

            if (QNS_AUTH.isBackendConfigured() && !uploadResult.ok) {
                await window.showAppAlert({
                    type: 'error',
                    title: 'Chưa thể tải tệp lên',
                    message: 'Tệp bài làm chưa được tải lên hệ thống lưu trữ nên bài nộp chưa được xác nhận. Tệp bạn đã chọn vẫn được giữ lại, vui lòng thử nộp lại. Lỗi: ' + uploadResult.reason
                });
                return;
            }

            if (uploadResult.ok) {
                filesPayload = applyUploadResultsToMetadata(filesPayload, uploadResult.files);
            }
            const serverConfirmed = uploadResult.ok === true &&
                (filesPayload.length === 0 || filesPayload.every(f => f.uploadStatus === 'uploaded'));

            if (!activeLesson || !activeLesson.id) {
                await window.showAppAlert({ type: 'error', title: 'Không xác định được bài học', message: 'Vui lòng quay lại danh sách và mở lại bài học.' });
                return;
            }
            let activeLessonKey = activeLesson.id;

            // Gọi API submit thực tế để chốt tiến trình bên Backend
            if (serverConfirmed) {
                try {
                    let submitRes = await API.request('submission.submit', {
                        requestId: window.qnsGetSubmitRequestId(activeLessonKey, selectedSubmissionFiles, noteText),
                        lessonId: activeLessonKey,
                        fileIds: filesPayload.filter(f => f.fileId).map(f => f.fileId),
                        note: noteText
                    });
                    
                    // [T23] Không còn ghi sub_<lessonId>_<studentId> / qns_all_submissions vào LocalStorage.
                    // Bài nộp và điểm hiển thị lấy từ grading.getMyGrade / grading.listStudents.
                    window.qnsClearSubmitRequestId();   // [T21] thành công: lần nộp sau là thao tác mới
                    window.qnsSetServerAttempts(activeLessonKey, currentStudentId, submitRes && submitRes.attempts);
                } catch (e) {
                    await window.showAppAlert({ type: 'error', title: 'Lỗi chốt nộp bài', message: 'Đã xảy ra lỗi hệ thống khi xác nhận bài: ' + e.message });
                    return;
                }
            }

            // Đóng modal nộp bài
            document.getElementById('submission-modal').classList.remove('active');

            // Xây dựng danh sách thẻ tệp hiển thị trong hộp thoại thành công
            let filesCardsHtml = filesPayload.map(f => `
                <div class="attachment-card" style="margin-top: 0; padding: 10px 14px; background: #fff;">
                    <div class="attachment-info">
                        <div class="attachment-icon-wrapper ${f.cssClass}" style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; font-size: 18px;">
                            <i class="fa-solid ${f.icon}"></i>
                        </div>
                        <div style="min-width: 0; flex-grow: 1;">
                            <div class="attachment-name" style="font-size: 0.88rem;">${window.qnsEscapeHtml(f.name)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
                                ${f.formatName} · ${f.sizeStr}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

            let successExtraHtml = `
                <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-color); margin-bottom: 6px;">Danh sách tệp vừa nộp:</div>
                <div class="app-dialog-files-list">
                    ${filesCardsHtml}
                </div>
            `;

            // Hiển thị hộp thoại thành công tùy chỉnh (Không dùng alert native gây điều hướng lỗi)
            await window.showAppAlert({
                type: serverConfirmed ? 'success' : 'warning',
                title: serverConfirmed ? 'Nộp bài thành công!' : 'Đã ghi nhận bài nộp trên thiết bị này',
                message: serverConfirmed
                    ? 'Hệ thống đã ghi nhận bài làm của bạn.'
                    : 'Hiện chưa có máy chủ lưu trữ tệp nên nội dung tệp CHƯA được tải lên. Hệ thống mới chỉ ghi nhận tên, loại và dung lượng tệp trên thiết bị này; giáo viên chưa thể mở hoặc tải tệp của bạn.',
                extraHtml: successExtraHtml,
                confirmText: 'Quay lại bài học'
            });

            // Đóng hộp thoại xong, cập nhật lại giao diện trạng thái bài học ngay tại chỗ KHÔNG reload trang
            // [LỖI 18] Chỉ xóa tệp đang chọn khi đã được xác nhận tải lên; nếu chưa thì giữ lại để không mất dữ liệu
            if (serverConfirmed) {
                selectedSubmissionFiles = [];
                window.selectedFilesLessonId = null;
                renderSelectedFilesCards();
                if (document.getElementById('submission-note')) document.getElementById('submission-note').value = '';
            }

            // Gọi lại hàm mở chi tiết bài học để cập nhật trạng thái "Đã nộp" và hiển thị thẻ tệp PDF/tệp đã nộp ở khu vực "Bài tập của bạn"
            if (typeof openLessonDetail === 'function') {
                // Lấy thông tin bài học hiện tại để refresh pane
                openLessonDetail(activeLesson.id, activeLesson.type, activeLesson.title, activeLesson.meta, activeLesson.desc, activeLesson.link, activeLesson.attachmentType);
            }
        });

        // Chờ tải dữ liệu từ Backend, sau đó mới Render giao diện (Giai đoạn 4)
        Promise.resolve().then(() => new Promise(r => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r, { once: true }) : r())).then(() => QNS_AUTH.authorizeCourse()).then((auth) => {
            if (!auth || !auth.ok) return { ok: false, handled: true };   // đã chuyển trang hoặc đã hiện màn từ chối
            if (typeof window.applyRoleUI === 'function') window.applyRoleUI();
            if (typeof window.refreshUserHeader === 'function') window.refreshUserHeader();
            return QNS_AUTH.startSessionKeeper({ skipInitialVerify: true }).then(() => window.loadCourseData());
        }).then((loadResult) => {
            if (loadResult && loadResult.handled) return;
            if (loadResult && (loadResult.code === 'FORBIDDEN' || loadResult.code === 'COURSE_CONFIG_INVALID')) return;   // màn từ chối đã hiện
            if (loadResult && loadResult.ok === false) {
                if (QNS_AUTH.isSessionInvalidated()) return; // đang chuyển về home.html
                if (QNS_AUTH.isBackendConfigured()) {
                    // ADR-10: không hiển thị bài mẫu/dữ liệu giả khi Backend đã cấu hình mà tải lỗi
                    (function () {
                        const statusBox = document.getElementById('qns-dynamic-sections');
                        if (!statusBox) return;
                        statusBox.innerHTML = '<div id="qns-course-status" role="alert" style="padding: 32px 16px; text-align: center; color: var(--text-color);">' +
                            '<p>Không tải được nội dung khóa học: ' + window.qnsEscapeHtml(loadResult.message || 'Lỗi kết nối máy chủ') + '</p>' +
                            '<button type="button" id="qns-retry-load" class="btn btn-primary">Thử tải lại</button></div>';
                        const retryBtn = document.getElementById('qns-retry-load');
                        if (retryBtn) retryBtn.addEventListener('click', function () { window.location.reload(); });
                    })();
                    window.showAppConfirm({
                        title: 'Không tải được dữ liệu khóa học',
                        message: (loadResult.message || 'Lỗi kết nối máy chủ') + '. Hệ thống không hiển thị dữ liệu thay thế. Bạn có muốn tải lại trang không?',
                        confirmText: 'Tải lại',
                        cancelText: 'Đóng'
                    }).then(function (reload) { if (reload) window.location.reload(); });
                    return;
                }
            }
            if (typeof window.renderStudentLessons === 'function') {
                window.renderStudentLessons();
            }
            bindAllLessonEvents();
            if (typeof updateCourseScheduleUI === 'function') updateCourseScheduleUI();
            if (typeof updateCourseProgress === 'function') updateCourseProgress();
            if (typeof applyCourseFilters === 'function') applyCourseFilters();
        }).catch(function (error) {
            console.error("Lỗi khi tải dữ liệu khóa học (Giai đoạn 4):", error);
        });

    })();
