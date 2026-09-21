(function() {
            var savedTheme = localStorage.getItem('qn-study-theme');
            if (savedTheme === 'dark') {
                document.documentElement.classList.add('dark-mode');
            }
        })();
        document.addEventListener('DOMContentLoaded', () => {
            /* ==========================================
               0. BẢO VỆ TRANG & NẠP DỮ LIỆU NGƯỜI DÙNG
               ========================================== */
            const userData = sessionStorage.getItem('loggedInUser');

            if (!userData) {
                window.location.href = 'index.html';
                return;
            }

            let user;
            try {
                user = JSON.parse(userData);
            } catch (e) {
                sessionStorage.removeItem('loggedInUser');
                window.location.href = 'index.html';
                return;
            }

            // ============================================================
// LƯU TÀI KHOẢN HIỆN TẠI (Đồng bộ cho các trang khóa học)
// ============================================================
if (user) {
    // Chuẩn hóa object người dùng có đủ fullName/studentId hoặc hoTen/id
    const currentUser = {
        username: user.username || user.id || '',
        fullName: user.hoTen || user.fullName || user.name || 'Chưa xác định',
        studentId: user.id || user.studentId || 'Chưa xác định'
    };
    
    // Lưu vào cả sessionStorage và localStorage để đảm bảo tương thích
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

            function isEmptyDisplayValue(value) {
                if (value === 0 || value === '0' || value === 0.0 || value === '0.0') return false;
                return value === undefined ||
                       value === null ||
                       String(value).trim() === '' ||
                       String(value).trim() === '-';
            }

            function setText(id, value) {
                const el = document.getElementById(id);
                if (el) el.textContent = isEmptyDisplayValue(value) ? '' : value;
            }

            // Gán dữ liệu cho Sidebar & Header Hero
            setText('sidebarUserName', user.hoTen);
            setText('sidebarUserCode', (user && user.id === 'Administrator') ? 'Administrator' : user.id);
            setText('hero-hoTen', user.hoTen);
            setText('hero-id', (user && user.id === 'Administrator') ? 'Administrator' : user.id);

            // Cấu hình Avatar động theo ID học sinh (dạng ${user.id}.png)
            function setupDynamicAvatar(userId) {
                if (!userId) return;
                const avatarFileName = `${userId}.png`;
                const sidebarAvatarContainer = document.getElementById('sidebarUserAvatarContainer');
                const profileHeroAvatarContainer = document.getElementById('profileHeroAvatarContainer');

                const defaultSidebarSvg = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
                const defaultProfileSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

                const img = new Image();
                img.onload = function() {
                    if (sidebarAvatarContainer) {
                        sidebarAvatarContainer.innerHTML = `<img src="${avatarFileName}" alt="Avatar">`;
                    }
                    if (profileHeroAvatarContainer) {
                        profileHeroAvatarContainer.innerHTML = `<img src="${avatarFileName}" alt="Avatar">`;
                    }
                };
                img.onerror = function() {
                    if (sidebarAvatarContainer) {
                        sidebarAvatarContainer.innerHTML = defaultSidebarSvg;
                    }
                    if (profileHeroAvatarContainer) {
                        profileHeroAvatarContainer.innerHTML = defaultProfileSvg;
                    }
                };
                img.src = avatarFileName;
            }
            setupDynamicAvatar(user.id);

            // Xử lý nạp dữ liệu và ẨN các trường không có dữ liệu
            const profileCards = document.querySelectorAll('.profile-item-card');
            profileCards.forEach(card => {
                const key = card.getAttribute('data-key');
                const val = user[key];
                const valueEl = card.querySelector('.profile-value');

                // Kiểm tra xem dữ liệu có tồn tại không (Loại bỏ null, undefined, rỗng hoặc dấu "-")
                const isValid = !isEmptyDisplayValue(val);

                if (isValid) {
                    if (valueEl) valueEl.textContent = val;
                    card.style.display = 'flex'; // Hiển thị ô nếu có dữ liệu
                } else {
                    card.style.display = 'none'; // ẨN HOÀN TOÀN ô nếu không có dữ liệu
                }
            });

            /* ==========================================
               0b. ĐĂNG XUẤT
               ========================================== */
            const btnLogout = document.getElementById('btn-logout');
            if (btnLogout) {
                btnLogout.addEventListener('click', (e) => {
                    e.preventDefault();
                    sessionStorage.removeItem('loggedInUser');
                    window.location.href = 'index.html';
                });
            }
            // Element References
            const btnNotificationBell = document.getElementById('btn-notification-bell');
            const menuItems = document.querySelectorAll('.menu-item');
            const pageSections = document.querySelectorAll('.page-section');

            /* ==========================================
               2. XỬ LÝ CHUYỂN TRANG SPA & MENU ACTIVE
               ========================================== */
            function navigateToPage(targetPageId) {
                // 1. Cập nhật trạng thái Active của Menu
                menuItems.forEach(item => {
                    if (item.getAttribute('data-page') === targetPageId) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });

                // 2. Chuyển đổi hiển thị Section tương ứng
                pageSections.forEach(section => {
                    if (section.id === targetPageId) {
                        section.classList.add('active');
                    } else {
                        section.classList.remove('active');
                    }
                });

                // 3. Tải dữ liệu khi người dùng chuyển trang
                if (targetPageId === 'tuition-page' && !tuitionLoaded) {
                    loadTuitionData();
                }
                if (targetPageId === 'schedule-page' && !scheduleLoaded) {
                    loadScheduleData();
                }
                if (targetPageId === 'study-result-page' && !learningResultsLoaded) {
                    loadLearningResults();
                }
                if (targetPageId === 'study-log-page' && !studyLogLoaded) {
                    loadStudyLogData();
                }
            }

            // Gắn sự kiện Click cho tất cả các item menu trong Sidebar
            menuItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const pageId = item.getAttribute('data-page');
                    if (pageId) {
                        navigateToPage(pageId);
                    }
                });
            });

            /* ==========================================
               3. SỰ KIỆN CLICK CHUÔNG THÔNG BÁO & THEME TOGGLE
               ========================================== */
            btnNotificationBell.addEventListener('click', () => {
                navigateToPage('notification-page');
            });

            /* ==========================================
               3b. CHỨC NĂNG CHUYỂN ĐỔI LIGHT/DARK MODE
               ========================================== */
            const btnThemeToggle = document.getElementById('btn-theme-toggle');
            const iconSun = btnThemeToggle ? btnThemeToggle.querySelector('.theme-icon-sun') : null;
            const iconMoon = btnThemeToggle ? btnThemeToggle.querySelector('.theme-icon-moon') : null;

            function updateThemeUI(isDark) {
                if (isDark) {
                    document.documentElement.classList.add('dark-mode');
                    if (iconSun) iconSun.style.display = 'none';
                    if (iconMoon) iconMoon.style.display = 'block';
                } else {
                    document.documentElement.classList.remove('dark-mode');
                    if (iconSun) iconSun.style.display = 'block';
                    if (iconMoon) iconMoon.style.display = 'none';
                }
            }

            // Đồng bộ UI Icon với trạng thái đã đọc ở Head Script
            const currentIsDark = document.documentElement.classList.contains('dark-mode');
            updateThemeUI(currentIsDark);

            if (btnThemeToggle) {
                btnThemeToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isDark = document.documentElement.classList.toggle('dark-mode');
                    localStorage.setItem('qn-study-theme', isDark ? 'dark' : 'light');
                    updateThemeUI(isDark);
                });
            }
        /* ==========================================
               4. CHỨC NĂNG QUẢN LÝ THÔNG BÁO
               ========================================== */
            const notifications = [
                {
                    id: 1,
                    title: "Mở lớp Nhập môn Toán Cao Cấp theo chương trình đào tạo kỹ sư tại Đại học Bách Khoa Hà Nội",
                    date: "10/07/2026",
                    content: `
                        <p>Lớp học tập trung giảng dạy 2 học phần cốt lõi:</p>
                        
                        <h3>1. Nhập môn Đại số Tuyến tính</h3>
                        <ul>
                            <li>Logic, tập hợp, ánh xạ, số phức.</li>
                            <li>Ma trận, định thức và hệ phương trình tuyến tính.</li>
                            <li>Không gian vectơ, ánh xạ tuyến tính.</li>
                        </ul>

                        <h3>2. Nhập môn Giải tích I</h3>
                        <ul>
                            <li>Giới hạn, tính liên tục của hàm số một biến.</li>
                            <li>Phép tính vi phân hàm một biến.</li>
                            <li>Phép tính tích phân hàm một biến.</li>
                        </ul>

                        <h3>Thông tin đăng ký & lịch học</h3>
                        <ul>
                            <li><strong>Hình thức học:</strong> Online (học trực tuyến có tương tác trực tiếp với giảng viên).</li>
                            <li><strong>Thời lượng đào tạo:</strong> 6 buổi, mỗi buổi 3 giờ.</li>
                            <li><strong>Đối tượng tham gia:</strong> Sinh viên năm nhất, sinh viên chuẩn bị vào Đại học Bách Khoa hoặc các bạn có định hướng theo khối ngành Kỹ thuật/Khoa học tự nhiên.</li>
                            <li><strong>Thời gian đóng đăng ký:</strong> 10/08/2026.</li>
                        </ul>
                    `
                },
                {
                    id: 2,
                    title: "Mở lớp Toán học 12 theo chương trình mới",
                    date: "29/07/2026",
                    content: `
                        <h3>TẬP 1: ỨNG DỤNG ĐẠO HÀM, VECTƠ VÀ CÁC SỐ ĐẶC TRƯNG</h3>
                        
                        <h4>Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số</h4>
                        <ul>
                            <li>Bài 1: Tính đơn điệu và cực trị của hàm số.</li>
                            <li>Bài 2: Giá trị lớn nhất và giá trị nhỏ nhất của hàm số.</li>
                            <li>Bài 3: Đường tiệm cận của đồ thị hàm số (tiệm cận đứng, tiệm cận ngang, tiệm cận xiên).</li>
                            <li>Bài 4: Khảo sát sự biến thiên và vẽ đồ thị của hàm số.</li>
                            <li>Bài 5: Ứng dụng đạo hàm để giải quyết một số bài toán thực tế (bài toán tối ưu hóa).</li>
                        </ul>

                        <h4>Chương 2: Tọa độ của vectơ trong không gian</h4>
                        <ul>
                            <li>Bài 1: Vectơ và các phép toán vectơ trong không gian.</li>
                            <li>Bài 2: Tọa độ của vectơ trong không gian Oxyz.</li>
                            <li>Bài 3: Biểu thức tọa độ của các phép toán vectơ.</li>
                        </ul>

                        <h4>Chương 3: Các số đặc trưng đo độ tập trung và đo độ phân tán cho mẫu số liệu ghép nhóm</h4>
                        <ul>
                            <li>Bài 1: Khoảng biến thiên và khoảng tứ phân vị của mẫu số liệu ghép nhóm.</li>
                            <li>Bài 2: Phương sai và độ lệch chuẩn của mẫu số liệu ghép nhóm.</li>
                        </ul>

                        <h3>TẬP 2: TÍCH PHÂN, HÌNH HỌC OXYZ VÀ XÁC SUẤT</h3>

                        <h4>Chương 4: Nguyên hàm và tích phân</h4>
                        <ul>
                            <li>Bài 1: Nguyên hàm và các tính chất cơ bản.</li>
                            <li>Bài 2: Tích phân và tính chất của tích phân.</li>
                            <li>Bài 3: Ứng dụng hình học của tích phân.</li>
                            <li>Bài 4: Ứng dụng tích phân trong thực tế.</li>
                        </ul>

                        <h4>Chương 5: Phương pháp tọa độ trong không gian</h4>
                        <ul>
                            <li>Bài 1: Phương trình mặt phẳng.</li>
                            <li>Bài 4: Góc và khoảng cách trong không gian Oxyz.</li>
                        </ul>

                        <h4>Chương 6: Xác suất có điều kiện và công thức xác suất toàn phần</h4>
                        <ul>
                            <li>Bài 1: Xác suất có điều kiện.</li>
                            <li>Bài 2: Công thức xác suất toàn phần và công thức Bayes.</li>
                        </ul>

                        <h3>Cấu trúc mỗi bài học và lộ trình giảng dạy</h3>
                        <table class="notification-inner-table">
                            <thead>
                                <tr>
                                    <th style="width: 30%;">Hạng mục</th>
                                    <th style="width: 70%;">Nội dung thực hiện</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Lý thuyết trọng tâm</strong></td>
                                    <td>Tóm tắt công thức, khái niệm chuẩn theo SGK mới</td>
                                </tr>
                                <tr>
                                    <td><strong>Dạng toán điển hình</strong></td>
                                    <td>Phân loại từ cơ bản đến nâng cao</td>
                                </tr>
                                <tr>
                                    <td><strong>Thực hành Casio/Phần mềm</strong></td>
                                    <td>Bấm máy tính nhanh, trực quan hóa hình học qua GeoGebra</td>
                                </tr>
                                <tr>
                                    <td><strong>Kiểm tra & Đánh giá</strong></td>
                                    <td>Bài tập rèn luyện định kỳ bám sát cấu trúc đề thi tốt nghiệp THPT mới</td>
                                </tr>
                            </tbody>
                        </table>
                    `
                },
                {
                    id: 3,
                    title: "Thực hiện kì thi kết thúc khóa học Nhập môn Đại số tuyến tính và Nhập môn Giải tích I",
                    date: "29/08/2026",
                    content: `Đã có thông tin chi tiết`
                },
                        {id: 4,
                    title: "Khảo sát phát triển chất lượng dạy học về màu bảng khi học online",
                    date: "19/09/2026",
                    content: `Xem thông tin chi tiết <a href="https://forms.gle/WCZh6eFYJczX7UFRA" target="_blank" style="color: #0066cc; text-decoration: underline;">tại đây</a>`},
                    {id: 5,
                    title: "Thư mời tham gia học lớp học Toán 8 thực hành theo phương pháp Polya",
                    date: "21/09/2026",
                    content: `Xem thông tin chi tiết <a href="https://drive.google.com/file/d/1px6f6tJx4eLbb2lfs2-tcNbzBHhs43o8/view?usp=sharing" target="_blank" style="color: #0066cc; text-decoration: underline;">tại đây</a>`}
                        
                        
            ];

            function renderNotifications() {
                const tbody = document.getElementById('notification-table-body');
                if (!tbody) return;

                tbody.innerHTML = notifications.map(item => `
                    <tr class="notification-row" onclick="openNotification(${item.id})">
                        <td class="notification-cell-title">
                            <span class="notification-item-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                            </span>
                            <span>${item.title}</span>
                        </td>
                        <td class="notification-cell-date">${item.date}</td>
                    </tr>
                `).join('');
            }

            window.openNotification = function(id) {
                const notif = notifications.find(n => n.id === id);
                if (!notif) return;

                document.getElementById('notification-detail-title').innerText = notif.title;
                document.getElementById('notification-detail-date').innerText = 'Ngày đăng: ' + notif.date;
                document.getElementById('notification-detail-content').innerHTML = notif.content;

                document.getElementById('notification-list-view').style.display = 'none';
                document.getElementById('notification-detail-view').style.display = 'block';
            };

            window.closeNotification = function() {
                document.getElementById('notification-detail-view').style.display = 'none';
                document.getElementById('notification-list-view').style.display = 'block';
            };

            // Khởi tạo danh sách thông báo khi tải trang
            renderNotifications();

            /* ==========================================
               5. CHỨC NĂNG QUẢN LÝ & PHÂN QUYỀN KHÓA HỌC
               ========================================== */
               /* ==========================================
   CONFIG - KẾT NỐI GOOGLE APPS SCRIPT
   ========================================== */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbysKbabtrPxcYLV26N5wY_XHWhxrOG-Rvb0M73eHBRF5bWwhmoIMmPJPf4V4Hoj2P6l/exec';

const COURSE_STATUS = {
    ALLOWED: 'O',
    NOT_REGISTERED: 'Chưa đăng ký',
    REQUESTED: 'Yêu cầu',
    ENDED: 'Kết thúc'
};

let coursePermissionMap = {};   // { courseId: 'O' | 'Chưa đăng ký' | 'Yêu cầu' }
let isPermissionLoaded = false; // tránh render sai trạng thái khi chưa có dữ liệu

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function callAppsScript(params) {
    const url = new URL(APPS_SCRIPT_URL);
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
        }
    });
    return fetch(url.toString()).then(res => {
        if (!res.ok) throw new Error('Lỗi mạng: ' + res.status);
        return res.json();
    });
}

function renderCourseLoadingState() {
    const container = document.getElementById('course-grid-container');
    if (!container) return;
    container.innerHTML = `<div class="course-loading-state">Đang tải danh sách khóa học...</div>`;
}

function renderCourseErrorState(message) {
    const container = document.getElementById('course-grid-container');
    if (!container) return;
    container.innerHTML = `
        <div class="course-error-state">
            ${escapeHtml(message)}
            <br>
            <button class="course-retry-btn" onclick="loadCoursePermissions()">Thử lại</button>
        </div>
    `;
}

function loadCoursePermissions() {
    renderCourseLoadingState();
    const userId = getCurrentUserId();
    if (!userId) {
        renderCourseErrorState('Không xác định được người dùng. Vui lòng đăng nhập lại.');
        return;
    }
    callAppsScript({ action: 'getCoursePermissions', id: userId })
        .then(response => {
            if (!response || !response.success) {
                renderCourseErrorState((response && response.message) || 'Không thể tải dữ liệu quyền khóa học. Vui lòng thử lại.');
                return;
            }
            coursePermissionMap = response.courses || {};
            isPermissionLoaded = true;
            renderCourses();
        })
        .catch(() => {
            renderCourseErrorState('Không thể tải dữ liệu quyền khóa học. Vui lòng thử lại.');
        });
}           
// DỮ LIỆU NGOẠI KHÓA BAN ĐẦU
            const extracurricularData = [
                {
                    id: "extra-1",
                    content: "Kiểm tra kết thúc bộ môn Hóa học 12",
                    date: "07/09/2026",
                    time: "14h00",
                    students: 1
                },
                {
                    id: "extra-2",
                    content: "Phát triển năng lực số",
                    date: "15/09/2026",
                    time: "08h00",
                    students: 1
                }
            ];

            // Hàm xử lý khi bấm "Tham gia" buổi ngoại khóa
            window.joinExtracurricular = function(sessionId) {
                const session = extracurricularData.find(s => s.id === sessionId);
                const sessionName = session ? session.content : sessionId;
                // Chuyển hướng hoặc thông báo chờ cấu hình
                window.location.href = 'home.html';
            };
            const coursesData = [
                {
                    id: "course-linear-algebra",
                    title: "Nhập môn Đại số tuyến tính",
                    level: "Đại học",
                    teacher: "Nguyễn Hải Quân",
                    duration: "10/08/2026 - 30/08/2026",
                    students: 1,
                    image: "MATH231.png",
                    url: "course-linear-algebra.html",
                    status: 'ENDED' // TODO: thay bằng URL thật của khóa học
                },
                {
                    id: "course-calculus-1",
                    title: "Nhập môn Giải tích I",
                    level: "Đại học",
                    teacher: "Nguyễn Hải Quân",
                    duration: "10/08/2026 - 30/08/2026",
                    students: 1,
                    image: "MATH232.png",
                    url: "course-calculus-1.html",
                    status: 'ENDED'
                },
                {
                    id: "course-social-statistics",
                    title: "Nhập môn Thống kê xã hội học",
                    level: "Đại học",
                    teacher: "Nguyễn Hải Quân",
                    duration: "10/08/2026 - 25/08/2026",
                    students: 1,
                    image: "MATH131.jpg",
                    url: "#", // TODO: thay bằng URL thật của khóa học
                    status: 'ENDED'
                },
                {
                    id: "course-math-12",
                    title: "Toán học 12",
                    level: "THPT",
                    teacher: "Nguyễn Hải Quân",
                    duration: "10/08/2026 - 15/02/2027",
                    students: 1,
                    image: "MATH12.jpg",
                    url: "course-math-12.html" // TODO: thay bằng URL thật của khóa học
                },
                {
                    id: "course-chemistry-8",
                    title: "Hóa học 8",
                    level: "THCS",
                    teacher: "Nguyễn Thị Mai Phương",
                    duration: "",
                    students: 6,
                    image: "CHEM12.jpg",
                    url: "course-chemistry-8.html" // TODO: thay bằng URL thật của khóa học
                },
                {
                    id: "course-math221a",
                    title: "Giải tích thực một biến (MATH221A)",
                    level: "Đại học",
                    teacher: "Nguyễn Hải Quân",
                    duration: "01/09/2026 - 31/12/2026",
                    students: 1,
                    image: "MATH221A.png",
                    url: "course-math221a.html" // TODO: thay bằng URL thật của khóa học
                },
                {
                    id: "course-math211a",
                    title: "Cấu trúc đại số cơ bản (MATH211A)",
                    level: "Đại học",
                    teacher: "Nguyễn Hải Quân",
                    duration: "01/09/2026 - 31/12/2026",
                    students: 1,
                    image: "MATH211A.png",
                    url: "course-math211a.html" // TODO: thay bằng URL thật của khóa học
                },
                {
                    id: "course-math352a",
                    title: "Lí luận, phương pháp dạy học và phương pháp dạy học bộ môn Toán học I (MATH352A)",
                    level: "Đại học",
                    teacher: "Nguyễn Hải Quân",
                    duration: "01/09/2026 - 31/12/2026",
                    students: 1,
                    image: "MATH352A.png",
                    url: "course-math352a.html" // TODO: thay bằng URL thật của khóa học
                },
                 {
                    id: "course-tinchi-hnue",
                    title: "Lập kế hoạch đăng kí tín chỉ HNUE (HK01 - K76)",
                    level: "Đại học",
                    teacher: "Nguyễn Hải Quân",
                    duration: "20/08/2026 - 28/08/2026",
                    students: 17,
                    image: "HNUE.png", // TODO: đổi ảnh thật cho khóa học này
                    url: "course-tinchi-hnue.html" ,// TODO: thay bằng URL thật của khóa học
                    status: "ENDED"
                }
            ];  

            function getCurrentUserId() {
                return user ? user.id : "";
            }

            function getCourseStatus(courseId) {
                const course = coursesData.find(c => c.id === courseId);

                // Ưu tiên tuyệt đối: nếu trong cấu hình coursesData có khai báo status là ENDED
                if (course && (course.status === COURSE_STATUS.ENDED || course.status === 'ENDED')) {
                    return COURSE_STATUS.ENDED;
                }

                const status = coursePermissionMap[courseId];

                if (
                    status === COURSE_STATUS.ALLOWED ||
                    status === COURSE_STATUS.REQUESTED
                ) {
                    return status;
                }

                if (status === undefined) {
                    console.warn('Không tìm thấy trạng thái quyền cho khóa học:', courseId);
                }

                return COURSE_STATUS.NOT_REGISTERED;
            }

            function sortCoursesByStatus(courses) {
                const order = {
                    [COURSE_STATUS.ALLOWED]: 0,
                    [COURSE_STATUS.REQUESTED]: 1,
                    [COURSE_STATUS.NOT_REGISTERED]: 2,
                    [COURSE_STATUS.ENDED]: 3
                };
                return [...courses].sort((a, b) => order[getCourseStatus(a.id)] - order[getCourseStatus(b.id)]);
            }
            function renderCourses(searchTerm = '') {
                const container = document.getElementById('course-grid-container');
                if (!container) return;

                if (!isPermissionLoaded) {
                    renderCourseLoadingState();
                    return;
                }

                // Lọc khóa học theo tên hoặc tên giảng viên
                const filteredCourses = coursesData.filter(course => {
                    const term = searchTerm.toLowerCase().trim();
                    return course.title.toLowerCase().includes(term) ||
                           course.teacher.toLowerCase().includes(term);
                });

                // Sắp xếp: O -> Yêu cầu -> Chưa đăng ký
                const sortedCourses = sortCoursesByStatus(filteredCourses);

                if (sortedCourses.length === 0) {
                    container.innerHTML = `
                        <div class="course-no-result">
                            Không tìm thấy khóa học nào phù hợp với từ khóa "${escapeHtml(searchTerm)}".
                        </div>
                    `;
                    return;
                }

                container.innerHTML = sortedCourses.map(course => {
                    const status = getCourseStatus(course.id);
                    const cardClass = status === COURSE_STATUS.ENDED
                        ? 'course-card course-card-ended'
                        : 'course-card';

                    let badgeClass = 'course-badge-unallowed';
                    let badgeText = 'Chưa đăng ký';
                    let buttonHtml = `
                        <button class="course-btn course-btn-enroll" onclick="handleCourseRegistration('${course.id}')">
                            Đăng ký
                        </button>
                    `;

                    const currentLang = localStorage.getItem('qn-study-language') || 'vi';
                    const dict = translations[currentLang] || translations['vi'];

                    if (status === COURSE_STATUS.ENDED) {
                        badgeClass = 'course-badge-ended';
                        badgeText = dict.endedBadge || 'Kết thúc';
                        buttonHtml = `
                            <button class="course-btn course-btn-ended" disabled>
                                ${dict.endedBtn || 'Kết thúc'}
                            </button>
                        `;
                    } else if (status === COURSE_STATUS.ALLOWED) {
                        badgeClass = 'course-badge-allowed';
                        badgeText = dict.enrolledBadge || 'Đã tham gia';
                        buttonHtml = `
                            <button class="course-btn course-btn-enter" onclick="openCourse('${course.id}')">
                                ${dict.enterCourseBtn || 'Vào học →'}
                            </button>
                        `;
                    } else if (status === COURSE_STATUS.REQUESTED) {
                        badgeClass = 'course-badge-requested';
                        badgeText = dict.requestedBadge || 'Đang yêu cầu';
                        buttonHtml = `
                            <button class="course-btn course-btn-requested" disabled>
                                ${dict.requestedBtn || 'Đã gửi yêu cầu'}
                            </button>
                        `;
                    } else {
                        badgeText = dict.unregisteredBadge || 'Chưa đăng ký';
                        buttonHtml = `
                            <button class="course-btn course-btn-enroll" onclick="handleCourseRegistration('${course.id}')">
                                ${dict.registerBtn || 'Đăng ký'}
                            </button>
                        `;
                    }

                    return `
                        <div class="${cardClass}">
                            <div class="course-image">
                                ${course.image ? `
                                    <img src="${escapeHtml(course.image)}" alt="${escapeHtml(course.title)}" onerror="this.onerror=null; this.classList.add('img-error');">
                                ` : `
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                    </svg>
                                `}
                                <span class="course-badge ${badgeClass}">
                                    ${badgeText}
                                </span>
                            </div>
                            <div class="course-body">
                                <h3 class="course-title" title="${escapeHtml(course.title)}">${escapeHtml(course.title)}</h3>
                                <span class="course-level-tag">${escapeHtml(course.level)}</span>
                                <div class="course-meta">
                                    <strong>GV:</strong> ${escapeHtml(course.teacher)}
                                </div>
                                <div class="course-meta">
                                    <strong>Thời lượng:</strong> ${escapeHtml(course.duration)}
                                </div>
                                <div class="course-footer">
                                    <div class="course-students">
                                        👤 ${escapeHtml(course.students)}
                                    </div>
                                    ${buttonHtml}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // LOGIC CHUYỂN ĐỔI GIỮA KHÓA HỌC CHÍNH QUY VÀ NGOẠI KHÓA
            function renderExtracurricularTable() {
                const container = document.getElementById('course-grid-container');
                if (!container) return;

                container.innerHTML = `
                    <div class="extracurricular-wrapper" style="width: 100%; display: flex; flex-direction: column; gap: 16px;">
                        <div class="extracurricular-section-header" style="background-color: #FFFFFF; color: #1565C0; font-weight: 700; font-size: 1.1rem; padding: 14px 20px; border-radius: 10px; text-align: center; border: 1px solid #1565C0; letter-spacing: 0.5px;" data-i18n="extracurricularCoursesTitle">
                            KHÓA HỌC NGOẠI KHÓA
                        </div>
                        <div class="extracurricular-table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; background-color: var(--bg-card, #ffffff); border: 1px solid var(--border-color, #cbd5e1); border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                            <table class="extracurricular-table" style="width: 100%; min-width: 750px; border-collapse: collapse; table-layout: fixed;">
                                <thead>
                                    <tr style="background-color: rgb(21, 101, 192); color: #ffffff; border-bottom: 2px solid var(--border-color, #cbd5e1);">
                                        <th style="width: 60px; padding: 14px 10px; text-align: center;"></th>
                                        <th style="width: 38%; padding: 14px 18px; text-align: left; font-weight: 700; color: #ffffff;" data-i18n="extracurricularContent">Nội dung ngoại khóa</th>
                                        <th style="width: 15%; padding: 14px 12px; text-align: center; font-weight: 700; color: #ffffff;" data-i18n="studyDate">Ngày học</th>
                                        <th style="width: 13%; padding: 14px 12px; text-align: center; font-weight: 700; color: #ffffff;" data-i18n="studyTime">Giờ học</th>
                                        <th style="width: 14%; padding: 14px 12px; text-align: center; font-weight: 700; color: #ffffff;" data-i18n="studentCount">Số học viên</th>
                                        <th style="width: 16%; padding: 14px 12px; text-align: center; font-weight: 700; color: #ffffff;" data-i18n="actions">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${extracurricularData.map(item => `
                                        <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0); transition: background-color 0.2s;">
                                            <td style="padding: 16px 10px; text-align: center; vertical-align: middle;">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
                                                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                                                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                                                </svg>
                                            </td>
                                            <td style="padding: 16px 18px; text-align: left; font-weight: 600; color: var(--text-main, #2c3e50); vertical-align: middle; word-break: normal; overflow-wrap: break-word; white-space: normal;">${escapeHtml(item.content)}</td>
                                            <td style="padding: 16px 12px; text-align: center; color: var(--text-main, #2c3e50); vertical-align: middle; white-space: nowrap;">${escapeHtml(item.date)}</td>
                                            <td style="padding: 16px 12px; text-align: center; color: var(--text-main, #2c3e50); vertical-align: middle; white-space: nowrap;">${escapeHtml(item.time)}</td>
                                            <td style="padding: 16px 12px; text-align: center; color: var(--text-main, #2c3e50); vertical-align: middle; white-space: nowrap;">${item.students}</td>
                                            <td style="padding: 16px 12px; text-align: center; vertical-align: middle; white-space: nowrap;">
                                                <button type="button" onclick="joinExtracurricular('${item.id}')" style="background-color: #2e7d32; color: #ffffff; border: 1px solid #000000; padding: 7px 14px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background-color 0.2s, transform 0.1s;">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    <span>Tham gia</span>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            const courseTypeRadios = document.querySelectorAll('input[name="course-type"]');
            const courseSearchContainer = document.querySelector('.course-search-container');

            courseTypeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (!e.target.checked) return;
                    const val = e.target.value;

                    // Cập nhật trạng thái active UI cho label chứa radio
                    document.querySelectorAll('.course-type-radio-option').forEach(lbl => {
                        lbl.classList.remove('active');
                    });
                    const parentLabel = e.target.closest('.course-type-radio-option');
                    if (parentLabel) parentLabel.classList.add('active');

                    if (val === 'extracurricular') {
                        if (courseSearchContainer) courseSearchContainer.style.display = 'none';
                        renderExtracurricularTable();
                    } else {
                        if (courseSearchContainer) courseSearchContainer.style.display = 'block';
                        const searchInput = document.getElementById('course-search-input');
                        renderCourses(searchInput ? searchInput.value : '');
                    }
                });
            });

            window.openCourse = function(courseId) {
                const userId = getCurrentUserId();
                if (!userId) {
                    showToast('Không xác định được người dùng. Vui lòng đăng nhập lại.', 'error');
                    return;
                }

                const course = coursesData.find(c => c.id === courseId);
                showToast('Đang kiểm tra quyền truy cập...', 'info');

                callAppsScript({ action: 'verifyCourseAccess', userId: userId, courseId: courseId })
                    .then(response => {
                        if (response && response.success && response.authorized) {
                            if (course && course.url && course.url !== '#') {
                                // Lưu cờ cho phép vào sessionStorage trước khi chuyển trang
                                sessionStorage.setItem("allowed_course_access", "true");
                                window.location.href = course.url;
                            } else {
                                showToast('Đường dẫn khóa học chưa được cấu hình.', 'error');
                            }
                        } else {
                            showToast('Bạn chưa được cấp quyền truy cập khóa học này.', 'error');
                            loadCoursePermissions();
                        }
                    })
                    .catch(() => {
                        showToast('Không thể xác minh quyền truy cập. Vui lòng thử lại.', 'error');
                    });
            };

            window.handleCourseRegistration = function(courseId) {
                const userId = getCurrentUserId();
                const username = user ? user.username : '';

                if (!userId) {
                    showToast('Không xác định được người dùng. Vui lòng đăng nhập lại.', 'error');
                    return;
                }

                callAppsScript({ action: 'requestCourse', userId: userId, username: username, courseId: courseId })
                    .then(response => {
                        if (response && response.success) {
                            showToast(response.message || 'Đã gửi yêu cầu đăng ký khóa học.', 'success');
                            coursePermissionMap[courseId] = response.status || COURSE_STATUS.REQUESTED;
                        } else {
                            showToast((response && response.message) || 'Không thể gửi yêu cầu. Vui lòng thử lại.', 'error');
                            if (response && response.status) {
                                coursePermissionMap[courseId] = response.status;
                            }
                        }
                        const searchInput = document.getElementById('course-search-input');
                        renderCourses(searchInput ? searchInput.value : '');
                    })
                    .catch(() => {
                        showToast('Không thể gửi yêu cầu. Vui lòng thử lại.', 'error');
                    });
            };

            // Lắng nghe sự kiện gõ phím trên thanh tìm kiếm
            const searchInput = document.getElementById('course-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    renderCourses(e.target.value);
                });
            }

            /* ==========================================
               5b. CHỨC NĂNG HỌC PHÍ — DỮ LIỆU ĐỘNG TỪ GOOGLE SHEETS
               ========================================== */
            let tuitionData = [];
            let tuitionLoaded = false;
            /* ==========================================
               HÀM DÙNG CHUNG: FORMAT NGÀY THEO DẠNG dd/mm/yyyy
               ========================================== */
            function formatDateVN(dateVal) {
                if (!dateVal) return '-';
                let d;
                if (dateVal instanceof Date) {
                    d = dateVal;
                } else if (typeof dateVal === 'number') {
                    d = new Date(dateVal);
                } else if (typeof dateVal === 'string') {
                    const str = dateVal.trim();
                    if (!str || str === '-') return '-';
                    // Nếu đã đúng chuẩn dd/mm/yyyy
                    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
                        const parts = str.split('/');
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        return `${day}/${month}/${parts[2]}`;
                    }
                    d = new Date(str);
                }
                if (!d || isNaN(d.getTime())) return String(dateVal);

                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            }

            function formatCurrency(value) {
                const number = Number(value);
                if (!Number.isFinite(number)) return '-';
                return new Intl.NumberFormat('vi-VN').format(number);
            }

            function renderTuitionTable(rows) {
                const tbody = document.getElementById('tuition-table-body');
                if (!tbody) return;

                if (!Array.isArray(rows) || rows.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center">Không có dữ liệu học phí.</td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = rows.map((item, index) => {
                    const status = String(item.status || '').trim();
                    const isPaid = status === 'Đã nộp';
                    const rowClass = isPaid ? 'tuition-row-paid' : '';

                    const actionHtml = isPaid
                        ? `<span class="tuition-status-paid">Đã nộp</span>`
                        : `
                            <button type="button" class="tuition-btn-pay" onclick="goToTuitionPayment(${index})">
                                 Nộp học phí
                            </button>
                        `;

                    return `
                        <tr class="${rowClass}">
                            <td class="text-center">${index + 1}</td>
                            <td class="text-center">${escapeHtml(formatDateVN(item.startDate))}</td>
                            <td class="text-center">${escapeHtml(formatDateVN(item.endDate))}</td>
                            <td class="text-right">${formatCurrency(item.original)}</td>
                            <td class="text-right">${formatCurrency(item.discount)}</td>
                            <td class="text-right">
                                <div class="tuition-amount-container">
                                    <span class="tuition-amount-highlight">${formatCurrency(item.amount)}</span>
                                </div>
                            </td>
                            <td class="text-center">${actionHtml}</td>
                        </tr>
                    `;
                }).join('');
            }

            function loadTuitionData() {
                const userId = user ? user.id : '';
                const username = user ? user.username : '';

                if (!userId || !username) {
                    showToast('Không xác định được thông tin người dùng. Vui lòng đăng nhập lại.', 'error');
                    return;
                }

                const tbody = document.getElementById('tuition-table-body');
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center">Đang tải dữ liệu học phí...</td>
                        </tr>
                    `;
                }

                callAppsScript({ action: 'getTuition', id: userId, username: username })
                    .then(response => {
                        if (!response || !response.success) {
                            throw new Error((response && response.message) || 'Không thể tải dữ liệu học phí.');
                        }
                        tuitionData = Array.isArray(response.data) ? response.data : [];
                        tuitionLoaded = true;
                        renderTuitionTable(tuitionData);
                    })
                    .catch(error => {
                        console.error('Lỗi tải học phí:', error);
                        if (tbody) {
                            tbody.innerHTML = `
                                <tr>
                                    <td colspan="7" class="text-center">Không thể tải dữ liệu học phí.</td>
                                </tr>
                            `;
                        }
                        showToast(error.message || 'Không thể tải dữ liệu học phí.', 'error');
                    });
            }

            window.goToTuitionPayment = function(index) {
                const item = tuitionData[index];
                if (!item) {
                    showToast('Không tìm thấy khoản học phí.', 'error');
                    return;
                }
                if (String(item.status).trim() === 'Đã nộp') {
                    showToast('Khoản học phí này đã được nộp.', 'info');
                    return;
                }

                // Định dạng lại ngày từ Google Sheets về chuẩn dd/mm/yyyy
                const formattedStartDate = formatDateVN(item.startDate);
                const formattedEndDate = formatDateVN(item.endDate);

                const currentUser = {
                    username: user ? (user.username || user.id || '') : '',
                    fullName: user ? (user.hoTen || user.fullName || user.name || 'Chưa xác định') : 'Chưa xác định',
                    studentId: user ? (user.id || user.studentId || 'Chưa xác định') : 'Chưa xác định'
                };

                const selectedPayment = {
                    startDate: formattedStartDate,
                    endDate: formattedEndDate,
                    original: item.original,
                    discount: item.discount,
                    amount: item.amount,
                    studentId: currentUser.studentId,
                    fullName: currentUser.fullName
                };

                sessionStorage.setItem('selectedTuitionPayment', JSON.stringify(selectedPayment));

                openTuitionModal(
                    `${formattedStartDate} - ${formattedEndDate}`,
                    formatCurrency(item.original),
                    formatCurrency(item.discount),
                    formatCurrency(item.amount)
                );
            };

            // Gọi tải quyền khóa học và dữ liệu học phí từ Google Sheets ngay khi khởi tạo
            loadCoursePermissions();
            loadTuitionData();
            /* ==========================================
               5c. CHỨC NĂNG LỊCH HỌC — LOGIC VÀ RENDER
               ========================================== */
             let scheduleData = [];
            let scheduleLoaded = false;
            let scheduleLessonUrls = [];

            // Kiểm tra URL an toàn trước khi mở (chỉ cho phép http/https)
            function isSafeLessonUrl(url) {
                try {
                    const parsed = new URL(url, window.location.href);
                    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                } catch (e) {
                    return false;
                }
            }

            window.openScheduleLesson = function (index) {
                const url = scheduleLessonUrls[index];
                if (url && isSafeLessonUrl(url)) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            };
            // Xử lý chuỗi Ngày + Giờ về Date Object theo giờ Việt Nam (GMT+7)
            function parseDateTimeVN(dateStr, timeStr) {
                if (!dateStr) return null;
                let day = 1, month = 1, year = 2026;

                if (typeof dateStr === 'string') {
                    const parts = dateStr.trim().split('/');
                    if (parts.length === 3) {
                        day = parseInt(parts[0], 10);
                        month = parseInt(parts[1], 10) - 1;
                        year = parseInt(parts[2], 10);
                    } else {
                        const d = new Date(dateStr);
                        if (!isNaN(d.getTime())) return d;
                    }
                } else if (dateStr instanceof Date) {
                    return dateStr;
                }

                let hour = 0, minute = 0;
                if (timeStr && typeof timeStr === 'string') {
                    const cleanTime = timeStr.trim().toLowerCase().replace('h', ':');
                    const timeParts = cleanTime.split(':');
                    if (timeParts.length >= 1) hour = parseInt(timeParts[0], 10) || 0;
                    if (timeParts.length >= 2) minute = parseInt(timeParts[1], 10) || 0;
                }

                return new Date(year, month, day, hour, minute, 0);
            }

            function renderScheduleTable(rows) {
                const tbody = document.getElementById('schedule-table-body');
                if (!tbody) return;

                if (!Array.isArray(rows) || rows.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="8" class="text-center">Chưa có lịch học được cập nhật cho học kỳ này.</td>
                        </tr>
                    `;
                    return;
                }

                 scheduleLessonUrls = [];

                const now = new Date();

                tbody.innerHTML = rows.map((item, index) => {
                    // Mapping dữ liệu linh hoạt với nhiều định dạng key từ Backend
                    const stt = item.stt || (index + 1);
                    const ngayHocRaw = item.ngayHoc || item.startDate || item.date || '';
                    const ngayHocFormatted = formatDateVN(ngayHocRaw);
                    const thoiGianBatDau = item.thoiGianBatDau || item.startTime || item.time || '-';
                    const thoiLuong = item.thoiLuong || item.duration || '-';
                    const khoaHoc = item.khoaHoc || item.courseName || item.courseTitle || '-';
                    const noiDung = item.noiDung || item.noiDungBuoiHoc || item.lessonContent || '-';
                    const chuyenCan = String(item.chuyenCan || item.attendance || 'Chưa học').trim();
                    const lessonUrl = item.lessonUrl || item.meetingUrl || item.url || '';

                    // Tính toán thời điểm bắt đầu học để kiểm tra tự động
                    const lessonStartTime = parseDateTimeVN(ngayHocFormatted, thoiGianBatDau);
                    const isTimeReached = lessonStartTime ? (now >= lessonStartTime) : false;

                    // Trạng thái buổi học lấy TRỰC TIẾP từ cột "Chuyên cần" trong Google Sheets
                    const chuyenCanLower = chuyenCan.toLowerCase();
                    const isUpcoming = (chuyenCanLower === 'chưa diễn ra');
                    const isAttended = (chuyenCanLower === 'đã học');

                    // Xác định Class màu dòng theo thứ tự ưu tiên
                    let rowClass = '';
                    if (isUpcoming) {
                        rowClass = 'schedule-row-upcoming'; // Ưu tiên 1: #E7F1FF
                    } else if (!isAttended) {
                        rowClass = 'schedule-row-absent';   // Ưu tiên 2: #FDECEC
                    } else {
                        rowClass = 'schedule-row-attended'; // Ưu tiên 3: #EAF7EA
                    }

                    // Badge chuyên cần
                    let chuyenCanBadge = '';
                    if (isUpcoming) {
                        chuyenCanBadge = `<span class="chuyencan-badge chuyencan-upcoming">Chưa diễn ra</span>`;
                    } else if (isAttended) {
                        chuyenCanBadge = `<span class="chuyencan-badge chuyencan-attended">Đã học</span>`;
                    } else {
                        chuyenCanBadge = `<span class="chuyencan-badge chuyencan-absent">Chưa học</span>`;
                    }

                    // Xác định courseId dựa trên tên khóa học hoặc thuộc tính courseId trong dữ liệu
                    let targetCourseId = item.courseId || '';
                    if (!targetCourseId && khoaHoc) {
                        const foundCourse = coursesData.find(c => c.title.trim().toLowerCase() === khoaHoc.trim().toLowerCase());
                        if (foundCourse) targetCourseId = foundCourse.id;
                    }

                    // Tự động cho phép bấm "Vào học" khi đến thời gian bắt đầu (dù trạng thái ghi nhận là Chưa diễn ra)
                    const canJoin = !isUpcoming || isTimeReached;

                    // Button Vào học
                    let actionBtn = '';
                    if (!canJoin) {
                        actionBtn = `<button type="button" class="schedule-btn-join" disabled title="Chưa đến giờ học">Vào học</button>`;
                    } else if (lessonUrl && isSafeLessonUrl(lessonUrl)) {
                        const urlIndex = scheduleLessonUrls.push(lessonUrl) - 1;
                        actionBtn = `<button type="button" class="schedule-btn-join" onclick="openScheduleLesson(${urlIndex})">Vào học</button>`;
                    } else if (targetCourseId) {
                        actionBtn = `<button type="button" class="schedule-btn-join" onclick="goToCourseFromSchedule('${targetCourseId}')">Vào học</button>`;
                    } else {
                        actionBtn = `<button type="button" class="schedule-btn-join" onclick="navigateToPage('course-page')">Vào học</button>`;
                    }

                    return `
                        <tr class="${rowClass}">
                            <td class="text-center">${stt}</td>
                            <td class="text-center">${escapeHtml(ngayHocFormatted)}</td>
                            <td class="text-center">${escapeHtml(thoiGianBatDau)}</td>
                            <td class="text-center">${escapeHtml(thoiLuong)}</td>
                            <td class="text-left">${escapeHtml(khoaHoc)}</td>
                            <td class="text-left">${escapeHtml(noiDung)}</td>
                            <td class="text-center">${chuyenCanBadge}</td>
                            <td class="text-center">${actionBtn}</td>
                        </tr>
                    `;
                }).join('');
            }

            function loadScheduleData() {
                const userId = user ? user.id : '';
                const username = user ? user.username : '';

                const tbody = document.getElementById('schedule-table-body');

                if (!userId) {
                    if (tbody) {
                        tbody.innerHTML = `<tr><td colspan="8" class="text-center">Không xác định được ID người dùng.</td></tr>`;
                    }
                    return;
                }
                if (!username) {
                    if (tbody) {
                        tbody.innerHTML = `<tr><td colspan="8" class="text-center">Không xác định được Username.</td></tr>`;
                    }
                    return;
                }

                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="8" class="text-center">Đang tải dữ liệu lịch học...</td></tr>`;
                }

                callAppsScript({ action: 'getSchedule', id: userId, username: username })
                    .then(response => {
                        if (!response || !response.success) {
                            throw new Error(response && response.message ? response.message : 'Không thể tải dữ liệu lịch học.');
                        }
                        if (!Array.isArray(response.data)) {
                            throw new Error('Dữ liệu lịch học không hợp lệ.');
                        }

                        scheduleData = response.data;
                        scheduleLoaded = true;
                        renderScheduleTable(scheduleData);
                    })
                    .catch(error => {
                        console.error('Lỗi tải lịch học:', error);
                        scheduleLoaded = false;

                        if (tbody) {
                            tbody.innerHTML = `
                                <tr>
                                    <td colspan="8" class="text-center">
                                        Không thể tải dữ liệu lịch học.
                                        <br>
                                        <small>${escapeHtml(error.message || 'Vui lòng thử lại sau.')}</small>
                                    </td>
                                </tr>
                            `;
                        }

                        showToast(error.message || 'Không thể tải dữ liệu lịch học.', 'error');
                    });
            }

            

            loadScheduleData();
            // Hàm chuyển hướng từ Lịch học sang trang Khóa học tương ứng
            window.goToCourseFromSchedule = function(courseId) {
                // 1. Chuyển sang tab/trang Khóa học
                navigateToPage('course-page');
                
                // 2. Mở thông tin / truy cập khóa học
                if (typeof window.openCourse === 'function') {
                    window.openCourse(courseId);
                }
            };

            /* ==========================================
               5d. CHỨC NĂNG KẾT QUẢ HỌC TẬP (DỮ LIỆU THẬT TỪ GOOGLE SHEETS)
               ========================================== */
            let learningResultsData = [];
            let learningResultsLoaded = false;

            const courseFilterSelect = document.getElementById('study-course-filter');

            // Hiển thị điểm dạng văn bản thường, không badge/block màu — chỉ lớn hơn & đậm hơn chữ cùng dòng
            function formatScoreDisplay(score) {
                if (isEmptyDisplayValue(score) || isNaN(score)) return '';
                const num = parseFloat(score);
                return num.toFixed(2).replace(/\.00$/, '.0');
            }

            // Hàm tạo các lựa chọn filter động từ dữ liệu thật
            function populateLearningCourseFilter(data) {
                if (!courseFilterSelect) return;
                const currentLang = localStorage.getItem('qn-study-language') || 'vi';
                const allCoursesLabel = currentLang === 'en' ? 'All courses' : 'Tất cả khóa học';

                const uniqueCourses = [...new Set(
                    data
                        .map(item => item.course)
                        .filter(course => course && String(course).trim() !== '')
                )];

                courseFilterSelect.innerHTML = `<option value="all" data-i18n="allCourses">${allCoursesLabel}</option>`;
                uniqueCourses.forEach(course => {
                    const opt = document.createElement('option');
                    opt.value = course;
                    opt.textContent = course; // Giữ nguyên tên gốc từ Google Sheets
                    courseFilterSelect.appendChild(opt);
                });
            }

            // Hàm render Bảng dữ liệu từ learningResultsData (dữ liệu thật)
            function renderLearningResultsTable(data) {
                const thead = document.getElementById('study-result-thead');
                const tbody = document.getElementById('study-result-tbody');
                if (!thead || !tbody || !courseFilterSelect) return;

                const selectedFilter = courseFilterSelect.value;
                const isAll = (selectedFilter === 'all');
                const colSpan = isAll ? 5 : 4;

                // 1. Lọc dữ liệu theo Dropdown
                const filteredData = isAll
                    ? data
                    : data.filter(item => item.course === selectedFilter);

                // 2. Render <thead> (Ẩn/Hiện cột Khóa học)
                if (isAll) {
                    thead.innerHTML = `
                        <tr>
                            <th class="text-center" style="width: 60px;">STT</th>
                            <th>Khóa học</th>
                            <th>Nội dung đánh giá</th>
                            <th class="text-center" style="width: 140px;">Điểm đánh giá</th>
                            <th class="text-center" style="width: 150px;">Ghi chú</th>
                        </tr>
                    `;
                } else {
                    thead.innerHTML = `
                        <tr>
                            <th class="text-center" style="width: 60px;">STT</th>
                            <th>Nội dung đánh giá</th>
                            <th class="text-center" style="width: 140px;">Điểm đánh giá</th>
                            <th class="text-center" style="width: 150px;">Ghi chú</th>
                        </tr>
                    `;
                }

                // 3. Render <tbody> (Đánh lại STT tự động từ 1 sau mỗi lần lọc)
                if (filteredData.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center" style="padding: 24px;">Chưa có dữ liệu kết quả học tập.</td></tr>`;
                    return;
                }

                tbody.innerHTML = filteredData.map((item, index) => {
                    const stt = index + 1; // Đánh lại STT bắt đầu từ 1
                    const courseCol = isAll ? `<td><strong>${escapeHtml(item.course)}</strong></td>` : '';

                    return `
                        <tr>
                            <td class="text-center">${stt}</td>
                            ${courseCol}
                            <td>${escapeHtml(item.content)}</td>
                            <td class="text-center"><span class="score-display-plain">${escapeHtml(formatScoreDisplay(item.score))}</span></td>
                            <td class="text-center">${escapeHtml(item.note)}</td>
                        </tr>
                    `;
                }).join('');
            }

            // Tải dữ liệu Kết quả học tập từ Apps Script (Google Sheets)
            function loadLearningResults() {
                const userId = user ? user.id : '';
                const username = user ? user.username : '';

                const thead = document.getElementById('study-result-thead');
                const tbody = document.getElementById('study-result-tbody');

                if (!userId || !username) {
                    if (thead) thead.innerHTML = '';
                    if (tbody) tbody.innerHTML = `<tr><td class="text-center" style="padding: 24px;">Không xác định được thông tin người dùng. Vui lòng đăng nhập lại.</td></tr>`;
                    return;
                }

                if (thead) thead.innerHTML = '';
                if (tbody) tbody.innerHTML = `<tr><td class="text-center" style="padding: 24px;">Đang tải kết quả học tập...</td></tr>`;

                callAppsScript({ action: 'getLearningResults', id: userId, username: username })
                    .then(response => {
                        if (!response || !response.success) {
                            throw new Error((response && response.message) || 'Không thể tải kết quả học tập.');
                        }
                        learningResultsData = Array.isArray(response.data) ? response.data : [];
                        learningResultsLoaded = true;
                        populateLearningCourseFilter(learningResultsData);
                        renderLearningResultsTable(learningResultsData);
                    })
                    .catch(error => {
                        console.error('Lỗi tải kết quả học tập:', error);
                        learningResultsLoaded = false;
                        if (tbody) {
                            tbody.innerHTML = `
                                <tr>
                                    <td class="text-center" style="padding: 24px;">
                                        Không thể tải kết quả học tập.
                                        <br>
                                        <small>${escapeHtml(error.message || 'Vui lòng thử lại sau.')}</small>
                                    </td>
                                </tr>
                            `;
                        }
                        showToast(error.message || 'Không thể tải kết quả học tập.', 'error');
                    });
            }
                        /* ==========================================
               5d2. CHỨC NĂNG KẾT QUẢ HỌC TẬP ĐẠI HỌC (DÀNH RIÊNG CHO ADMINISTRATOR)
               ========================================== */

            // CONFIG - GOOGLE APPS SCRIPT RIÊNG CHO KẾT QUẢ HỌC TẬP ĐẠI HỌC
            // (TÁCH BIỆT HOÀN TOÀN VỚI APPS_SCRIPT_URL / callAppsScript() Ở TRÊN)
            const UNIVERSITY_RESULTS_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwbVG9tGB3zanX0oTt6USL8VL6SFniHnTabuuLfdW7KkuiwkL8qnjJfg1y0LFn3MYno/exec';

            function callUniversityResultsAppsScript(action, params, method) {
                method = method || 'GET';
                if (method === 'GET') {
                    const url = new URL(UNIVERSITY_RESULTS_APPS_SCRIPT_URL);
                    url.searchParams.append('action', action);
                    Object.keys(params || {}).forEach(key => {
                        if (params[key] !== undefined && params[key] !== null) {
                            url.searchParams.append(key, params[key]);
                        }
                    });
                    return fetch(url.toString()).then(res => {
                        if (!res.ok) throw new Error('Lỗi mạng: ' + res.status);
                        return res.json();
                    });
                }

                const payload = Object.assign({ action: action }, params || {});
                return fetch(UNIVERSITY_RESULTS_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                }).then(res => {
                    if (!res.ok) throw new Error('Lỗi mạng: ' + res.status);
                    return res.json();
                });
            }

            const isAdministrator = user && String(user.id).trim() === "Administrator";

            function getUniversityStudentId() {
                if (isAdministrator) {
                    return 'Administrator';
                }
                return (user && (user.id || user.studentId)) ? String(user.id || user.studentId) : '';
            }

            function getDisplayUniversityStudentId() {
                if (isAdministrator) {
                    return '755101235';
                }
                return (user && (user.id || user.studentId)) ? String(user.id || user.studentId) : '';
            }

            let universityResultsData = null;
            let universityResultsLoading = false;
            // State và helper cho thanh lọc/tìm kiếm kết quả học tập đại học
            const universityResultFilterDraft = { subject: "", year: "", semester: "" };
            let universityResultAppliedFilters = { subject: "", year: "", semester: "" };

            function normalizeSearchText(str) {
                if (!str) return "";
                return String(str)
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/đ/g, "d")
                    .replace(/Đ/g, "D")
                    .trim();
            }

            function getFilteredUniversityYears(data, filters) {
                if (!data || !Array.isArray(data.academicYears)) return [];
                const searchKey = normalizeSearchText(filters.subject);
                const targetYear = String(filters.year || "").trim();
                const targetSem = String(filters.semester || "").trim();

                const clonedYears = [];

                data.academicYears.forEach(y => {
                    const yYearNorm = String(y.year || "").replace(/\s+/g, "").trim();
                    const targetYearNorm = targetYear.replace(/\s+/g, "").trim();
                    if (targetYearNorm !== "" && yYearNorm !== targetYearNorm) {
                        return; // Bỏ qua năm không khớp
                    }

                    const filteredSemesters = [];
                    (y.semesters || []).forEach(s => {
                        if (targetSem !== "" && String(s.semester || "").trim() !== targetSem) {
                            return; // Bỏ qua học kỳ không khớp
                        }

                        const filteredSubjects = (s.subjects || []).filter(subj => {
                            if (searchKey === "") return true;
                            const codeNorm = normalizeSearchText(subj.code);
                            const nameNorm = normalizeSearchText(subj.name);
                            return codeNorm.includes(searchKey) || nameNorm.includes(searchKey);
                        });

                        // Nếu tìm theo môn mà học kỳ không có môn nào thì ẩn học kỳ đó
                        if (searchKey !== "" && filteredSubjects.length === 0) {
                            return;
                        }

                        filteredSemesters.push(Object.assign({}, s, { subjects: filteredSubjects }));
                    });

                    if (filteredSemesters.length > 0) {
                        clonedYears.push(Object.assign({}, y, { semesters: filteredSemesters }));
                    }
                });

                return clonedYears;
            }
            // DỮ LIỆU MẪU BẢNG ĐIỂM ĐẠI HỌC (CỐ ĐỊNH TẠI FRONT-END DEMO)
            const UNIVERSITY_ACADEMIC_SAMPLE_DATA = {
                academicYears: [
                    {
                        year: "2026-2027",
                        semesters: [
                            {
                                semester: "HK01",
                                subjects: [
                                    {
                                        stt: 1,
                                        code: "MATH211A",
                                        name: "Cấu trúc đại số cơ bản",
                                        credits: 5,
                                        score10: "",
                                        score4: "",
                                        letterGrade: "",
                                        passed: false,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "" }
                                        ]
                                    },
                                    {
                                        stt: 2,
                                        code: "MATH221A",
                                        name: "Giải tích thực một biến",
                                        credits: 4,
                                        score10: "",
                                        score4: "",
                                        letterGrade: "",
                                        passed: false,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "" }
                                        ]
                                    },
                                    {
                                        stt: 3,
                                        code: "MATH352A",
                                        name: "Lí luận, phương pháp dạy học và phương pháp dạy học bộ môn Toán học I",
                                        credits: 4,
                                        score10: "",
                                        score4: "",
                                        letterGrade: "",
                                        passed: false,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "" }
                                        ]
                                    },
                                    {
                                        stt: 4,
                                        code: "COMM005",
                                        name: "Đánh giá trong giáo dục",
                                        credits: 2,
                                        score10: "",
                                        score4: "",
                                        letterGrade: "",
                                        passed: false,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "" }
                                        ]
                                    },
                                    {
                                        stt: 5,
                                        code: "COMM001",
                                        name: "Thực hành kĩ năng giáo dục",
                                        credits: 2,
                                        score10: "",
                                        score4: "",
                                        letterGrade: "",
                                        passed: false,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "" }
                                        ]
                                    },
                                    {
                                        stt: 6,
                                        code: "POL1202",
                                        name: "Tư tưởng Hồ Chí Minh",
                                        credits: 2,
                                        score10: "",
                                        score4: "",
                                        letterGrade: "",
                                        passed: false,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "" }
                                        ]
                                    },
                                    {
                                        stt: 7,
                                        code: "PHYE250BD",
                                        name: "Giáo dục thể chất 3 (Bóng đá)",
                                        credits: 1,
                                        score10: "",
                                        score4: "",
                                        letterGrade: "",
                                        passed: false,
                                        note: "Không tính vào GPA",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "" }
                                        ]
                                    }
                                ],
                                summary: {
                                    semesterCredits: 0,
                                    average10: "",
                                    semesterGPA: "",
                                    cumulativeCreditsRatio: "0/0",
                                    cumulativeCPAWith10: ""
                                }
                            }
                        ],
                        summary: {
                            yearCredits: 0,
                            average10: "",
                            yearGPA: "",
                            cumulativeCreditsRatio: "0/0",
                            cumulativeCPAWith10: "",
                            academicRank: ""
                        }
                    },
                    {
                        year: "2025-2026",
                        semesters: [
                            {
                                semester: "HK01",
                                subjects: [
                                    {
                                        stt: 1,
                                        code: "PSYC101",
                                        name: "Tâm lí học giáo dục",
                                        credits: 4,
                                        score10: "7.9",
                                        score4: "3.5",
                                        letterGrade: "B+",
                                        passed: true,
                                        note: "",
                                        components: [{
                                                stt: 1,
                                                name: "Điểm thi lý thuyết",
                                                weight: "60%",
                                                score: "7.00"
                                            },
                                            {
                                                stt: 2,
                                                name: "Điểm Chuyên cần",
                                                weight: "10%",
                                                score: "10"
                                            },
                                            {
                                                stt: 3,
                                                name: "Điểm KT1",
                                                weight: "30%",
                                                score: "9.0"
                                            }]
                                    },
                                    {
                                        stt: 2,
                                        code: "PHIS105",
                                        name: "Triết học Mác - Lênin",
                                        credits: 3,
                                        score10: "8.3",
                                        score4: "3.5",
                                        letterGrade: "B+",
                                        passed: true,
                                        note: "",
                                        components: [
                                            {
                                                stt: 1,
                                                name: "Điểm thi lý thuyết",
                                                weight: "60%",
                                                score: "7.38"
                                            },
                                            {
                                                stt: 2,
                                                name: "Điểm Chuyên cần",
                                                weight: "10%",
                                                score: "10"
                                            },
                                            {
                                                stt: 3,
                                                name: "Điểm KT1",
                                                weight: "30%",
                                                score: "9.5"
                                            }]
                                    },
                                    {
                                        stt: 3,
                                        code: "MATH160",
                                        name: "Nhập môn lý thuyết ma trận",
                                        credits: 2,
                                        score10: "9.9",
                                        score4: "4.0",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            {
                                                stt: 1,
                                                name: "Điểm thi lý thuyết",
                                                weight: "60%",
                                                score: "10.00"
                                            },
                                            {
                                                stt: 2,
                                                name: "Điểm Chuyên cần",
                                                weight: "10%",
                                                score: "10"
                                            },
                                            {
                                                stt: 3,
                                                name: "Điểm KT1",
                                                weight: "30%",
                                                score: "9.5"
                                            }
                                        ]
                                    },
                                    {
                                        stt: 4,
                                        code: "MATH137",
                                        name: "Thống kê xã hội học",
                                        credits: 2,
                                        score10: "9.9",
                                        score4: "4.0",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            {
                                                stt: 1,
                                                name: "Điểm thi lý thuyết",
                                                weight: "60%",
                                                score: "10.00"
                                            },
                                            {
                                                stt: 2,
                                                name: "Điểm Chuyên cần",
                                                weight: "10%",
                                                score: "10"
                                            },
                                            {
                                                stt: 3,
                                                name: "Điểm KT1",
                                                weight: "30%",
                                                score: "9.5"
                                            }
                                        ]
                                    },
                                    {
                                        stt: 5,
                                        code: "PHYE150",
                                        name: "Giáo dục thể chất 1",
                                        credits: 1,
                                        score10: "4.1",
                                        score4: "1.0",
                                        letterGrade: "D",
                                        passed: true,
                                        note: "Không tính vào GPA",
                                        components: [{
                                                stt: 1,
                                                name: "Điểm thi lý thuyết",
                                                weight: "60%",
                                                score: "3.0"
                                            },
                                            {
                                                stt: 2,
                                                name: "Điểm Chuyên cần",
                                                weight: "10%",
                                                score: "5.0"
                                            },
                                            {
                                                stt: 3,
                                                name: "Điểm KT1",
                                                weight: "30%",
                                                score: "6.0"
                                            }]
                                    },
                                    {
                                        stt: 6,
                                        code: "POLI102",
                                        name: "Giáo dục pháp luật",
                                        credits: 0,
                                        score10: "-",
                                        score4: "-",
                                        letterGrade: "-",
                                        passed: false,
                                        note: "Ngoài chương trình",
                                        components: [{
                                                stt: 1,
                                                name: "Điểm thi lý thuyết",
                                                weight: "60%",
                                                score: "10"
                                            },
                                            {
                                                stt: 2,
                                                name: "Điểm Chuyên cần",
                                                weight: "10%",
                                                score: "10"
                                            },
                                            {
                                                stt: 3,
                                                name: "Điểm KT1",
                                                weight: "30%",
                                                score: "10"
                                            }]
                                    }
                                ],
                                summary: {
                                    semesterCredits: 11,
                                    average10: "8.74",
                                    semesterGPA: "3.68",
                                    trainingScore: "87.00",
                                    cumulativeCreditsRatio: "11/11",
                                    cumulativeCPAWith10: "3.68 (8.74)"
                                }
                            },
                            {
                                semester: "HK02",
                                subjects: [
                                    {
                                        stt: 7,
                                        code: "PSYC102",
                                        name: "Giáo dục học",
                                        credits: 3,
                                        score10: "8.8",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "8.50" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "9.0" }
                                        ]
                                    },
                                    {
                                        stt: 9,
                                        code: "MATH159",
                                        name: "Phép tính vi tích phân hàm một biến",
                                        credits: 3,
                                        score10: "10.0",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "10.00" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "10.0" }
                                        ]
                                    },
                                    {
                                        stt: 10,
                                        code: "COMM104",
                                        name: "Nhập môn KHTN và Công nghệ",
                                        credits: 3,
                                        score10: "9.4",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "9.75" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "8.5" }
                                        ]
                                    },
                                    {
                                        stt: 11,
                                        code: "COMP106",
                                        name: "Nhập môn Khoa học máy tính",
                                        credits: 2,
                                        score10: "8.9",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "9.00" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "8.4" }
                                        ]
                                    },
                                    {
                                        stt: 12,
                                        code: "POLI104",
                                        name: "Kinh tế chính trị Mác - Lênin",
                                        credits: 2,
                                        score10: "7.8",
                                        score4: "3.50",
                                        letterGrade: "B+",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "7.00" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "8.5" }
                                        ]
                                    },
                                    {
                                        stt: 13,
                                        code: "PHYE151",
                                        name: "Giáo dục thể chất 2",
                                        credits: 1,
                                        score10: "4.3",
                                        score4: "1.00",
                                        letterGrade: "D",
                                        passed: true,
                                        note: "Không tính vào GPA",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "2.00" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "7.0" }
                                        ]
                                    },
                                    {
                                        stt: 14,
                                        code: "DEFE105",
                                        name: "Học phần 1: Đường lối QP&AN của Đảng Cộng sản Việt Nam",
                                        credits: 3,
                                        score10: "8.7",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "Không tính vào GPA",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "8.80" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "8.0" }
                                        ]
                                    },
                                    {
                                        stt: 15,
                                        code: "DEFE106",
                                        name: "Học phần 2: Công tác QP&AN",
                                        credits: 2,
                                        score10: "7.1",
                                        score4: "3.00",
                                        letterGrade: "B",
                                        passed: true,
                                        note: "Không tính vào GPA",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "6.00" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "8.2" }
                                        ]
                                    },
                                    {
                                        stt: 16,
                                        code: "DEFE205",
                                        name: "Học phần 3: Quân sự chung",
                                        credits: 1,
                                        score10: "7.9",
                                        score4: "3.50",
                                        letterGrade: "B+",
                                        passed: true,
                                        note: "Không tính vào GPA",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "7.50" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "8.0" }
                                        ]
                                    },
                                    {
                                        stt: 17,
                                        code: "DEFE206",
                                        name: "Học phần 4: Kĩ thuật chiến đấu bộ binh và chiến thuật",
                                        credits: 2,
                                        score10: "8.9",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "Không tính vào GPA",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "9.70" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "7.0" }
                                        ]
                                    }
                                ],
                                summary: {
                                    semesterCredits: 13,
                                    average10: "9.08",
                                    semesterGPA: "3.92",
                                    trainingScore: "93.00",
                                    cumulativeCreditsRatio: "24/24",
                                    cumulativeCPAWith10: "3.81 (9.08)"
                                }
                            },
                            {
                                semester: "HK03",
                                subjects: [
                                    {
                                        stt: 1,
                                        code: "MATH231A",
                                        name: "Đại số tuyến tính",
                                        credits: 3,
                                        score10: "8.2",
                                        score4: "3.50",
                                        letterGrade: "B+",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "7.50" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "9.0" }
                                        ]
                                    },
                                    {
                                        stt: 2,
                                        code: "MATH245A",
                                        name: "Phần mềm Toán học",
                                        credits: 2,
                                        score10: "9.4",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "9.00" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "10.0" }
                                        ]
                                    },
                                    {
                                        stt: 3,
                                        code: "COMM201",
                                        name: "Lí luận dạy học",
                                        credits: 2,
                                        score10: "8.8",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "8.25" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "9.5" }
                                        ]
                                    },
                                    {
                                        stt: 4,
                                        code: "COMP105",
                                        name: "Phát triển năng lực số",
                                        credits: 2,
                                        score10: "10.0",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "10.00" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "10.0" }
                                        ]
                                    },
                                    {
                                        stt: 5,
                                        code: "POLI106",
                                        name: "Chủ nghĩa xã hội khoa học",
                                        credits: 2,
                                        score10: "9.6",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "9.40" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "10.0" }
                                        ]
                                    },
                                    {
                                        stt: 6,
                                        code: "POLI204",
                                        name: "Lịch sử Đảng Cộng sản Việt Nam",
                                        credits: 2,
                                        score10: "9.4",
                                        score4: "4.00",
                                        letterGrade: "A",
                                        passed: true,
                                        note: "",
                                        components: [
                                            { stt: 1, name: "Điểm thi lý thuyết", weight: "60%", score: "9.00" },
                                            { stt: 2, name: "Điểm Chuyên cần", weight: "10%", score: "10.0" },
                                            { stt: 3, name: "Điểm KT1", weight: "30%", score: "10.0" }
                                        ]
                                    }
                                ],
                                summary: {
                                    semesterCredits: 13,
                                    average10: "9.21",
                                    semesterGPA: "3.92",
                                    cumulativeCreditsRatio: "37/37",
                                    cumulativeCPAWith10: "3.84 (9.21)"
                                }
                            }
                        ]
                    }
                ]
            };

            // HÀM SẮP XẾP MÔN HỌC THEO ĐÚNG CÁC TIÊU CHÍ ĐÃ YÊU CẦU
            function sortLearningSubjects(subjects) {
                if (!Array.isArray(subjects)) return [];
                return [...subjects].sort((a, b) => {
                    const noteA = String(a.note || '').trim();
                    const noteB = String(b.note || '').trim();

                    // 1. Phân loại theo Trạng thái GPA
                    const getGroupRank = (note) => {
                        if (note === "Không tính vào GPA") return 1;
                        if (note === "Ngoài chương trình") return 2;
                        return 0; // Môn tính vào GPA
                    };

                    const groupA = getGroupRank(noteA);
                    const groupB = getGroupRank(noteB);
                    if (groupA !== groupB) return groupA - groupB;

                    const codeA = String(a.code || '').trim().toUpperCase();
                    const codeB = String(b.code || '').trim().toUpperCase();

                    // Nếu cùng thuộc nhóm Môn tính vào GPA (groupA === 0 && groupB === 0)
                    if (groupA === 0 && groupB === 0) {
                        const isMajorA = codeA.includes('MATH') || codeA.includes('A');
                        const isMajorB = codeB.includes('MATH') || codeB.includes('A');

                        // Ưu tiên chuyên ngành lên trước môn chung
                        if (isMajorA && !isMajorB) return -1;
                        if (!isMajorA && isMajorB) return 1;
                    }

                    // Số tín chỉ giảm dần
                    const creditsA = parseFloat(a.credits) || 0;
                    const creditsB = parseFloat(b.credits) || 0;
                    if (creditsA !== creditsB) {
                        return creditsB - creditsA;
                    }

                    // Mã môn tăng dần (alphabet/từ điển)
                    return codeA.localeCompare(codeB);
                });
            }
            // Hiển thị bộ chuyển đổi Chế độ xem dành riêng cho Administrator
            const adminModeSwitch = document.getElementById('admin-study-mode-switch');
            const btnModePersonal = document.getElementById('btn-mode-personal');
            const btnModeUniversity = document.getElementById('btn-mode-university');
            const personalView = document.getElementById('personal-study-result-view');
            const universityView = document.getElementById('university-study-result-view');

            if (isAdministrator && adminModeSwitch) {
                adminModeSwitch.style.display = 'flex';

                if (btnModePersonal && btnModeUniversity) {
                    btnModePersonal.addEventListener('click', () => {
                        btnModePersonal.classList.add('active');
                        btnModeUniversity.classList.remove('active');
                        if (personalView) personalView.style.display = 'block';
                        if (universityView) universityView.style.display = 'none';
                    });

                    btnModeUniversity.addEventListener('click', () => {
                        btnModeUniversity.classList.add('active');
                        btnModePersonal.classList.remove('active');
                        if (personalView) personalView.style.display = 'none';
                        if (universityView) universityView.style.display = 'block';

                        // Tải (hoặc dùng lại) dữ liệu bảng điểm Đại học từ Google Sheets
                        loadUniversityResults();
                    });
                }
            }

            // ==========================================
            // HÀM TÍNH TOÁN DÙNG CHUNG (MATHEMATICAL LOGIC ENGINE)
            // ==========================================

            // YÊU CẦU 3: Tính điểm tổng kết hệ 10 từ các điểm thành phần (components)
            function calculateScore10FromComponents(subject) {
                if (!subject || !Array.isArray(subject.components) || subject.components.length === 0) {
                    return "";
                }

                let sumWeightedScore = 0;
                let sumWeight = 0;
                let hasValidComponent = false;

                subject.components.forEach(comp => {
                    const scoreStr = String(comp.score !== undefined && comp.score !== null ? comp.score : "").trim();
                    if (scoreStr !== "" && !isNaN(scoreStr)) {
                        const val = parseFloat(scoreStr);
                        let w = 0;
                        const wStr = String(comp.weight || "").trim();
                        if (wStr.endsWith('%')) {
                            w = parseFloat(wStr.replace('%', '')) / 100;
                        } else {
                            w = parseFloat(wStr);
                        }

                        if (!isNaN(val) && !isNaN(w) && w > 0) {
                            sumWeightedScore += val * w;
                            sumWeight += w;
                            hasValidComponent = true;
                        }
                    }
                });

                if (!hasValidComponent || sumWeight === 0) {
                    return "";
                }

                const result = Math.round((sumWeightedScore / sumWeight) * 10) / 10;
                return result.toFixed(1);
            }

            // YÊU CẦU 4: Tính điểm hệ 4 từ score10
            function calculateScore4(score10) {
                if (score10 === "" || score10 === null || score10 === undefined || isNaN(score10)) {
                    return "";
                }
                const val = parseFloat(score10);
                if (val >= 8.5) return 4;
                if (val >= 7.8) return 3.5;
                if (val >= 7.0) return 3;
                if (val >= 6.3) return 2.5;
                if (val >= 5.5) return 2;
                if (val >= 4.8) return 1.5;
                if (val >= 4.0) return 1;
                if (val >= 0) return 0;
                return "";
            }

            // YÊU CẦU 5: Tính điểm chữ từ score4
            function calculateLetterGrade(score4) {
                if (score4 === "" || score4 === null || score4 === undefined || isNaN(score4)) {
                    return "";
                }
                const val = parseFloat(score4);
                if (val >= 4) return "A";
                if (val >= 3.5) return "B+";
                if (val >= 3) return "B";
                if (val >= 2.5) return "C+";
                if (val >= 2) return "C";
                if (val >= 1.5) return "D+";
                if (val >= 1) return "D";
                return "F";
            }

            // YÊU CẦU 6: Logic Đạt / Không đạt
            function calculatePassed(letterGrade) {
                if (!letterGrade || letterGrade === "") return false;
                return ["A", "B+", "B", "C+", "C", "D+", "D"].includes(letterGrade);
            }

            // YÊU CẦU 14: Xếp loại học lực
            function calculateAcademicRank(gpa) {
                if (gpa === "" || gpa === null || gpa === undefined || isNaN(gpa)) return "";
                const val = parseFloat(gpa);
                if (val >= 3.6) return "Xuất sắc";
                if (val >= 3.2) return "Giỏi";
                if (val >= 2.5) return "Khá";
                if (val >= 2.0) return "Trung bình";
                return "Yếu";
            }

            // YÊU CẦU 15: Xếp loại rèn luyện
            function calculateConductRank(trainingScore) {
                if (trainingScore === "" || trainingScore === null || trainingScore === undefined || isNaN(trainingScore)) return "";
                const val = parseFloat(trainingScore);
                if (val >= 90) return "Xuất sắc";
                if (val >= 80) return "Tốt";
                if (val >= 70) return "Khá";
                if (val >= 60) return "Trung bình";
                if (val >= 0) return "Yếu";
                return "";
            }

            // YÊU CẦU 16: Xếp loại sinh viên & Kiểm tra quy tắc rèn luyện theo học kỳ
            function isTrainingEvaluationApplicable(academicYear, semester) {
                // HK03 năm học 2025-2026 không có đánh giá rèn luyện
                if (academicYear === '2025-2026' && semester === 'HK03') {
                    return false;
                }
                return true;
            }

            function calculateStudentRank(academicRank, conductRank) {
                if (!academicRank || !conductRank) return "";

                if (academicRank === "Xuất sắc" && conductRank === "Xuất sắc") return "Xuất sắc";
                if (academicRank === "Xuất sắc" && conductRank === "Tốt") return "Giỏi";

                const academicScoreMap = { "Xuất sắc": 5, "Giỏi": 4, "Khá": 3, "Trung bình": 2, "Yếu": 1 };
                const conductScoreMap = { "Xuất sắc": 5, "Tốt": 4, "Khá": 3, "Trung bình": 2, "Yếu": 1 };

                const aVal = academicScoreMap[academicRank] || 0;
                const cVal = conductScoreMap[conductRank] || 0;
                const minVal = Math.min(aVal, cVal);

                const rankReverseMap = { 5: "Xuất sắc", 4: "Giỏi", 3: "Khá", 2: "Trung bình", 1: "Yếu" };
                return rankReverseMap[minVal] || "Yếu";
            }

            // Tái tính toán toàn bộ môn học
            function recalculateSubject(subj) {
                subj.score10 = calculateScore10FromComponents(subj);
                if (subj.score10 !== "") {
                    subj.score4 = String(calculateScore4(subj.score10));
                    subj.letterGrade = calculateLetterGrade(subj.score4);
                    subj.passed = calculatePassed(subj.letterGrade);
                } else {
                    subj.score4 = "";
                    subj.letterGrade = "";
                    subj.passed = false;
                }
            }

            // YÊU CẦU TÍNH TOÁN LẠI TOÀN BỘ KẾT QUẢ HỌC TẬP VỚI CÔNG THỨC TRUY HỒI CPA VÀ HỖ TRỢ HỌC KỲ KHÔNG CÓ ĐIỂM RÈN LUYỆN
            function recalculateAllResults(data) {
                if (!data || !Array.isArray(data.academicYears)) return;

                let cumulativeGPA4Numerator = 0;
                let cumulativeGPA4Denominator = 0;

                data.academicYears.forEach(y => {
                    (y.semesters || []).forEach(s => {
                        let semCreditsSum = 0;
                        let semScore10Numerator = 0;
                        let semScore10Denominator = 0;

                        let semGPA4Numerator = 0;
                        let semGPA4Denominator = 0;

                        let accumCreditsSum = 0;

                        (s.subjects || []).forEach(subj => {
                            recalculateSubject(subj);

                            const credits = parseFloat(subj.credits) || 0;
                            const isNoGPA = (subj.note === "Không tính vào GPA");
                            const isExtra = (subj.note === "Ngoài chương trình");

                            const hasAllComponents = Array.isArray(subj.components) && 
                                subj.components.length > 0 && 
                                subj.components.every(c => {
                                    const sVal = String(c.score !== undefined && c.score !== null ? c.score : "").trim();
                                    return sVal !== "" && !isNaN(Number(sVal));
                                });

                            if (hasAllComponents && !isNoGPA && !isExtra) {
                                accumCreditsSum += credits;
                            }

                            if (hasAllComponents && subj.score10 !== "" && !isNoGPA && !isExtra) {
                                semScore10Numerator += parseFloat(subj.score10) * credits;
                                semScore10Denominator += credits;
                            }

                            if (hasAllComponents && subj.score4 !== "" && !isNoGPA && !isExtra) {
                                const sc4 = parseFloat(subj.score4);
                                semGPA4Numerator += sc4 * credits;
                                semGPA4Denominator += credits;

                                cumulativeGPA4Numerator += sc4 * credits;
                                cumulativeGPA4Denominator += credits;
                            }
                        });

                        if (!s.summary) s.summary = {};

                        s.summary.semesterCredits = semCreditsSum;

                        if (semScore10Denominator > 0) {
                            s.summary.average10 = (Math.round((semScore10Numerator / semScore10Denominator) * 100) / 100).toFixed(2);
                        } else {
                            s.summary.average10 = "";
                        }

                        let rawSemesterGPA = 0;
                        if (semGPA4Denominator > 0) {
                            rawSemesterGPA = semGPA4Numerator / semGPA4Denominator;
                            s.summary.semesterGPA = (Math.round(rawSemesterGPA * 100) / 100).toFixed(2);
                        } else {
                            s.summary.semesterGPA = "";
                        }

                        s.summary.rawSemesterGPA = rawSemesterGPA;

                        // Tính CPA tích lũy chính xác từ tổng tích lũy hệ 4 chia cho tổng số tín chỉ tích lũy
                        let rawCumulativeCPA = 0;
                        if (cumulativeGPA4Denominator > 0) {
                            rawCumulativeCPA = cumulativeGPA4Numerator / cumulativeGPA4Denominator;
                            s.summary.rawCumulativeCPA = rawCumulativeCPA;
                            const roundedCpa = (Math.round(rawCumulativeCPA * 100) / 100).toFixed(2);
                            s.summary.cumulativeCPAWith10 = `${roundedCpa} (${s.summary.average10 || '-'})`;
                        } else {
                            s.summary.rawCumulativeCPA = 0;
                            s.summary.cumulativeCPAWith10 = "";
                        }

                        s.summary.cumulativeCreditsRatio = `${accumCreditsSum}/${accumCreditsSum}`;
                        s.summary.academicRank = calculateAcademicRank(s.summary.semesterGPA);

                        const hasTrainingEval = isTrainingEvaluationApplicable(y.year, s.semester);
                        if (!hasTrainingEval) {
                            delete s.summary.trainingScore;
                            s.summary.conductRank = "";
                            s.summary.studentRank = "";
                        } else {
                            if (s.summary.trainingScore !== undefined && s.summary.trainingScore !== null && String(s.summary.trainingScore).trim() !== "") {
                                s.summary.conductRank = calculateConductRank(s.summary.trainingScore);
                                s.summary.studentRank = calculateStudentRank(s.summary.academicRank, s.summary.conductRank);
                            } else {
                                s.summary.conductRank = "";
                                s.summary.studentRank = "";
                            }
                        }
                    });

                    // Tính toán tổng kết năm học (Year Summary)
                    let yearCompletedCreditsSum = 0;
                    let yearScore10Num = 0;
                    let yearScore10Den = 0;
                    let yearGPA4Num = 0;
                    let yearGPA4Den = 0;
                    let validTrainingScores = [];

                    (y.semesters || []).forEach(s => {
                        if (s.summary && s.summary.trainingScore !== undefined && s.summary.trainingScore !== null && String(s.summary.trainingScore).trim() !== "") {
                            const tVal = parseFloat(s.summary.trainingScore);
                            if (!isNaN(tVal)) validTrainingScores.push(tVal);
                        }

                        (s.subjects || []).forEach(subj => {
                            const credits = parseFloat(subj.credits) || 0;
                            const isNoGPA = (subj.note === "Không tính vào GPA");
                            const isExtra = (subj.note === "Ngoài chương trình");
                            
                            const hasAllComponents = Array.isArray(subj.components) && 
                                subj.components.length > 0 && 
                                subj.components.every(c => {
                                    const sVal = String(c.score !== undefined && c.score !== null ? c.score : "").trim();
                                    return sVal !== "" && !isNaN(Number(sVal));
                                });

                            // Tổng số tín chỉ trong năm học bao gồm TẤT CẢ các môn đã hoàn thành (kể cả Không tính vào GPA và Ngoài chương trình)
                            if (hasAllComponents) {
                                yearCompletedCreditsSum += credits;
                            }

                            if (hasAllComponents && subj.score10 !== "" && !isNoGPA && !isExtra) {
                                yearScore10Num += parseFloat(subj.score10) * credits;
                                yearScore10Den += credits;
                            }
                            if (hasAllComponents && subj.score4 !== "" && !isNoGPA && !isExtra) {
                                yearGPA4Num += parseFloat(subj.score4) * credits;
                                yearGPA4Den += credits;
                            }
                        });
                    });

                    if (!y.summary) y.summary = {};
                    y.summary.yearCredits = yearCompletedCreditsSum;

                    if (yearScore10Den > 0) {
                        y.summary.average10 = (Math.round((yearScore10Num / yearScore10Den) * 100) / 100).toFixed(2);
                    } else {
                        y.summary.average10 = "";
                    }

                    if (yearGPA4Den > 0) {
                        y.summary.yearGPA = (Math.round((yearGPA4Num / yearGPA4Den) * 100) / 100).toFixed(2);
                    } else {
                        y.summary.yearGPA = "";
                    }

                    if (validTrainingScores.length > 0) {
                        const sumT = validTrainingScores.reduce((a, b) => a + b, 0);
                        y.summary.trainingScore = (Math.round((sumT / validTrainingScores.length) * 100) / 100).toFixed(2);
                    } else {
                        y.summary.trainingScore = "";
                    }

                    const lastSem = y.semesters && y.semesters.length > 0 ? y.semesters[y.semesters.length - 1] : null;
                    if (lastSem && lastSem.summary) {
                        y.summary.cumulativeCreditsRatio = lastSem.summary.cumulativeCreditsRatio;
                        y.summary.cumulativeCPAWith10 = lastSem.summary.cumulativeCPAWith10;
                    } else {
                        y.summary.cumulativeCreditsRatio = "";
                        y.summary.cumulativeCPAWith10 = "";
                    }

                    y.summary.academicRank = calculateAcademicRank(y.summary.yearGPA);
                });
            }

                        function renderUniversityLoadingState() {
                const container = document.getElementById('uni-result-content-area');
                if (!container) return;
                container.innerHTML = `<div class="course-loading-state">Đang tải kết quả học tập Đại học...</div>`;
            }

            function renderUniversityErrorState(message) {
                const container = document.getElementById('uni-result-content-area');
                if (!container) return;
                container.innerHTML = `
                    <div class="course-error-state">
                        ${escapeHtml(message || 'Không thể tải kết quả học tập Đại học.')}
                        <br>
                        <button class="course-retry-btn" type="button" onclick="loadUniversityResults(true)">Thử lại</button>
                    </div>
                `;
            }

            // HÀM TÍNH TOÁN BẢNG TỔNG KẾT HIỆN TẠI TOÀN BỘ QUÁ TRÌNH HỌC (HNUE)
            function calculateUniversityCurrentSummary(data) {
                let totalAccumulatedCredits = 0;
                let totalCompletedCredits = 0;
                let num10Num = 0;
                let num10Den = 0;
                let trainingSum = 0;
                let trainingCount = 0;
                let lastCumulativeCPA = "";

                if (data && Array.isArray(data.academicYears)) {
                    data.academicYears.forEach(y => {
                        (y.semesters || []).forEach(s => {
                            if (s.summary) {
                                if (s.summary.trainingScore !== undefined && s.summary.trainingScore !== null && String(s.summary.trainingScore).trim() !== "") {
                                    const tVal = parseFloat(s.summary.trainingScore);
                                    if (!isNaN(tVal)) {
                                        trainingSum += tVal;
                                        trainingCount++;
                                    }
                                }
                                if (s.summary.cumulativeCPAWith10) {
                                    lastCumulativeCPA = s.summary.cumulativeCPAWith10;
                                }
                            }

                            (s.subjects || []).forEach(subj => {
                                const credits = parseFloat(subj.credits) || 0;
                                const isNoGPA = (subj.note === "Không tính vào GPA");
                                const isExtra = (subj.note === "Ngoài chương trình");

                                const hasAllComponents = Array.isArray(subj.components) && 
                                    subj.components.length > 0 && 
                                    subj.components.every(c => {
                                        const sVal = String(c.score !== undefined && c.score !== null ? c.score : "").trim();
                                        return sVal !== "" && !isNaN(Number(sVal));
                                    });

                                // TỔNG SỐ TÍN CHỈ ĐÃ HOÀN THÀNH: Tất cả môn đủ điểm (bao gồm Không tính vào GPA & Ngoài chương trình)
                                if (hasAllComponents) {
                                    totalCompletedCredits += credits;
                                }

                                // TỔNG SỐ TÍN CHỈ TÍCH LŨY: Chỉ tính môn đủ điểm, tính GPA, không tính môn đặc biệt
                                if (hasAllComponents && !isNoGPA && !isExtra) {
                                    totalAccumulatedCredits += credits;
                                    if (subj.score10 !== "" && subj.score10 !== null && subj.score10 !== undefined && !isNaN(subj.score10)) {
                                        num10Num += parseFloat(subj.score10) * credits;
                                        num10Den += credits;
                                    }
                                }
                            });
                        });
                    });
                }

                // Điểm trung bình hệ 10 tổng hợp
                let average10 = "";
                if (num10Den > 0) {
                    average10 = (Math.round((num10Num / num10Den) * 100) / 100).toFixed(2);
                }

                // CPA tích lũy hệ 4 & Điểm 10 từ chuỗi cumulativeCPAWith10 (VD: "3.84 (9.21)")
                let cumulativeCPA = "";
                if (lastCumulativeCPA) {
                    const parts = lastCumulativeCPA.split(' ');
                    if (parts.length > 0 && parts[0]) {
                        cumulativeCPA = parts[0];
                    }
                }

                // ĐRL trung bình toàn bộ học kỳ có dữ liệu
                let averageTrainingScore = "";
                if (trainingCount > 0) {
                    averageTrainingScore = (Math.round((trainingSum / trainingCount) * 100) / 100).toFixed(2);
                }

                // Xếp loại dựa trên CPA tích lũy hệ 4
                const numericCPA = parseFloat(cumulativeCPA);
                const academicRank = !isNaN(numericCPA) ? calculateAcademicRank(numericCPA) : "";

                // Lấy thông tin họ tên và mã sinh viên động từ user hiện tại
                const studentName = user ? (user.hoTen || user.fullName || user.name || 'Chưa xác định') : 'Chưa xác định';
                const studentIdCode = getDisplayUniversityStudentId();

                return {
                    fullName: studentName,
                    studentId: studentIdCode,
                    totalAccumulatedCredits: totalAccumulatedCredits,
                    totalCompletedCredits: totalCompletedCredits,
                    average10: average10,
                    cumulativeCPA: cumulativeCPA,
                    averageTrainingScore: averageTrainingScore,
                    academicRank: academicRank !== "" ? academicRank : "-"
                };
            }

            // Tải Bảng điểm Đại học TỪ GOOGLE SHEETS qua Apps Script riêng (nguồn lưu chính)
            function loadUniversityResults(forceReload) {
                if (universityResultsLoading) return;
                if (universityResultsData && !forceReload) {
                    renderUniversityResults(universityResultsData);
                    return;
                }

                const studentId = getUniversityStudentId();
                if (!studentId) {
                    renderUniversityErrorState('Không xác định được mã sinh viên. Vui lòng đăng nhập lại.');
                    return;
                }

                universityResultsLoading = true;
                renderUniversityLoadingState();

                callUniversityResultsAppsScript('getUniversityResults', { studentId: studentId }, 'GET')
                    .then(response => {
                        if (!response || !response.success || !response.data) {
                            throw new Error((response && response.message) || 'Không thể tải kết quả học tập Đại học.');
                        }
                        universityResultsData = response.data;
                        recalculateAllResults(universityResultsData);
                        renderUniversityResults(universityResultsData);
                    })
                    .catch(error => {
                        console.error('Lỗi tải kết quả học tập Đại học:', error);
                        universityResultsData = null;
                        renderUniversityErrorState(error.message);
                        showToast(error.message || 'Không thể tải kết quả học tập Đại học.', 'error');
                    })
                    .finally(() => {
                        universityResultsLoading = false;
                    });
            }

            // Render giao diện Bảng điểm Đại học trực quan
            function renderUniversityResults(data) {
                const container = document.getElementById('uni-result-content-area');
                if (!container || !data) return;

                const summary = calculateUniversityCurrentSummary(data);
                const filteredYears = getFilteredUniversityYears(data, universityResultAppliedFilters);

                // Lấy danh sách các năm học có sẵn trong dữ liệu gốc để render options động chính xác
                const availableYears = (data.academicYears || []).map(y => y.year);
                const distinctYears = Array.from(new Set(availableYears));

                let html = `
                    <div class="uni-current-summary">
                        <div class="uni-current-summary-logo">
                            <img src="logohnue.webp" alt="Logo HNUE">
                        </div>
                        <div class="uni-current-summary-grid">
                            <div class="uni-current-summary-item">
                                <span class="uni-current-summary-label">Họ và tên sinh viên:</span>
                                <span class="uni-current-summary-value">${escapeHtml(summary.fullName)}</span>
                            </div>
                            <div class="uni-current-summary-item">
                                <span class="uni-current-summary-label">Mã sinh viên:</span>
                                <span class="uni-current-summary-value">${escapeHtml(summary.studentId)}</span>
                            </div>
                            <div class="uni-current-summary-item">
                                <span class="uni-current-summary-label">Tổng số tín chỉ tích lũy:</span>
                                <span class="uni-current-summary-value">${isEmptyDisplayValue(summary.totalAccumulatedCredits) ? '' : summary.totalAccumulatedCredits}</span>
                            </div>
                            <div class="uni-current-summary-item">
                                <span class="uni-current-summary-label">Tổng số tín chỉ đã hoàn thành:</span>
                                <span class="uni-current-summary-value">${isEmptyDisplayValue(summary.totalCompletedCredits) ? '' : summary.totalCompletedCredits}</span>
                            </div>
                            <div class="uni-current-summary-item">
                                <span class="uni-current-summary-label">Điểm trung bình hệ 10:</span>
                                <span class="uni-current-summary-value">${isEmptyDisplayValue(summary.average10) ? '' : summary.average10}</span>
                            </div>
                            <div class="uni-current-summary-item">
                                <span class="uni-current-summary-label">Điểm CPA tích lũy:</span>
                                <span class="uni-current-summary-value">${isEmptyDisplayValue(summary.cumulativeCPA) ? '' : summary.cumulativeCPA}</span>
                            </div>
                            <div class="uni-current-summary-item">
                                <span class="uni-current-summary-label">ĐRL trung bình:</span>
                                <span class="uni-current-summary-value">${isEmptyDisplayValue(summary.averageTrainingScore) ? '' : summary.averageTrainingScore}</span>
                            </div>
                            <div class="uni-current-summary-item">
                                <span class="uni-current-summary-label">Xếp loại:</span>
                                <span class="uni-current-summary-value">${isEmptyDisplayValue(summary.academicRank) ? '' : escapeHtml(summary.academicRank)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="uni-result-filter-bar">
                        <div class="uni-result-filter-group">
                            <input type="text" id="uni-filter-subject" class="uni-result-filter-input" placeholder="Tìm môn học..." value="${escapeHtml(universityResultFilterDraft.subject)}" aria-label="Tìm kiếm môn học">
                        </div>
                        <div class="uni-result-filter-group">
                            <select id="uni-filter-year" class="uni-result-filter-select" aria-label="Chọn năm học">
                                <option value="" ${universityResultFilterDraft.year === "" ? "selected" : ""}>Tất cả năm học</option>
                                <option value="2025-2026" ${universityResultFilterDraft.year === "2025-2026" ? "selected" : ""}>2025 - 2026</option>
                                <option value="2026-2027" ${universityResultFilterDraft.year === "2026-2027" ? "selected" : ""}>2026 - 2027</option>
                                <option value="2027-2028" ${universityResultFilterDraft.year === "2027-2028" ? "selected" : ""}>2027 - 2028</option>
                                <option value="2028-2029" ${universityResultFilterDraft.year === "2028-2029" ? "selected" : ""}>2028 - 2029</option>
                                ${distinctYears.filter(y => !["2025-2026", "2026-2027", "2027-2028", "2028-2029"].includes(y)).map(y => `
                                    <option value="${escapeHtml(y)}" ${universityResultFilterDraft.year === y ? "selected" : ""}>${escapeHtml(y.replace("-", " - "))}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="uni-result-filter-group">
                            <select id="uni-filter-semester" class="uni-result-filter-select" ${!universityResultFilterDraft.year ? "disabled" : ""} aria-label="Chọn học kỳ">
                                <option value="" ${universityResultFilterDraft.semester === "" ? "selected" : ""}>Tất cả học kỳ</option>
                                <option value="HK01" ${universityResultFilterDraft.semester === "HK01" ? "selected" : ""}>Học kỳ 1: HK01</option>
                                <option value="HK02" ${universityResultFilterDraft.semester === "HK02" ? "selected" : ""}>Học kỳ 2: HK02</option>
                                <option value="HK03" ${universityResultFilterDraft.semester === "HK03" ? "selected" : ""}>Học kỳ 3: HK03</option>
                            </select>
                        </div>
                        <div class="uni-result-filter-group">
                            <button type="button" id="uni-filter-submit-btn" class="uni-result-filter-btn" aria-label="Tìm kiếm kết quả học tập">Tìm kiếm</button>
                        </div>
                    </div>

                    <div class="uni-table-responsive">
                        <table class="uni-table">
                            <thead>
                                <tr>
                                    <th style="width: 40px;">STT</th>
                                    <th style="width: 90px;">Mã HP</th>
                                    <th class="uni-col-name">Tên học phần</th>
                                    <th style="width: 50px;">Số TC</th>
                                    <th style="width: 70px;">Điểm 10</th>
                                    <th style="width: 70px;">Điểm 4</th>
                                    <th style="width: 70px;">Điểm chữ</th>
                                    <th style="width: 50px;">Đạt</th>
                                    <th class="uni-col-note">Ghi chú</th>
                                    <th style="width: 60px;">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                if (filteredYears.length === 0) {
                    html += `
                        <tr>
                            <td colspan="10" class="text-center" style="padding: 24px; color: var(--text-sub);">
                                Không tìm thấy môn học phù hợp với điều kiện tìm kiếm.
                            </td>
                        </tr>
                    `;
                } else {
                    filteredYears.forEach((y, yIdx) => {
                        html += `
                            <tr class="uni-group-row-year">
                                <td colspan="9">Năm học: ${escapeHtml(y.year)}</td>
                                <td class="text-center">
                                    <button type="button" class="uni-year-toggle-btn" data-year-idx="${yIdx}" aria-expanded="true" aria-label="Thu gọn năm học" title="Thu gọn năm học">▲</button>
                                </td>
                            </tr>
                        `;

                        (y.semesters || []).forEach((s, sIdx) => {
                            html += `
                                <tr class="uni-group-row-semester" data-year-container="${yIdx}" data-sem-row="${sIdx}">
                                    <td colspan="9">Học kỳ: ${escapeHtml(s.semester)}</td>
                                    <td class="text-center">
                                        <button type="button" class="uni-semester-toggle-btn" data-year-idx="${yIdx}" data-sem-idx="${sIdx}" aria-expanded="true" aria-label="Thu gọn học kỳ" title="Thu gọn học kỳ">▲</button>
                                    </td>
                                </tr>
                            `;

                            (s.subjects || []).forEach((subj, subjIdx) => {
                                const detailRowId = `subj-detail-row-${subj.code}`;
                                const cleanName = subj.name.replace(/\s*\*$/, '').trim();
                                const letterGrade = isEmptyDisplayValue(subj.letterGrade) ? '' : subj.letterGrade;
                                let letterClass = '';
                                if (letterGrade === 'A') letterClass = 'uni-grade-A';
                                else if (letterGrade === 'B+' || letterGrade === 'B') letterClass = 'uni-grade-Bplus';
                                else if (letterGrade === 'C+' || letterGrade === 'C') letterClass = 'uni-grade-Cplus';
                                else if (letterGrade === 'D+' || letterGrade === 'D') letterClass = 'uni-grade-Dplus';
                                else if (letterGrade === 'F') letterClass = 'uni-grade-F';

                                let passStatusHtml = '';
                                if (letterGrade === 'F') {
                                    passStatusHtml = '<span class="uni-failed-icon">×</span>';
                                } else if (subj.passed) {
                                    passStatusHtml = '<span class="uni-completed-icon">✓</span>';
                                }

                                let displayScore10 = '';
                                if (!isEmptyDisplayValue(subj.score10) && !isNaN(subj.score10)) {
                                    displayScore10 = (Math.round(parseFloat(subj.score10) * 10) / 10).toFixed(1);
                                }

                                let displayScore4 = '';
                                if (!isEmptyDisplayValue(subj.score4) && !isNaN(subj.score4)) {
                                    displayScore4 = (Math.round(parseFloat(subj.score4) * 10) / 10).toFixed(1);
                                }

                                html += `
                                    <tr data-year-idx="${yIdx}" data-sem-idx="${sIdx}" data-year-container="${yIdx}">
                                        <td class="text-center">${subj.stt || (subjIdx + 1)}</td>
                                        <td class="text-center"><strong>${escapeHtml(subj.code)}</strong></td>
                                        <td>${escapeHtml(cleanName)}</td>
                                        <td class="text-center">${subj.credits}</td>
                                        <td class="uni-col-score10">${displayScore10}</td>
                                        <td class="uni-col-score4">${displayScore4}</td>
                                        <td class="uni-col-grade ${letterClass}">${letterGrade}</td>
                                        <td class="text-center">${passStatusHtml}</td>
                                        <td>${escapeHtml(subj.note || '')}</td>
                                        <td class="text-center">
                                            <button type="button" class="uni-btn-detail university-detail-btn" data-subject-code="${escapeHtml(subj.code)}" title="Xem chi tiết điểm thành phần">✎</button>
                                        </td>
                                    </tr>
                                    <tr id="${detailRowId}" class="uni-detail-row" data-year-idx="${yIdx}" data-sem-idx="${sIdx}" data-year-container="${yIdx}" style="display: none;">
                                        <td colspan="10">
                                            <div style="font-weight: 700; margin-bottom: 8px; color: #1565C0;">
                                                Chi tiết học phần: ${escapeHtml(subj.code)} - ${escapeHtml(cleanName)}
                                            </div>
                                            ${(subj.components && subj.components.length > 0) ? `
                                                <table class="uni-detail-table">
                                                    <thead>
                                                        <tr>
                                                            <th style="width: 45px;">STT</th>
                                                            <th>Tên thành phần</th>
                                                            <th style="width: 90px;">Trọng số</th>
                                                            <th style="width: 90px;">Điểm</th>
                                                            <th style="width: 140px;">Thao tác</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${subj.components.map((c, cIdx) => {
                                                        let displayCompScore = '';
                                                        if (!isEmptyDisplayValue(c.score) && !isNaN(c.score)) {
                                                            const num = parseFloat(c.score);
                                                            const cNameLower = String(c.name || '').toLowerCase();

                                                            if (cNameLower.includes('thi') || cNameLower.includes('lý thuyết')) {
                                                                displayCompScore = (Math.round(num * 100) / 100).toFixed(2);
                                                            } else {
                                                                displayCompScore = (Math.round(num * 10) / 10).toFixed(1);
                                                            }
                                                        }

                                                        let displayWeight = c.weight;
                                                        const wStr = String(c.weight || '').trim();
                                                        if (wStr !== '' && !wStr.endsWith('%') && !isNaN(wStr)) {
                                                            const wNum = parseFloat(wStr);
                                                            if (wNum > 0 && wNum <= 1) {
                                                                displayWeight = `${Math.round(wNum * 100)}%`;
                                                            } else if (wNum > 1) {
                                                                displayWeight = `${wNum}%`;
                                                            }
                                                        }

                                                        return `
                                                            <tr>
                                                                <td class="text-center">${c.stt || (cIdx + 1)}</td>
                                                                <td>${escapeHtml(c.name)}</td>
                                                                <td class="text-center">${displayWeight}</td>
                                                                    <td class="text-center"><strong>${displayCompScore}</strong></td>
                                                                    <td class="text-center">
                                                                        <button type="button" class="uni-btn-edit btn-open-edit-score" data-year-idx="${yIdx}" data-sem-idx="${sIdx}" data-subj-code="${escapeHtml(subj.code)}" data-comp-idx="${cIdx}">
                                                                            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                                            <span>Chỉnh sửa</span>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            `;
                                                        }).join('')}
                                                    </tbody>
                                                </table>
                                            ` : `
                                                <div style="font-style: italic; color: var(--text-sub); text-align: center; padding: 8px 0;">
                                                    Chưa có dữ liệu điểm thành phần.
                                                </div>
                                            `}
                                        </td>
                                    </tr>
                                `;
                            });

                            if (s.summary) {
                                const sum = s.summary;
                                const hasTraining = (sum.trainingScore !== undefined && sum.trainingScore !== null && String(sum.trainingScore).trim() !== "");

                                const isTrainingApplicable = isTrainingEvaluationApplicable(y.year, s.semester);
                                const hasTrainingScoreValue = (sum.trainingScore !== undefined && sum.trainingScore !== null && String(sum.trainingScore).trim() !== "");

                                html += `
                                    <tr data-year-container="${yIdx}">
                                        <td colspan="10" style="padding: 0; border: none;">
                                            <div class="uni-summary-box-school">
                                                <div class="uni-sum-col">
                                                    <div class="uni-sum-row"><span class="uni-sum-label">Tổng số tín chỉ trong học kỳ:</span><span class="uni-sum-val">${isEmptyDisplayValue(sum.semesterCredits) ? '' : sum.semesterCredits}</span></div>
                                                    ${isTrainingApplicable ? `
                                                        <div class="uni-sum-row">
                                                            <span class="uni-sum-label">Điểm rèn luyện học kỳ:</span>
                                                            <span class="uni-sum-val uni-sum-val-clickable btn-open-edit-training" data-year-idx="${yIdx}" data-sem-idx="${sIdx}">${hasTrainingScoreValue ? sum.trainingScore : 'Nhập'}</span>
                                                        </div>
                                                    ` : ''}
                                                    <div class="uni-sum-row"><span class="uni-sum-label">Số tín chỉ tích lũy:</span><span class="uni-sum-val">${sum.cumulativeCreditsRatio && !isEmptyDisplayValue(sum.cumulativeCreditsRatio.split('/')[0]) ? sum.cumulativeCreditsRatio.split('/')[0] : ''}</span></div>
                                                </div>
                                                <div class="uni-sum-col">
                                                    <div class="uni-sum-row"><span class="uni-sum-label">Điểm trung bình hệ 10:</span><span class="uni-sum-val">${isEmptyDisplayValue(sum.average10) ? '' : sum.average10}</span></div>
                                                    <div class="uni-sum-row"><span class="uni-sum-label">GPA học kỳ (Điểm TB hệ 4):</span><span class="uni-sum-val">${isEmptyDisplayValue(sum.semesterGPA) ? '' : sum.semesterGPA}</span></div>
                                                    <div class="uni-sum-row"><span class="uni-sum-label">CPA tích lũy:</span><span class="uni-sum-val">${sum.cumulativeCPAWith10 && !isEmptyDisplayValue(sum.cumulativeCPAWith10.split(' ')[0]) ? sum.cumulativeCPAWith10.split(' ')[0] : ''}</span></div>
                                                </div>
                                                <div class="uni-sum-col">
                                                    <div class="uni-sum-row"><span class="uni-sum-label">Xếp loại học lực:</span><span class="uni-sum-val">${isEmptyDisplayValue(sum.academicRank) ? '' : sum.academicRank}</span></div>
                                                    ${isTrainingApplicable ? `
                                                        <div class="uni-sum-row"><span class="uni-sum-label">Xếp loại rèn luyện:</span><span class="uni-sum-val">${isEmptyDisplayValue(sum.conductRank) ? '' : sum.conductRank}</span></div>
                                                        <div class="uni-sum-row"><span class="uni-sum-label">Xếp loại tổng kết:</span><span class="uni-sum-val">${isEmptyDisplayValue(sum.studentRank) ? '' : sum.studentRank}</span></div>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }
                        });

                        if (y.summary) {
                            const ySum = y.summary;
                            const hasYearTraining = (ySum.trainingScore !== undefined && ySum.trainingScore !== null && String(ySum.trainingScore).trim() !== "");
                            html += `
                                <tr class="uni-year-summary-row" data-year-container="${yIdx}">
                                    <td colspan="10" style="padding: 0; border: none;">
                                        <div class="uni-summary-box-school uni-summary-box-year">
                                            <div class="uni-sum-col">
                                                <div class="uni-sum-row"><span class="uni-sum-label">Tổng số tín chỉ trong năm học:</span><span class="uni-sum-val">${isEmptyDisplayValue(ySum.yearCredits) ? '' : ySum.yearCredits}</span></div>
                                                <div class="uni-sum-row"><span class="uni-sum-label">ĐRL tích lũy:</span><span class="uni-sum-val">${hasYearTraining ? ySum.trainingScore : ''}</span></div>
                                                <div class="uni-sum-row"><span class="uni-sum-label">Số tín chỉ tích lũy:</span><span class="uni-sum-val">${ySum.cumulativeCreditsRatio && !isEmptyDisplayValue(ySum.cumulativeCreditsRatio.split('/')[0]) ? ySum.cumulativeCreditsRatio.split('/')[0] : ''}</span></div>
                                            </div>
                                            <div class="uni-sum-col">
                                                <div class="uni-sum-row"><span class="uni-sum-label">Điểm trung bình hệ 10:</span><span class="uni-sum-val">${isEmptyDisplayValue(ySum.average10) ? '' : ySum.average10}</span></div>
                                                <div class="uni-sum-row"><span class="uni-sum-label">Điểm trung bình tích lũy hệ 4:</span><span class="uni-sum-val">${isEmptyDisplayValue(ySum.yearGPA) ? '' : ySum.yearGPA}</span></div>
                                                <div class="uni-sum-row"><span class="uni-sum-label">CPA tích lũy:</span><span class="uni-sum-val">${ySum.cumulativeCPAWith10 && !isEmptyDisplayValue(ySum.cumulativeCPAWith10.split(' ')[0]) ? ySum.cumulativeCPAWith10.split(' ')[0] : ''}</span></div>
                                            </div>
                                            <div class="uni-sum-col">
                                                <div class="uni-sum-row"><span class="uni-sum-label">Xếp loại:</span><span class="uni-sum-val">${isEmptyDisplayValue(ySum.academicRank) ? '' : ySum.academicRank}</span></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }
                    });
                }

                html += `
                            </tbody>
                        </table>
                    </div>
                `;

                container.innerHTML = html;
                bindUniversitySemesterToggleEvents();
                bindUniversityYearToggleEvents();
                bindUniversityDetailEvents();
                bindUniversityEditEvents();
                // Gắn event listener cho bộ lọc giao diện
                const inputSubj = document.getElementById('uni-filter-subject');
                const selectYear = document.getElementById('uni-filter-year');
                const selectSem = document.getElementById('uni-filter-semester');
                const btnSubmit = document.getElementById('uni-filter-submit-btn');

                if (inputSubj) {
                    inputSubj.addEventListener('input', (e) => {
                        universityResultFilterDraft.subject = e.target.value;
                    });
                    inputSubj.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (btnSubmit) btnSubmit.click();
                        }
                    });
                }

                if (selectYear) {
                    selectYear.addEventListener('change', (e) => {
                        const yVal = e.target.value;
                        universityResultFilterDraft.year = yVal;
                        if (!yVal) {
                            universityResultFilterDraft.semester = "";
                            if (selectSem) {
                                selectSem.value = "";
                                selectSem.disabled = true;
                            }
                        } else {
                            if (selectSem) selectSem.disabled = false;
                        }
                        universityResultAppliedFilters = Object.assign({}, universityResultFilterDraft);
                        renderUniversityResults(universityResultsData);
                    });
                }

                if (selectSem) {
                    selectSem.addEventListener('change', (e) => {
                        universityResultFilterDraft.semester = e.target.value;
                        universityResultAppliedFilters = Object.assign({}, universityResultFilterDraft);
                        renderUniversityResults(universityResultsData);
                    });
                }

                if (btnSubmit) {
                    btnSubmit.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (!universityResultFilterDraft.year) {
                            universityResultFilterDraft.semester = "";
                        }
                        universityResultAppliedFilters = Object.assign({}, universityResultFilterDraft);
                        renderUniversityResults(universityResultsData);
                    });
                }
            }

            // Gán sự kiện cho nút Thu gọn / Mở rộng năm học
            function bindUniversityYearToggleEvents() {
                const yearToggleBtns = document.querySelectorAll('.uni-year-toggle-btn');
                yearToggleBtns.forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        const yIdx = this.getAttribute('data-year-idx');
                        const isExpanded = this.getAttribute('aria-expanded') === 'true';

                        // Chỉ ẩn/hiện các hàng thuộc học kỳ và môn học, GIỮ LẠI thanh tổng kết năm học (.uni-year-summary-row)
                        const contentRows = document.querySelectorAll(`tr[data-year-container="${yIdx}"]:not(.uni-year-summary-row)`);

                        if (isExpanded) {
                            contentRows.forEach(row => {
                                row.style.display = 'none';
                            });
                            this.textContent = '▼';
                            this.setAttribute('aria-expanded', 'false');
                            this.setAttribute('aria-label', 'Mở rộng năm học');
                            this.setAttribute('title', 'Mở rộng năm học');
                        } else {
                            contentRows.forEach(row => {
                                // Chỉ mở lại các hàng không phải detail row ẩn
                                if (!row.classList.contains('uni-detail-row')) {
                                    row.style.display = '';
                                }
                            });
                            this.textContent = '▲';
                            this.setAttribute('aria-expanded', 'true');
                            this.setAttribute('aria-label', 'Thu gọn năm học');
                            this.setAttribute('title', 'Thu gọn năm học');
                        }
                    });
                });
            }

            // Gán sự kiện cho nút Thu gọn / Mở rộng học kỳ
            function bindUniversitySemesterToggleEvents() {
                const toggleBtns = document.querySelectorAll('.uni-semester-toggle-btn');
                toggleBtns.forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        const yIdx = this.getAttribute('data-year-idx');
                        const sIdx = this.getAttribute('data-sem-idx');
                        const isExpanded = this.getAttribute('aria-expanded') === 'true';

                        // Tìm tất cả các hàng môn học và detail row thuộc học kỳ này
                        const subjectRows = document.querySelectorAll(`tr[data-year-idx="${yIdx}"][data-sem-idx="${sIdx}"]`);

                        if (isExpanded) {
                            // THU GỌN HỌC KỲ
                            subjectRows.forEach(row => {
                                row.style.display = 'none';
                                // Nếu là detail row của môn học thì đóng icon chi tiết của môn đó về ✎
                                if (row.classList.contains('uni-detail-row')) {
                                    const code = row.id.replace('subj-detail-row-', '');
                                    const detailBtn = document.querySelector(`.university-detail-btn[data-subject-code="${code}"]`);
                                    if (detailBtn) detailBtn.textContent = '✎';
                                }
                            });
                            this.textContent = '▼';
                            this.setAttribute('aria-expanded', 'false');
                            this.setAttribute('aria-label', 'Mở rộng học kỳ');
                            this.setAttribute('title', 'Mở rộng học kỳ');
                        } else {
                            // MỞ RỘNG HỌC KỲ
                            subjectRows.forEach(row => {
                                // Chỉ hiện lại các hàng môn học, giữ uni-detail-row ở trạng thái ẩn mặc định
                                if (!row.classList.contains('uni-detail-row')) {
                                    row.style.display = 'table-row';
                                } else {
                                    row.style.display = 'none';
                                }
                            });
                            this.textContent = '▲';
                            this.setAttribute('aria-expanded', 'true');
                            this.setAttribute('aria-label', 'Thu gọn học kỳ');
                            this.setAttribute('title', 'Thu gọn học kỳ');
                        }
                    });
                });
            }

            // Gán sự kiện cho nút Chi tiết
            function bindUniversityDetailEvents() {
                const buttons = document.querySelectorAll('.university-detail-btn');
                buttons.forEach(button => {
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        const code = this.getAttribute('data-subject-code');
                        const targetRowId = `subj-detail-row-${code}`;
                        const targetRow = document.getElementById(targetRowId);

                        if (!targetRow) return;

                        const isCurrentlyVisible = targetRow.style.display !== 'none';

                        document.querySelectorAll('.uni-detail-row').forEach(row => {
                            row.style.display = 'none';
                        });
                        document.querySelectorAll('.university-detail-btn').forEach(btn => {
                            btn.textContent = '✎';
                        });

                        if (!isCurrentlyVisible) {
                            targetRow.style.display = 'table-row';
                            this.textContent = '▲';
                        }
                    });
                });
            }

            // Gán sự kiện cho nút Chỉnh sửa điểm thành phần đơn lẻ & Điểm rèn luyện
            let currentEditingSubject = null;
            let currentEditingCompIdx = null;
            let currentEditingSemester = null;

            function bindUniversityEditEvents() {
                // Sự kiện bấm nút [ ✎ Chỉnh sửa ] ở 1 thành phần điểm cụ thể
                const editButtons = document.querySelectorAll('.btn-open-edit-score');
                editButtons.forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        const yIdx = parseInt(this.getAttribute('data-year-idx'), 10);
                        const sIdx = parseInt(this.getAttribute('data-sem-idx'), 10);
                        const code = this.getAttribute('data-subj-code');
                        const compIdx = parseInt(this.getAttribute('data-comp-idx'), 10);

                        const subj = universityResultsData.academicYears[yIdx].semesters[sIdx].subjects.find(item => item.code === code);
                        if (!subj || !Array.isArray(subj.components) || !subj.components[compIdx]) return;

                        currentEditingSubject = subj;
                        currentEditingCompIdx = compIdx;

                        const comp = subj.components[compIdx];

                        const modalInfo = document.getElementById('modal-subj-info');
                        if (modalInfo) {
                            modalInfo.textContent = `${subj.code} - ${subj.name}`;
                        }

                        // Chỉ render duy nhất 1 ô nhập điểm cho thành phần được chọn
                        const container = document.getElementById('modal-components-inputs-container');
                        if (container) {
                            container.innerHTML = `
                                <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                                    <label class="form-label" style="font-weight: 700; color: #1e293b;">${escapeHtml(comp.name)} (${comp.weight}):</label>
                                    <input type="number" step="any" min="0" max="10" id="single-component-score-input" class="course-search-input score-input-custom" value="${comp.score || ''}" placeholder="Nhập điểm từ 0 đến 10" autofocus>
                                </div>
                            `;
                        }

                        const modalOverlay = document.getElementById('edit-uni-score-modal-overlay');
                        if (modalOverlay) modalOverlay.classList.add('active');
                    });
                });

                // Sự kiện bấm sửa điểm rèn luyện
                const trainingBtns = document.querySelectorAll('.btn-open-edit-training');
                trainingBtns.forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        const yIdx = parseInt(this.getAttribute('data-year-idx'), 10);
                        const sIdx = parseInt(this.getAttribute('data-sem-idx'), 10);

                        const sem = universityResultsData.academicYears[yIdx].semesters[sIdx];
                        if (!sem) return;

                        currentEditingSemester = sem;

                        const inputTraining = document.getElementById('input-training-score');
                        if (inputTraining) {
                            inputTraining.value = (sem.summary && sem.summary.trainingScore !== undefined && sem.summary.trainingScore !== null && String(sem.summary.trainingScore).trim() !== '') ? sem.summary.trainingScore : '';
                        }

                        const modalOverlay = document.getElementById('edit-training-score-modal-overlay');
                        if (modalOverlay) modalOverlay.classList.add('active');
                    });
                });
            }

            // Xử lý submit Form Chỉnh sửa 1 điểm thành phần (Background Save + Optimistic UI + Anti Race-Condition)
            const editScoreForm = document.getElementById('edit-uni-score-form');
            const editScoreOverlay = document.getElementById('edit-uni-score-modal-overlay');
            const btnCloseEditScore = document.getElementById('btn-close-edit-uni-score');
            const btnCancelEditScore = document.getElementById('btn-cancel-edit-uni-score');

            // Registry lưu token/version mới nhất cho từng [subjectCode]_[componentStt]
            const pendingScoreVersions = {};

            function closeEditScoreModal() {
                if (editScoreOverlay) editScoreOverlay.classList.remove('active');
                currentEditingSubject = null;
                currentEditingCompIdx = null;
            }

            if (btnCloseEditScore) btnCloseEditScore.addEventListener('click', closeEditScoreModal);
            if (btnCancelEditScore) btnCancelEditScore.addEventListener('click', closeEditScoreModal);

            if (editScoreForm) {
                editScoreForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    if (!currentEditingSubject || currentEditingCompIdx === null || !Array.isArray(currentEditingSubject.components)) return;

                    const input = document.getElementById('single-component-score-input');
                    if (!input) return;

                    const valStr = input.value.trim();
                    let newScoreValue = "";
                    if (valStr !== "") {
                        const val = parseFloat(valStr);
                        if (isNaN(val) || val < 0 || val > 10) {
                            showToast("Điểm nhập vào phải là số từ 0 đến 10.", "error");
                            return;
                        }
                        const compNameLower = String(currentEditingSubject.components[currentEditingCompIdx].name || '').toLowerCase();

                        if (compNameLower.includes('thi') || compNameLower.includes('lý thuyết')) {
                            newScoreValue = (Math.round(val * 100) / 100).toString();
                        } else {
                            newScoreValue = (Math.round(val * 10) / 10).toString();
                        }
                    }

                    // 1. Snapshot thông tin cần thiết trước khi đóng modal
                    const snapshotSubject = currentEditingSubject;
                    const snapshotCompIdx = currentEditingCompIdx;
                    const targetSubjectCode = snapshotSubject.code;
                    const targetCompIdx = snapshotCompIdx;

                    let targetYear = null;
                    let targetSemesterObj = null;
                    for (const y of universityResultsData.academicYears) {
                        for (const s of y.semesters) {
                            if (s.subjects.some(item => item === snapshotSubject)) {
                                targetYear = y.year;
                                targetSemesterObj = s;
                                break;
                            }
                        }
                        if (targetYear) break;
                    }
                    if (!targetYear || !targetSemesterObj) {
                        showToast("Không xác định được vị trí bản ghi điểm cần lưu.", "error");
                        return;
                    }
                    const targetSemesterCode = targetSemesterObj.semester;
                    const componentStt = (snapshotSubject.components[targetCompIdx].stt !== undefined && snapshotSubject.components[targetCompIdx].stt !== null)
                        ? snapshotSubject.components[targetCompIdx].stt
                        : (targetCompIdx + 1);

                    // Tạo version/token riêng biệt cho operation này để chống race condition
                    const versionKey = `${targetSubjectCode}_${componentStt}`;
                    const currentOperationVersion = (pendingScoreVersions[versionKey] || 0) + 1;
                    pendingScoreVersions[versionKey] = currentOperationVersion;

                    // 2. Cập nhật FRONT-END ngay lập tức (Optimistic update)
                    snapshotSubject.components[targetCompIdx].score = newScoreValue;
                    recalculateAllResults(universityResultsData);
                    renderUniversityResults(universityResultsData);

                    // 3. ĐÓNG HỘP THOẠI NGAY LẬP TỨC
                    closeEditScoreModal();

                    // 4. Chuẩn bị payload snapshot cho background request
                    const updatedSubjectSnapshot = {
                        score10: snapshotSubject.score10,
                        score4: snapshotSubject.score4,
                        letterGrade: snapshotSubject.letterGrade,
                        passed: snapshotSubject.passed
                    };
                    const summariesSnapshot = universityResultsData.academicYears.flatMap(y => y.semesters.map(s => ({
                        academicYear: y.year,
                        semester: s.semester,
                        semesterCredits: s.summary.semesterCredits,
                        average10: s.summary.average10,
                        semesterGPA: s.summary.semesterGPA,
                        trainingScore: s.summary.trainingScore,
                        cumulativeCreditsRatio: s.summary.cumulativeCreditsRatio,
                        cumulativeCPAWith10: s.summary.cumulativeCPAWith10,
                        academicRank: s.summary.academicRank,
                        conductRank: s.summary.conductRank,
                        studentRank: s.summary.studentRank
                    })));

                    // 5. Khởi chạy request ngầm ở BACKGROUND (Không await, không block UI)
                    callUniversityResultsAppsScript('saveUniversityComponentScore', {
                        studentId: getUniversityStudentId(),
                        academicYear: targetYear,
                        semester: targetSemesterCode,
                        subjectCode: targetSubjectCode,
                        componentStt: componentStt,
                        score: newScoreValue,
                        subject: updatedSubjectSnapshot,
                        summaries: summariesSnapshot
                    }, 'POST')
                    .then(response => {
                        if (!response || !response.success) {
                            throw new Error((response && response.message) || 'Không thể lưu điểm. Vui lòng thử lại.');
                        }

                        // Kiểm tra Race Condition: Chỉ chấp nhận response nếu đây là operation mới nhất của component này
                        if (pendingScoreVersions[versionKey] === currentOperationVersion) {
                            showToast("Đã lưu điểm thành công.", "success");
                        }
                    })
                    .catch(error => {
                        console.error('Lỗi lưu điểm thành phần Đại học (Background):', error);
                        // Kiểm tra nếu đây vẫn là request mới nhất thì mới báo lỗi / xử lý
                        if (pendingScoreVersions[versionKey] === currentOperationVersion) {
                            showToast(error.message || 'Không thể lưu điểm. Vui lòng thử lại.', 'error');
                        }
                    });
                });
            }

            // Xử lý submit Form Điểm rèn luyện
            const editTrainingForm = document.getElementById('edit-training-score-form');
            const editTrainingOverlay = document.getElementById('edit-training-score-modal-overlay');
            const btnCloseEditTraining = document.getElementById('btn-close-edit-training-score');
            const btnCancelEditTraining = document.getElementById('btn-cancel-edit-training-score');

            function closeEditTrainingModal() {
                if (editTrainingOverlay) editTrainingOverlay.classList.remove('active');
                currentEditingSemester = null;
            }

            if (btnCloseEditTraining) btnCloseEditTraining.addEventListener('click', closeEditTrainingModal);
            if (btnCancelEditTraining) btnCancelEditTraining.addEventListener('click', closeEditTrainingModal);

            if (editTrainingForm) {
                editTrainingForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    if (!currentEditingSemester) return;

                    const input = document.getElementById('input-training-score');
                    const valStr = input ? input.value.trim() : "";
                    const val = parseFloat(valStr);

                    if (valStr === "" || isNaN(val) || val < 0 || val > 100) {
                        showToast("Điểm rèn luyện phải từ 0 đến 100.", "error");
                        return;
                    }

                    let targetYear = null;
                    for (const y of universityResultsData.academicYears) {
                        if (y.semesters.includes(currentEditingSemester)) {
                            targetYear = y.year;
                            break;
                        }
                    }
                    if (!targetYear) {
                        showToast("Không xác định được học kỳ cần lưu.", "error");
                        return;
                    }
                    const targetSemesterCode = currentEditingSemester.semester;

                    const draftData = (typeof structuredClone === 'function') ? structuredClone(universityResultsData) : JSON.parse(JSON.stringify(universityResultsData));
                    const draftYear = draftData.academicYears.find(y => y.year === targetYear);
                    const draftSem = draftYear ? draftYear.semesters.find(s => s.semester === targetSemesterCode) : null;
                    if (!draftSem) {
                        showToast("Không xác định được học kỳ cần lưu.", "error");
                        return;
                    }
                    if (!draftSem.summary) draftSem.summary = {};
                    draftSem.summary.trainingScore = val.toString();
                    recalculateAllResults(draftData);

                    const summaries = draftData.academicYears.flatMap(y => y.semesters.map(s => ({
                        academicYear: y.year,
                        semester: s.semester,
                        semesterCredits: s.summary.semesterCredits,
                        average10: s.summary.average10,
                        semesterGPA: s.summary.semesterGPA,
                        trainingScore: s.summary.trainingScore,
                        cumulativeCreditsRatio: s.summary.cumulativeCreditsRatio,
                        cumulativeCPAWith10: s.summary.cumulativeCPAWith10,
                        academicRank: s.summary.academicRank,
                        conductRank: s.summary.conductRank,
                        studentRank: s.summary.studentRank
                    })));

                    const submitBtn = editTrainingForm.querySelector('button[type="submit"]');
                    const originalBtnText = submitBtn ? submitBtn.textContent : '';
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Đang lưu...';
                    }

                    try {
                        const response = await callUniversityResultsAppsScript('saveUniversityTrainingScore', {
                            studentId: getUniversityStudentId(),
                            academicYear: targetYear,
                            semester: targetSemesterCode,
                            trainingScore: val,
                            summaries: summaries
                        }, 'POST');

                        if (!response || !response.success) {
                            throw new Error((response && response.message) || 'Không thể lưu điểm rèn luyện. Vui lòng thử lại.');
                        }

                        universityResultsData = response.data;
                        recalculateAllResults(universityResultsData);
                        renderUniversityResults(universityResultsData);
                        closeEditTrainingModal();
                        showToast("Đã lưu điểm rèn luyện thành công.", "success");
                    } catch (error) {
                        console.error('Lỗi lưu điểm rèn luyện Đại học:', error);
                        showToast(error.message || 'Không thể lưu điểm rèn luyện. Vui lòng thử lại.', 'error');
                    } finally {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = originalBtnText;
                        }
                    }
                });
            }

            

            /* ==========================================
               5e. CHỨC NĂNG CHỈNH SỬA THÔNG TIN & ĐỔI MẬT KHẨU
               ========================================== */
            const editProfileOverlay = document.getElementById('edit-profile-modal-overlay');
            const changePasswordOverlay = document.getElementById('change-password-modal-overlay');

            const btnOpenEditProfile = document.getElementById('btn-open-edit-profile');
            const btnCloseEditProfile = document.getElementById('btn-close-edit-profile');
            const btnCancelEditProfile = document.getElementById('btn-cancel-edit-profile');

            const btnOpenChangePassword = document.getElementById('btn-open-change-password');
            const btnCloseChangePassword = document.getElementById('btn-close-change-password');
            const btnCancelChangePassword = document.getElementById('btn-cancel-change-password');

            const editProfileForm = document.getElementById('edit-profile-form');
            const changePasswordForm = document.getElementById('change-password-form');

            function openEditProfileModal() {
                if (!user) return;
                document.getElementById('edit-hoTen').value = user.hoTen || '';
                document.getElementById('edit-ngaySinh').value = user.ngaySinh || '';
                document.getElementById('edit-noiSinh').value = user.noiSinh || '';
                document.getElementById('edit-gioiTinh').value = user.gioiTinh || '';
                document.getElementById('edit-email').value = user.email || '';
                document.getElementById('edit-soDienThoai').value = user.soDienThoai || '';
                document.getElementById('edit-soGD').value = user.soGD || '';
                document.getElementById('edit-truong').value = user.truong || '';
                document.getElementById('edit-khoi').value = user.khoi || '';
                document.getElementById('edit-lop').value = user.lop || '';
                document.getElementById('edit-nganhDaoTao').value = user.nganhDaoTao || '';
                document.getElementById('edit-khoa').value = user.khoa || '';

                if (editProfileOverlay) editProfileOverlay.classList.add('active');
            }

            function closeEditProfileModal() {
                if (editProfileOverlay) editProfileOverlay.classList.remove('active');
            }

            function openChangePasswordModal() {
                if (changePasswordForm) changePasswordForm.reset();
                if (changePasswordOverlay) changePasswordOverlay.classList.add('active');
            }

            function closeChangePasswordModal() {
                if (changePasswordOverlay) changePasswordOverlay.classList.remove('active');
            }

            if (btnOpenEditProfile) btnOpenEditProfile.addEventListener('click', openEditProfileModal);
            if (btnCloseEditProfile) btnCloseEditProfile.addEventListener('click', closeEditProfileModal);
            if (btnCancelEditProfile) btnCancelEditProfile.addEventListener('click', closeEditProfileModal);

            if (btnOpenChangePassword) btnOpenChangePassword.addEventListener('click', openChangePasswordModal);
            if (btnCloseChangePassword) btnCloseChangePassword.addEventListener('click', closeChangePasswordModal);
            if (btnCancelChangePassword) btnCancelChangePassword.addEventListener('click', closeChangePasswordModal);

            // Xử lý gửi Form Chỉnh sửa thông tin
            if (editProfileForm) {
                editProfileForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    const hoTen = document.getElementById('edit-hoTen').value.trim();
                    const email = document.getElementById('edit-email').value.trim();

                    if (!hoTen || !email) {
                        showToast('Vui lòng điền các trường bắt buộc (Họ tên, Email).', 'error');
                        return;
                    }

                    const updatedFields = {
                        hoTen: hoTen,
                        ngaySinh: document.getElementById('edit-ngaySinh').value.trim(),
                        noiSinh: document.getElementById('edit-noiSinh').value.trim(),
                        gioiTinh: document.getElementById('edit-gioiTinh').value.trim(),
                        email: email,
                        soDienThoai: document.getElementById('edit-soDienThoai').value.trim(),
                        soGD: document.getElementById('edit-soGD').value.trim(),
                        truong: document.getElementById('edit-truong').value.trim(),
                        khoi: document.getElementById('edit-khoi').value.trim(),
                        lop: document.getElementById('edit-lop').value.trim(),
                        nganhDaoTao: document.getElementById('edit-nganhDaoTao').value.trim(),
                        khoa: document.getElementById('edit-khoa').value.trim()
                    };

                    const btnSubmit = document.getElementById('btn-submit-edit-profile');
                    const originalBtnText = btnSubmit ? btnSubmit.textContent : '';
                    if (btnSubmit) {
                        btnSubmit.disabled = true;
                        btnSubmit.textContent = 'Đang lưu...';
                    }

                    callAppsScript(Object.assign({
                        action: 'updateProfile',
                        id: user.id,
                        username: user.username
                    }, updatedFields))
                    .then(response => {
                        if (response && response.success) {
                            showToast(response.message || 'Cập nhật thông tin thành công.', 'success');
                            // Cập nhật lại đối tượng user local
                            Object.assign(user, updatedFields);
                            sessionStorage.setItem('loggedInUser', JSON.stringify(user));

                            // Cập nhật UI
                            setText('sidebarUserName', user.hoTen);
                            setText('hero-hoTen', user.hoTen);
                            profileCards.forEach(card => {
                                const key = card.getAttribute('data-key');
                                const val = user[key];
                                const valueEl = card.querySelector('.profile-value');
                                const isValid = val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-';
                                if (isValid) {
                                    if (valueEl) valueEl.textContent = val;
                                    card.style.display = 'flex';
                                } else {
                                    card.style.display = 'none';
                                }
                            });
                            closeEditProfileModal();
                        } else {
                            showToast((response && response.message) || 'Không thể cập nhật thông tin.', 'error');
                        }
                    })
                    .catch(err => {
                        showToast('Lỗi khi gửi dữ liệu cập nhật: ' + err.message, 'error');
                    })
                    .finally(() => {
                        if (btnSubmit) {
                            btnSubmit.disabled = false;
                            btnSubmit.textContent = originalBtnText;
                        }
                    });
                });
            }

            // Xử lý gửi Form Đổi mật khẩu
            if (changePasswordForm) {
                changePasswordForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    const currentPassword = document.getElementById('pwd-current').value;
                    const newPassword = document.getElementById('pwd-new').value;
                    const confirmPassword = document.getElementById('pwd-confirm').value;

                    if (!currentPassword || !newPassword || !confirmPassword) {
                        showToast('Vui lòng điền đầy đủ thông tin mật khẩu.', 'error');
                        return;
                    }
                    if (newPassword !== confirmPassword) {
                        showToast('Mật khẩu mới và xác nhận mật khẩu không khớp.', 'error');
                        return;
                    }
                    if (newPassword.length < 6) {
                        showToast('Mật khẩu mới phải có độ dài ít nhất 6 ký tự.', 'error');
                        return;
                    }

                    const btnSubmit = document.getElementById('btn-submit-change-password');
                    const originalBtnText = btnSubmit ? btnSubmit.textContent : '';
                    if (btnSubmit) {
                        btnSubmit.disabled = true;
                        btnSubmit.textContent = 'Đang đổi...';
                    }

                    callAppsScript({
                        action: 'changePassword',
                        id: user.id,
                        username: user.username,
                        currentPassword: currentPassword,
                        newPassword: newPassword
                    })
                    .then(response => {
                        if (response && response.success) {
                            showToast(response.message || 'Đổi mật khẩu thành công.', 'success');
                            closeChangePasswordModal();
                        } else {
                            showToast((response && response.message) || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.', 'error');
                        }
                    })
                    .catch(err => {
                        showToast('Lỗi kết nối khi đổi mật khẩu: ' + err.message, 'error');
                    })
                    .finally(() => {
                        if (btnSubmit) {
                            btnSubmit.disabled = false;
                            btnSubmit.textContent = originalBtnText;
                        }
                    });
                });
            }

            /* ==========================================
               6. CHỨC NĂNG XỬ LÝ MODAL NỘP HỌC PHÍ
               ========================================== */
            const tuitionModal = document.getElementById('tuition-modal-overlay');

            window.openTuitionModal = function(period, original, discount, final) {
                document.getElementById('modal-tuition-period').innerText = period;
                document.getElementById('modal-tuition-original').innerText = original;
                document.getElementById('modal-tuition-discount').innerText = discount;
                document.getElementById('modal-tuition-final').innerText = final;

                if (tuitionModal) {
                    tuitionModal.classList.add('active');
                }
            };

            window.closeTuitionModal = function() {
                if (tuitionModal) {
                    tuitionModal.classList.remove('active');
                }
            };

            window.submitTuitionPayment = function() {
                closeTuitionModal();
                window.location.href = 'hocphi.html';
            };

            // Đóng Modal khi click ngoài vùng nội dung modal
            if (tuitionModal) {
                tuitionModal.addEventListener('click', (e) => {
                    if (e.target === tuitionModal) {
                        closeTuitionModal();
                    }
                });
            }

            // Đóng Modal khi nhấn phím Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && tuitionModal && tuitionModal.classList.contains('active')) {
                    closeTuitionModal();
                }
            });

            /* ==========================================
               6b. XỬ LÝ NÚT LIÊN HỆ ZALO (0355748108)
               ========================================== */
            const btnContact = document.getElementById('btn-contact');
            if (btnContact) {
                btnContact.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.open('https://zalo.me/0355748108', '_blank', 'noopener,noreferrer');
                });
            }

            /* ==========================================
               6c. XỬ LÝ CHỌN NGÔN NGỮ & ĐỔI NỘI DUNG (i18n)
               ========================================== */
            const btnLangToggle = document.getElementById('btn-lang-toggle');
            const currentFlagIcon = document.getElementById('current-flag-icon');
            const langDropdownMenu = document.getElementById('lang-dropdown-menu');
            const langOptions = document.querySelectorAll('.lang-option');

            const vietnamFlagSvg = `<rect width="300" height="200" fill="#da251d"/><polygon points="150,55 162,92 201,92 169,115 181,152 150,130 119,152 131,115 99,92 138,92" fill="#ffee00"/>`;
            const ukFlagSvg = `<rect width="600" height="400" fill="#012169"/><path d="M0,0 L600,400 M600,0 L0,400" stroke="#fff" stroke-width="60"/><path d="M0,0 L600,400 M600,0 L0,400" stroke="#C8102E" stroke-width="40"/><path d="M300,0 V400 M0,200 H600" stroke="#fff" stroke-width="100"/><path d="M300,0 V400 M0,200 H600" stroke="#C8102E" stroke-width="60"/>`;

            // Từ điển dịch i18n toàn diện cho giao diện tĩnh
            const translations = {
                vi: {
                    selectLangTitle: "Chọn ngôn ngữ",
                    notificationTitle: "Thông báo",
                    themeToggleTitle: "Chuyển giao diện Sáng/Tối",
                    contactTitle: "Liên hệ",

                    personalGroup: "Trang cá nhân",
                    profile: "Thông tin cá nhân",
                    notifications: "Thông báo",
                    onlineFeaturesGroup: "Chức năng trực tuyến",
                    studyResults: "Kết quả học tập",
                    courses: "Khóa học",
                    schedule: "Lịch học",
                    tuition: "Học phí",
                    logout: "Đăng xuất",

                    coursesTitle: "KHÓA HỌC",
                    coursesBreadcrumb: "Trang chủ / Chức năng trực tuyến / Khóa học",
                    courseSearchPlaceholder: "Tìm kiếm khóa học theo tên hoặc giảng viên...",
                    teacherLabel: "GV:",
                    durationLabel: "Thời lượng:",
                    unregisteredBadge: "Chưa đăng ký",
                    enrolledBadge: "Đã tham gia",
                    requestedBadge: "Đang yêu cầu",
                    endedBadge: "Kết thúc",
                    registerBtn: "Đăng ký",
                    enterCourseBtn: "Vào học →",
                    requestedBtn: "Đã gửi yêu cầu",
                    endedBtn: "Kết thúc",
                    retryBtn: "Thử lại",
                    loadingCourses: "Đang tải danh sách khóa học...",
                    noCoursesFound: "Không tìm thấy khóa học nào phù hợp.",

                    profileTitle: "THÔNG TIN CÁ NHÂN",
                    profileBreadcrumb: "Trang chủ / Trang cá nhân / Thông tin cá nhân",
                    studentRole: "Thí sinh / Học sinh",
                    studentId: "Mã định danh (ID)",
                    fullName: "Họ và tên",
                    dob: "Ngày sinh",
                    pob: "Nơi sinh",
                    gender: "Giới tính",
                    username: "Tài khoản",
                    email: "Email",
                    phone: "Số điện thoại",
                    educationDept: "Sở GD&ĐT",
                    school: "Trường",
                    grade: "Khối",
                    className: "Lớp",
                    major: "Ngành đào tạo",
                    faculty: "Khoa",
                    editProfile: "Chỉnh sửa thông tin",
                    changePassword: "Đổi mật khẩu",
                    cancel: "Hủy",
                    saveChanges: "Lưu thay đổi",
                    currentPassword: "Mật khẩu hiện tại *",
                    newPassword: "Mật khẩu mới *",
                    confirmNewPassword: "Nhập lại mật khẩu mới *",
                    changePasswordBtn: "Đổi mật khẩu",
                    editProfileModalTitle: "Chỉnh sửa thông tin cá nhân",
                    changePasswordModalTitle: "Đổi mật khẩu",

                    studyResultsTitle: "KẾT QUẢ HỌC TẬP",
                    studyResultsBreadcrumb: "Trang chủ / Chức năng trực tuyến / Kết quả học tập",
                    filterByCourse: "Lọc theo khóa học:",
                    allCourses: "Tất cả khóa học",
                    stt: "STT",
                    courseCol: "Khóa học",
                    evalContent: "Nội dung đánh giá",
                    evalScore: "Điểm đánh giá",
                    noteCol: "Ghi chú",
                    noLearningResults: "Chưa có dữ liệu kết quả học tập.",
                    loadingLearningResults: "Đang tải kết quả học tập...",

                    scheduleTitle: "LỊCH HỌC",
                    scheduleBreadcrumb: "Trang chủ / Chức năng trực tuyến / Lịch học",
                    timetable: "Thời khóa biểu học tập",
                    timetableDesc: "Danh sách các buổi học chi tiết theo lịch giảng dạy",
                    date: "Ngày học",
                    startTime: "Thời gian bắt đầu học",
                    duration: "Thời lượng học",
                    course: "Khóa học",
                    lessonContent: "Nội dung buổi học",
                    attendance: "Chuyên cần",
                    actions: "Thao tác",
                    upcomingStatus: "Chưa diễn ra",
                    attendedStatus: "Đã học",
                    absentStatus: "Chưa học",
                    joinClass: "Vào học",

                    tuitionTitle: "HỌC PHÍ",
                    tuitionBreadcrumb: "Trang chủ / Chức năng trực tuyến / Học phí",
                    tuitionList: "Danh sách học phí",
                    tuitionListDesc: "Các khoản học phí đang chờ thanh toán",
                    startDate: "Ngày bắt đầu tính học phí",
                    endDate: "Ngày kết thúc tính học phí",
                    originalTuition: "Học phí gốc",
                    discount: "Miễn giảm",
                    finalAmount: "Học phí cần thanh toán",
                    payTuition: "Nộp học phí",
                    paidStatus: "Đã nộp",
                    confirmTuitionTitle: "Xác nhận nộp học phí",
                    tuitionPeriodLabel: "Khoản học phí:",
                    originalTuitionLabel: "Học phí gốc:",
                    discountLabel: "Miễn giảm:",
                    finalAmountLabel: "Số tiền cần thanh toán:",
                    proceedPayment: "Tiếp tục thanh toán",

                    notificationsTitle: "THÔNG BÁO",
                    notificationsBreadcrumb: "Trang chủ / Trang cá nhân / Thông báo",
                    notifTitle: "Tiêu đề",
                    notifDate: "Ngày đăng",
                    backToNotifList: "Quay lại danh sách thông báo",

                    langSwitched: "Đã chuyển sang Tiếng Việt",
                    regularCourses: "Khóa học chính quy",
                    extracurricularCourses: "Khóa học ngoại khóa",
                    extracurricularCoursesTitle: "KHÓA HỌC NGOẠI KHÓA",
                    extracurricularContent: "Nội dung ngoại khóa",
                    studyDate: "Ngày học",
                    studyTime: "Giờ học",
                    studentCount: "Số học viên",
                    participate: "Tham gia"
                },
                en: {
                        selectLangTitle: "Select Language",
                        notificationTitle: "Notifications",
                        universityResults: "University Academic Results",
                        personalResults: "Personal Academic Results",
                        universityResultsLoading: "Loading university academic results...",
                        universityResultsError: "Failed to load university academic results.",
                    themeToggleTitle: "Toggle Light/Dark Theme",
                    contactTitle: "Contact Support",

                    personalGroup: "Personal Profile",
                    profile: "Personal Information",
                    notifications: "Notifications",
                    onlineFeaturesGroup: "Online Features",
                    studyResults: "Learning Results",
                    courses: "Courses",
                    schedule: "Schedule",
                    tuition: "Tuition",
                    logout: "Logout",

                    coursesTitle: "COURSES",
                    coursesBreadcrumb: "Home / Online Features / Courses",
                    courseSearchPlaceholder: "Search courses by title or instructor...",
                    teacherLabel: "Lecturer:",
                    durationLabel: "Duration:",
                    unregisteredBadge: "Not Registered",
                    enrolledBadge: "Enrolled",
                    requestedBadge: "Requested",
                    endedBadge: "Ended",
                    registerBtn: "Register",
                    enterCourseBtn: "Enter →",
                    requestedBtn: "Requested",
                    endedBtn: "Ended",
                    retryBtn: "Retry",
                    loadingCourses: "Loading courses...",
                    noCoursesFound: "No courses matching your search.",

                    profileTitle: "PERSONAL INFORMATION",
                    profileBreadcrumb: "Home / Personal Profile / Personal Information",
                    studentRole: "Candidate / Student",
                    studentId: "Student ID",
                    fullName: "Full Name",
                    dob: "Date of Birth",
                    pob: "Place of Birth",
                    gender: "Gender",
                    username: "Username",
                    email: "Email",
                    phone: "Phone Number",
                    educationDept: "Education Dept.",
                    school: "School",
                    grade: "Grade",
                    className: "Class",
                    major: "Major",
                    faculty: "Faculty",
                    editProfile: "Edit Information",
                    changePassword: "Change Password",
                    cancel: "Cancel",
                    saveChanges: "Save Changes",
                    currentPassword: "Current Password *",
                    newPassword: "New Password *",
                    confirmNewPassword: "Confirm New Password *",
                    changePasswordBtn: "Change Password",
                    editProfileModalTitle: "Edit Personal Information",
                    changePasswordModalTitle: "Change Password",

                    studyResultsTitle: "LEARNING RESULTS",
                    studyResultsBreadcrumb: "Home / Online Features / Learning Results",
                    filterByCourse: "Filter by course:",
                    allCourses: "All courses",
                    stt: "No.",
                    courseCol: "Course",
                    evalContent: "Assessment Content",
                    evalScore: "Score",
                    noteCol: "Note",
                    noLearningResults: "No learning results available.",
                    loadingLearningResults: "Loading learning results...",

                    scheduleTitle: "SCHEDULE",
                    scheduleBreadcrumb: "Home / Online Features / Schedule",
                    timetable: "Class Timetable",
                    timetableDesc: "Detailed list of scheduled classes",
                    date: "Date",
                    startTime: "Start Time",
                    duration: "Duration",
                    course: "Course",
                    lessonContent: "Lesson Content",
                    attendance: "Attendance",
                    actions: "Action",
                    upcomingStatus: "Upcoming",
                    attendedStatus: "Attended",
                    absentStatus: "Absent",
                    joinClass: "Join Class",

                    tuitionTitle: "TUITION",
                    tuitionBreadcrumb: "Home / Online Features / Tuition",
                    tuitionList: "Tuition Fees",
                    tuitionListDesc: "List of pending tuition payments",
                    startDate: "Start Date",
                    endDate: "End Date",
                    originalTuition: "Original Fee",
                    discount: "Discount",
                    finalAmount: "Amount Due",
                    payTuition: "Pay Fee",
                    paidStatus: "Paid",
                    confirmTuitionTitle: "Confirm Tuition Payment",
                    tuitionPeriodLabel: "Tuition Item:",
                    originalTuitionLabel: "Original Fee:",
                    discountLabel: "Discount:",
                    finalAmountLabel: "Amount Due:",
                    proceedPayment: "Proceed to Payment",

                    notificationsTitle: "NOTIFICATIONS",
                    notificationsBreadcrumb: "Home / Personal Profile / Notifications",
                    notifTitle: "Title",
                    notifDate: "Date Posted",
                    backToNotifList: "Back to Notifications",

                    langSwitched: "Switched to English",
                    regularCourses: "Regular Courses",
                    extracurricularCourses: "Extracurricular Courses",
                    extracurricularCoursesTitle: "EXTRACURRICULAR COURSES",
                    extracurricularContent: "Extracurricular Content",
                    studyDate: "Study Date",
                    studyTime: "Study Time",
                    studentCount: "Student Count",
                    participate: "Participate"
                }
            };

            function changePageLanguage(lang) {
                const targetLang = translations[lang] ? lang : 'vi';
                const dict = translations[targetLang];

                // 1. Đổi icon cờ trên status bar
                if (currentFlagIcon) {
                    if (targetLang === 'en') {
                        currentFlagIcon.setAttribute('viewBox', '0 0 600 400');
                        currentFlagIcon.innerHTML = ukFlagSvg;
                    } else {
                        currentFlagIcon.setAttribute('viewBox', '0 0 300 200');
                        currentFlagIcon.innerHTML = vietnamFlagSvg;
                    }
                }

                // 2. Dịch các phần tử có data-i18n
                document.querySelectorAll('[data-i18n]').forEach(el => {
                    const key = el.getAttribute('data-i18n');
                    if (dict[key]) {
                        el.textContent = dict[key];
                    }
                });

                // 3. Dịch data-i18n-placeholder
                document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                    const key = el.getAttribute('data-i18n-placeholder');
                    if (dict[key]) {
                        el.placeholder = dict[key];
                    }
                });

                // 4. Dịch data-i18n-title
                document.querySelectorAll('[data-i18n-title]').forEach(el => {
                    const key = el.getAttribute('data-i18n-title');
                    if (dict[key]) {
                        el.title = dict[key];
                    }
                });

                // 5. Dịch data-i18n-aria-label
                document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
                    const key = el.getAttribute('data-i18n-aria-label');
                    if (dict[key]) {
                        el.setAttribute('aria-label', dict[key]);
                    }
                });

                // 6. Cập nhật lại các bảng động nếu đang mở
                const searchInput = document.getElementById('course-search-input');
                renderCourses(searchInput ? searchInput.value : '');

                if (learningResultsLoaded) {
                    populateLearningCourseFilter(learningResultsData);
                    renderLearningResultsTable(learningResultsData);
                }
                if (scheduleLoaded) {
                    renderScheduleTable(scheduleData);
                }
                if (tuitionLoaded) {
                    renderTuitionTable(tuitionData);
                }
            }

            // Khởi tạo ngôn ngữ từ localStorage khi tải trang (mặc định 'vi')
            const savedLang = localStorage.getItem('qn-study-language') || 'vi';
            changePageLanguage(savedLang);

            if (btnLangToggle && langDropdownMenu) {
                btnLangToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = langDropdownMenu.style.display === 'block';
                    langDropdownMenu.style.display = isVisible ? 'none' : 'block';
                });

                // Click ra bên ngoài thì tự động đóng menu ngôn ngữ
                document.addEventListener('click', (e) => {
                    if (!btnLangToggle.contains(e.target) && !langDropdownMenu.contains(e.target)) {
                        langDropdownMenu.style.display = 'none';
                    }
                });
            }

            langOptions.forEach(option => {
                option.addEventListener('click', () => {
                    const selectedLang = option.getAttribute('data-lang');
                    localStorage.setItem('qn-study-language', selectedLang);
                    changePageLanguage(selectedLang);
                    if (langDropdownMenu) {
                        langDropdownMenu.style.display = 'none';
                    }
                    const msg = translations[selectedLang] ? translations[selectedLang].langSwitched : 'Đã chuyển sang Tiếng Việt';
                    showToast(msg, 'success');
                });
            });

            /* ==========================================
               7. XỬ LÝ RESPONSIVE MOBILE SIDEBAR TOGGLE
               ========================================== */
            const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
            const mobileOverlay = document.getElementById('mobile-sidebar-overlay');
            const sidebarEl = document.getElementById('sidebar');
            const iconBars = document.getElementById('toggle-icon-bars');
            const iconClose = document.getElementById('toggle-icon-close');

            function toggleMobileSidebar(open) {
                const isOpen = open !== undefined ? open : !sidebarEl.classList.contains('mobile-open');
                if (isOpen) {
                    sidebarEl.classList.add('mobile-open');
                    mobileOverlay.classList.add('active');
                    document.documentElement.classList.add('mobile-sidebar-open');
                    document.body.classList.add('mobile-sidebar-open');
                    if (iconBars) iconBars.style.display = 'none';
                    if (iconClose) iconClose.style.display = 'block';
                } else {
                    sidebarEl.classList.remove('mobile-open');
                    mobileOverlay.classList.remove('active');
                    document.documentElement.classList.remove('mobile-sidebar-open');
                    document.body.classList.remove('mobile-sidebar-open');
                    if (iconBars) iconBars.style.display = 'block';
                    if (iconClose) iconClose.style.display = 'none';
                }
            }

            if (mobileToggleBtn) {
                mobileToggleBtn.addEventListener('click', () => toggleMobileSidebar());
            }

            if (mobileOverlay) {
                mobileOverlay.addEventListener('click', () => toggleMobileSidebar(false));
            }

            // Tự động đóng sidebar mobile khi bấm chuyển mục navigation
            menuItems.forEach(item => {
                item.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        toggleMobileSidebar(false);
                    }
                });
            });
            // Ngăn chặn touchmove truyền từ overlay / background khi mobile sidebar đang mở
            document.addEventListener('touchmove', (e) => {
                if (sidebarEl && sidebarEl.classList.contains('mobile-open')) {
                    if (!sidebarEl.contains(e.target)) {
                        e.preventDefault();
                    }
                }
            }, { passive: false });

            /* ==========================================
               8. CHỨC NĂNG NHẬT KÝ HỌC TẬP (STUDY LOG)
               ========================================== */
            // CONFIG - GOOGLE APPS SCRIPT RIÊNG CHO NHẬT KÝ HỌC TẬP
            // (TÁCH BIỆT HOÀN TOÀN VỚI APPS_SCRIPT_URL / callAppsScript() Ở TRÊN,
            //  theo đúng quy ước đã áp dụng cho UNIVERSITY_RESULTS_APPS_SCRIPT_URL)
            const STUDY_LOG_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzslNATuFr2PRof2Vf_nrVleJvQe2aNgFtBVO5sb5OA-UohNLHeZcuD2X-QoRcjoJk6/exec';

            let studyLogLoaded = false;
            let studyLogTasks = [];
            let studyLogBookmarks = {};
            let studyLogEditingId = null;
            let studyLogSubmitting = false;

            function callStudyLogAppsScript(action, params, method) {
                method = method || 'GET';
                if (method === 'GET') {
                    const url = new URL(STUDY_LOG_APPS_SCRIPT_URL);
                    url.searchParams.append('action', action);
                    Object.keys(params || {}).forEach(key => {
                        if (params[key] !== undefined && params[key] !== null) {
                            url.searchParams.append(key, params[key]);
                        }
                    });
                    return fetch(url.toString()).then(res => {
                        if (!res.ok) throw new Error('Lỗi mạng: ' + res.status);
                        return res.json();
                    });
                }

                const payload = Object.assign({ action: action }, params || {});
                return fetch(STUDY_LOG_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                }).then(res => {
                    if (!res.ok) throw new Error('Lỗi mạng: ' + res.status);
                    return res.json();
                });
            }

            function loadStudyLogBookmarks() {
                try {
                    const raw = localStorage.getItem('study-log-bookmarks');
                    studyLogBookmarks = raw ? JSON.parse(raw) : {};
                } catch (err) {
                    studyLogBookmarks = {};
                }
            }

            function saveStudyLogBookmarks() {
                try {
                    localStorage.setItem('study-log-bookmarks', JSON.stringify(studyLogBookmarks));
                } catch (err) {
                    console.error('Không thể lưu bookmark Nhật ký học tập:', err);
                }
            }

            function toggleStudyLogBookmark(taskId) {
                if (studyLogBookmarks[taskId]) {
                    delete studyLogBookmarks[taskId];
                } else {
                    studyLogBookmarks[taskId] = true;
                }
                saveStudyLogBookmarks();
            }

            function generateStudyTaskId() {
                if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                    return crypto.randomUUID();
                }
                return 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
            }

            
            function getStudyLogUserId() {
                return (user && (user.id || user.studentId)) ? String(user.id || user.studentId).trim() : '';
            }

            // Khóa nội bộ (chỉ dùng ở frontend/backend, KHÔNG lưu thêm cột trong Sheet) để
            // nhận diện DUY NHẤT một nhiệm vụ. Vì cột "ID" giờ là ID tài khoản sở hữu (dùng để
            // phân quyền) nên nhiều nhiệm vụ có thể trùng "ID". Ghép "ID" (chủ sở hữu) với
            // "ThoiGianKhoiTao" (thời điểm tạo, không đổi khi chỉnh sửa) tạo ra khóa đủ để phân
            // biệt các nhiệm vụ với nhau.
            function getStudyTaskKey(task) {
                if (!task) return '';
                return String(task.ID || '') + '__' + String(task.ThoiGianKhoiTao || '');
            }

            function studyLogPad2(n) {
                return String(n).padStart(2, '0');
            }

            // Hàm chuyển đổi thời gian UTC sang múi giờ Việt Nam (Asia/Ho_Chi_Minh) và format dd/mm HH:mm
            function formatVietnamDateTime(value) {
                if (!value) return '';
                let d;
                if (value instanceof Date) {
                    d = value;
                } else if (typeof value === 'number') {
                    d = new Date(value);
                } else if (typeof value === 'string') {
                    let str = value.trim();
                    if (!str || str === '-') return '';
                    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(str)) {
                        d = new Date(str);
                    } else if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(str)) {
                        d = new Date(str.replace(' ', 'T') + (str.endsWith('Z') ? '' : 'Z'));
                    } else {
                        d = new Date(str);
                    }
                }
                if (!d || isNaN(d.getTime())) return String(value);

                // Ép sang múi giờ Asia/Ho_Chi_Minh (UTC+7)
                const options = {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                };
                try {
                    const formatter = new Intl.DateTimeFormat('en-GB', options);
                    const parts = formatter.formatToParts(d);
                    let day = '', month = '', hour = '', minute = '';
                    parts.forEach(p => {
                        if (p.type === 'day') day = p.value;
                        if (p.type === 'month') month = p.value;
                        if (p.type === 'hour') hour = p.value;
                        if (p.type === 'minute') minute = p.value;
                    });
                    if (day && month && hour && minute) {
                        return `${day}/${month} ${hour}:${minute}`;
                    }
                } catch (e) {
                    // Fallback an toàn nếu môi trường không hỗ trợ Intl timeZone
                }

                const day = studyLogPad2(d.getUTCDate());
                const month = studyLogPad2(d.getUTCMonth() + 1);
                const hour = studyLogPad2((d.getUTCHours() + 7) % 24);
                const minute = studyLogPad2(d.getUTCMinutes());
                return `${day}/${month} ${hour}:${minute}`;
            }

            function formatStudyLogCreatedDisplay(value) {
                return formatVietnamDateTime(value);
            }

            // Hàm xử lý thời gian hết hạn an toàn, tránh hoàn toàn lỗi 1899-12-30 và time serial của Google Sheets
            function parseGoogleSheetsTimeSerial(serialVal) {
                const num = Number(serialVal);
                if (isNaN(num)) return { hour: 0, minute: 0 };
                let fractional = num - Math.floor(num);
                if (fractional < 0) fractional = 0;
                const totalMinutes = Math.round(fractional * 24 * 60);
                const hour = Math.floor(totalMinutes / 60) % 24;
                const minute = totalMinutes % 60;
                return { hour: hour, minute: minute };
            }

            function getStudyTaskDueTimestamp(task) {
                if (!task.NgayHetHan) return NaN;
                let year = 2026, month = 0, day = 1;
                const dateStr = String(task.NgayHetHan).trim();
                
                if (dateStr.includes('-')) {
                    const parts = dateStr.split('-');
                    if (parts.length === 3) {
                        if (parts[0].length === 4) {
                            year = parseInt(parts[0], 10);
                            month = parseInt(parts[1], 10) - 1;
                            day = parseInt(parts[2], 10);
                        } else {
                            day = parseInt(parts[0], 10);
                            month = parseInt(parts[1], 10) - 1;
                            year = parseInt(parts[2], 10);
                        }
                    }
                } else if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        day = parseInt(parts[0], 10);
                        month = parseInt(parts[1], 10) - 1;
                        year = parseInt(parts[2], 10);
                    }
                }

                let hour = 0, minute = 0;
                const gioVal = task.GioHetHan;
                if (gioVal !== undefined && gioVal !== null && String(gioVal).trim() !== '') {
                    if (typeof gioVal === 'number' || (!isNaN(gioVal) && !String(gioVal).includes(':') && !String(gioVal).includes('h'))) {
                        const timeObj = parseGoogleSheetsTimeSerial(gioVal);
                        hour = timeObj.hour;
                        minute = timeObj.minute;
                    } else {
                        const cleanTime = String(gioVal).trim().toLowerCase().replace('h', ':');
                        const timeParts = cleanTime.split(':');
                        if (timeParts.length >= 1) hour = parseInt(timeParts[0], 10) || 0;
                        if (timeParts.length >= 2) minute = parseInt(timeParts[1], 10) || 0;
                    }
                }

                const dt = new Date(year, month, day, hour, minute, 0);
                return dt.getTime();
            }

            function formatStudyTaskDueDisplay(task) {
                if (!task.NgayHetHan) return '';
                let day = '', month = '', year = '';
                const dateStr = String(task.NgayHetHan).trim();

                if (dateStr.includes('-')) {
                    const parts = dateStr.split('-');
                    if (parts.length === 3) {
                        if (parts[0].length === 4) {
                            year = parts[0];
                            month = parts[1];
                            day = parts[2];
                        } else {
                            day = parts[0];
                            month = parts[1];
                            year = parts[2];
                        }
                    }
                } else if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        day = parts[0];
                        month = parts[1];
                        year = parts[2];
                    }
                }

                if (!day || !month) return String(task.NgayHetHan);

                let hour = 0, minute = 0;
                const gioVal = task.GioHetHan;
                if (gioVal !== undefined && gioVal !== null && String(gioVal).trim() !== '') {
                    if (typeof gioVal === 'number' || (!isNaN(gioVal) && !String(gioVal).includes(':') && !String(gioVal).includes('h'))) {
                        const timeObj = parseGoogleSheetsTimeSerial(gioVal);
                        hour = timeObj.hour;
                        minute = timeObj.minute;
                    } else {
                        const cleanTime = String(gioVal).trim().toLowerCase().replace('h', ':');
                        const timeParts = cleanTime.split(':');
                        if (timeParts.length >= 1) hour = parseInt(timeParts[0], 10) || 0;
                        if (timeParts.length >= 2) minute = parseInt(timeParts[1], 10) || 0;
                    }
                }

                const timeDisplay = studyLogPad2(hour) + ':' + studyLogPad2(minute);
                return `${day}/${month} ${timeDisplay}`;
            }

            function getStudyTaskEffectiveStatus(task) {
                if (task.TrangThai === 'Đã hoàn thành') return 'Đã hoàn thành';
                const dueTs = getStudyTaskDueTimestamp(task);
                if (!isNaN(dueTs) && Date.now() > dueTs) return 'Quá hạn';
                return task.TrangThai || 'Chưa bắt đầu';
            }

            function getStudyTaskStatusClass(status) {
                switch (status) {
                    case 'Đã hoàn thành': return 'study-log-status-done';
                    case 'Đang thực hiện': return 'study-log-status-progress';
                    case 'Quá hạn': return 'study-log-status-overdue';
                    default: return 'study-log-status-pending';
                }
            }

            function getStudyTaskPriorityClass(priority) {
                switch (priority) {
                    case 'Khẩn cấp': return 'study-log-priority-urgent';
                    case 'Cao': return 'study-log-priority-high';
                    case 'Trung bình': return 'study-log-priority-medium';
                    default: return 'study-log-priority-low';
                }
            }

            // Điểm ưu tiên dùng cho sort 2 tầng: Khẩn cấp > Cao > Trung bình > Thấp
            function getStudyTaskPriorityScore(priority) {
                switch (priority) {
                    case 'Khẩn cấp': return 4;
                    case 'Cao': return 3;
                    case 'Trung bình': return 2;
                    case 'Thấp': return 1;
                    default: return 0;
                }
            }

            function renderStudyLogTable() {
                const tbody = document.getElementById('study-log-table-body');
                if (!tbody) return;

                if (!studyLogTasks.length) {
                    tbody.innerHTML = '<tr><td colspan="6" class="study-log-empty">Chưa có nhiệm vụ nào.</td></tr>';
                    return;
                }

                const sortedTasks = studyLogTasks.slice().sort((a, b) => {
                    // TẦNG 1: Độ ưu tiên (Khẩn cấp > Cao > Trung bình > Thấp)
                    const scoreA = getStudyTaskPriorityScore(a.DoUuTien);
                    const scoreB = getStudyTaskPriorityScore(b.DoUuTien);
                    if (scoreA !== scoreB) return scoreB - scoreA;

                    // TẦNG 2: Deadline gần nhất đứng trước (an toàn với deadline rỗng/sai format)
                    const dueA = getStudyTaskDueTimestamp(a);
                    const dueB = getStudyTaskDueTimestamp(b);
                    if (isNaN(dueA) && isNaN(dueB)) return 0;
                    if (isNaN(dueA)) return 1;
                    if (isNaN(dueB)) return -1;
                    return dueA - dueB;
                });

                tbody.innerHTML = sortedTasks.map(task => {
                    const effectiveStatus = getStudyTaskEffectiveStatus(task);
                    const statusClass = getStudyTaskStatusClass(effectiveStatus);
                    const taskKey = getStudyTaskKey(task);
                    const isBookmarked = !!studyLogBookmarks[taskKey];
                    const isDone = effectiveStatus === 'Đã hoàn thành';
                    return `
                        <tr data-task-id="${escapeHtml(taskKey)}" class="${isBookmarked ? 'study-log-bookmarked' : ''}">
                            <td>${escapeHtml(task.MonHoc)}</td>
                            <td>${escapeHtml(task.TieuDe)}</td>
                            <td>${escapeHtml(task.ThoiGianKhoiTao)}</td>
                            <td>${formatStudyTaskDueDisplay(task)}</td>
                            <td><span class="study-log-status ${statusClass}">${escapeHtml(effectiveStatus)}</span></td>
                            <td class="text-center">
                                <div class="study-log-actions-cell">
                                    <button type="button" class="study-log-row-btn" data-action="detail" title="Chi tiết">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                    </button>
                                    <button type="button" class="study-log-row-btn" data-action="complete" title="Hoàn thành" ${isDone ? 'disabled' : ''}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </button>
                                    <button type="button" class="study-log-row-btn" data-action="edit" title="Chỉnh sửa">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button type="button" class="study-log-row-btn ${isBookmarked ? 'study-log-row-btn-active' : ''}" data-action="bookmark" title="Đánh dấu">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            function loadStudyLogData() {
                studyLogLoaded = true;

                const currentUserId = getStudyLogUserId();
                if (!currentUserId) {
                    console.error('Không xác định được ID người dùng.');
                    studyLogTasks = [];
                    renderStudyLogTable();
                    return;
                }

                callStudyLogAppsScript('getTasks', { userId: currentUserId }, 'GET')
                    .then(response => {
                        if (response && response.success && Array.isArray(response.tasks)) {
                            // Chỉ giữ lại nhiệm vụ local (chưa đồng bộ) thuộc ĐÚNG tài khoản đang
                            // đăng nhập, tránh lẫn dữ liệu của tài khoản khác trên cùng trình duyệt.
                            const pendingLocalTasks = studyLogTasks.filter(localTask =>
                                String(localTask.ID || '').trim() === currentUserId &&
                                !response.tasks.some(cloudTask => getStudyTaskKey(cloudTask) === getStudyTaskKey(localTask))
                            );
                            studyLogTasks = response.tasks.concat(pendingLocalTasks);
                            renderStudyLogTable();
                        } else if (response && !response.success) {
                            console.error('Không thể tải dữ liệu Nhật ký học tập:', response.message);
                        }
                    })
                    .catch(err => {
                        console.error('Không thể tải dữ liệu Nhật ký học tập:', err);
                    });
            }

            function openStudyTaskModal(mode, task) {
                const overlay = document.getElementById('study-task-modal-overlay');
                const form = document.getElementById('study-task-form');
                const titleEl = document.getElementById('study-task-modal-title');
                const errorEl = document.getElementById('study-task-form-error');
                const saveBtn = document.getElementById('btn-save-study-task');
                if (!overlay || !form) return;

                form.reset();
                if (errorEl) {
                    errorEl.style.display = 'none';
                    errorEl.textContent = '';
                }
                form.querySelectorAll('.study-log-input-error').forEach(el => el.classList.remove('study-log-input-error'));

                if (mode === 'edit' && task) {
                    studyLogEditingId = getStudyTaskKey(task);
                    if (titleEl) titleEl.textContent = 'Chỉnh sửa nhiệm vụ';
                    if (saveBtn) saveBtn.textContent = 'Cập nhật nhiệm vụ';
                    document.getElementById('study-task-title').value = task.TieuDe || '';
                    document.getElementById('study-task-subject').value = task.MonHoc || '';
                    document.getElementById('study-task-due-date').value = task.NgayHetHan || '';
                    document.getElementById('study-task-due-time').value = task.GioHetHan || '';
                    document.getElementById('study-task-content').value = task.NoiDung || '';
                    document.getElementById('study-task-type').value = task.LoaiNhiemVu || '';
                    document.getElementById('study-task-priority').value = task.DoUuTien || '';
                    document.getElementById('study-task-status').value = (task.TrangThai === 'Đang thực hiện') ? 'Đang thực hiện' : 'Chưa bắt đầu';
                } else {
                    studyLogEditingId = null;
                    if (titleEl) titleEl.textContent = 'Tạo mới nhiệm vụ';
                    if (saveBtn) saveBtn.textContent = 'Lưu nhiệm vụ';
                    document.getElementById('study-task-status').value = 'Chưa bắt đầu';
                }

                overlay.classList.add('active');
            }

            function closeStudyTaskModal() {
                const overlay = document.getElementById('study-task-modal-overlay');
                if (overlay) overlay.classList.remove('active');
                studyLogEditingId = null;
            }

            function showStudyTaskFormError(message, focusEl) {
                const errorEl = document.getElementById('study-task-form-error');
                if (errorEl) {
                    errorEl.textContent = message;
                    errorEl.style.display = 'block';
                }
                if (focusEl) {
                    focusEl.classList.add('study-log-input-error');
                    focusEl.focus();
                }
            }

            function validateStudyTaskForm(data) {
                if (!data.TieuDe) {
                    return { ok: false, message: 'Vui lòng nhập tiêu đề nhiệm vụ.', field: document.getElementById('study-task-title') };
                }
                if (!data.MonHoc) {
                    return { ok: false, message: 'Vui lòng nhập môn học / học phần.', field: document.getElementById('study-task-subject') };
                }
                if (!data.GioHetHan) {
                    return { ok: false, message: 'Vui lòng chọn giờ hết hạn.', field: document.getElementById('study-task-due-time') };
                }
                if (!data.NgayHetHan) {
                    return { ok: false, message: 'Vui lòng chọn ngày hết hạn.', field: document.getElementById('study-task-due-date') };
                }
                if (!data.LoaiNhiemVu) {
                    return { ok: false, message: 'Vui lòng chọn loại nhiệm vụ.', field: document.getElementById('study-task-type') };
                }
                if (!data.DoUuTien) {
                    return { ok: false, message: 'Vui lòng chọn độ ưu tiên.', field: document.getElementById('study-task-priority') };
                }
                if (!data.TrangThai) {
                    return { ok: false, message: 'Vui lòng chọn trạng thái khởi tạo.', field: document.getElementById('study-task-status') };
                }
                return { ok: true };
            }

            function openStudyTaskDetailModal(task) {
                const overlay = document.getElementById('study-task-detail-modal-overlay');
                const body = document.getElementById('study-task-detail-body');
                if (!overlay || !body) return;

                const effectiveStatus = getStudyTaskEffectiveStatus(task);
                body.innerHTML = `
                    <div class="study-log-detail-row"><span class="study-log-detail-label">Môn học:</span><span class="study-log-detail-value">${escapeHtml(task.MonHoc)}</span></div>
                    <div class="study-log-detail-row"><span class="study-log-detail-label">Tiêu đề:</span><span class="study-log-detail-value">${escapeHtml(task.TieuDe)}</span></div>
                    <div class="study-log-detail-row"><span class="study-log-detail-label">Thời gian khởi tạo:</span><span class="study-log-detail-value">${escapeHtml(task.ThoiGianKhoiTao)}</span></div>
                    <div class="study-log-detail-row"><span class="study-log-detail-label">Thời gian hết hạn:</span><span class="study-log-detail-value">${formatStudyTaskDueDisplay(task)}</span></div>
                    <div class="study-log-detail-row"><span class="study-log-detail-label">Loại nhiệm vụ:</span><span class="study-log-detail-value">${escapeHtml(task.LoaiNhiemVu)}</span></div>
                    <div class="study-log-detail-row"><span class="study-log-detail-label">Độ ưu tiên:</span><span class="study-log-detail-value"><span class="study-log-priority ${getStudyTaskPriorityClass(task.DoUuTien)}">${escapeHtml(task.DoUuTien)}</span></span></div>
                    <div class="study-log-detail-row"><span class="study-log-detail-label">Trạng thái:</span><span class="study-log-detail-value"><span class="study-log-status ${getStudyTaskStatusClass(effectiveStatus)}">${escapeHtml(effectiveStatus)}</span></span></div>
                    <div class="study-log-detail-row study-log-detail-row-block">
                        <span class="study-log-detail-label">Nội dung:</span>
                        <div class="study-log-detail-content">${escapeHtml(task.NoiDung || '(Không có nội dung)')}</div>
                    </div>
                `;

                overlay.classList.add('active');
            }

            function closeStudyTaskDetailModal() {
                const overlay = document.getElementById('study-task-detail-modal-overlay');
                if (overlay) overlay.classList.remove('active');
            }

            function completeStudyTask(task) {
                if (task.TrangThai === 'Đã hoàn thành') return;
                task.TrangThai = 'Đã hoàn thành';
                renderStudyLogTable();

                callStudyLogAppsScript('updateTask', { task: task, userId: getStudyLogUserId() }, 'POST')
                    .then(response => {
                        if (response && response.success) {
                            showToast('Đã lưu nhiệm vụ thành công.', 'success');
                        } else {
                            showToast('Đã cập nhật giao diện nhưng chưa đồng bộ được dữ liệu lên máy chủ.', 'error');
                            console.error('Cập nhật trạng thái hoàn thành thất bại:', response);
                        }
                    })
                    .catch(err => {
                        showToast('Đã cập nhật giao diện nhưng chưa đồng bộ được dữ liệu lên máy chủ.', 'error');
                        console.error('Lỗi đồng bộ hoàn thành nhiệm vụ:', err);
                    });
            }

            // Element References - Nhật ký học tập
            const btnCreateStudyTask = document.getElementById('btn-create-study-task');
            const studyLogTableBody = document.getElementById('study-log-table-body');
            const studyTaskForm = document.getElementById('study-task-form');
            const studyTaskModalOverlay = document.getElementById('study-task-modal-overlay');
            const btnCloseStudyTaskModal = document.getElementById('btn-close-study-task-modal');
            const btnCancelStudyTask = document.getElementById('btn-cancel-study-task');
            const studyTaskDetailModalOverlay = document.getElementById('study-task-detail-modal-overlay');
            const btnCloseStudyTaskDetail = document.getElementById('btn-close-study-task-detail');
            const btnCloseStudyTaskDetailFooter = document.getElementById('btn-close-study-task-detail-footer');

            if (btnCreateStudyTask) {
                btnCreateStudyTask.addEventListener('click', () => {
                    openStudyTaskModal('create');
                });
            }

            if (btnCloseStudyTaskModal) btnCloseStudyTaskModal.addEventListener('click', closeStudyTaskModal);
            if (btnCancelStudyTask) btnCancelStudyTask.addEventListener('click', closeStudyTaskModal);
            if (studyTaskModalOverlay) {
                studyTaskModalOverlay.addEventListener('click', (e) => {
                    if (e.target === studyTaskModalOverlay) closeStudyTaskModal();
                });
            }

            if (btnCloseStudyTaskDetail) btnCloseStudyTaskDetail.addEventListener('click', closeStudyTaskDetailModal);
            if (btnCloseStudyTaskDetailFooter) btnCloseStudyTaskDetailFooter.addEventListener('click', closeStudyTaskDetailModal);
            if (studyTaskDetailModalOverlay) {
                studyTaskDetailModalOverlay.addEventListener('click', (e) => {
                    if (e.target === studyTaskDetailModalOverlay) closeStudyTaskDetailModal();
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                if (studyTaskModalOverlay && studyTaskModalOverlay.classList.contains('active')) closeStudyTaskModal();
                if (studyTaskDetailModalOverlay && studyTaskDetailModalOverlay.classList.contains('active')) closeStudyTaskDetailModal();
            });

            // Event delegation cho các nút Thao tác trong bảng (Chi tiết / Hoàn thành / Chỉnh sửa / Đánh dấu)
            if (studyLogTableBody) {
                studyLogTableBody.addEventListener('click', (e) => {
                    const btn = e.target.closest('.study-log-row-btn');
                    if (!btn || btn.disabled) return;
                    const row = btn.closest('tr[data-task-id]');
                    if (!row) return;
                    const taskId = row.getAttribute('data-task-id');
                    const task = studyLogTasks.find(t => getStudyTaskKey(t) === taskId);
                    if (!task) return;
                    const action = btn.getAttribute('data-action');

                    if (action === 'detail') {
                        openStudyTaskDetailModal(task);
                    } else if (action === 'complete') {
                        completeStudyTask(task);
                    } else if (action === 'edit') {
                        openStudyTaskModal('edit', task);
                    } else if (action === 'bookmark') {
                        toggleStudyLogBookmark(getStudyTaskKey(task));
                        renderStudyLogTable();
                    }
                });
            }

            // Xử lý Submit Form Tạo mới / Chỉnh sửa nhiệm vụ (Optimistic UI)
            if (studyTaskForm) {
                studyTaskForm.addEventListener('submit', function (e) {
                    e.preventDefault();
                    if (studyLogSubmitting) return;

                    // BƯỚC 1: Lấy dữ liệu từ Form
                    const formData = {
                        TieuDe: (document.getElementById('study-task-title').value || '').trim(),
                        MonHoc: (document.getElementById('study-task-subject').value || '').trim(),
                        GioHetHan: document.getElementById('study-task-due-time').value || '',
                        NgayHetHan: document.getElementById('study-task-due-date').value || '',
                        NoiDung: (document.getElementById('study-task-content').value || '').trim(),
                        LoaiNhiemVu: document.getElementById('study-task-type').value || '',
                        DoUuTien: document.getElementById('study-task-priority').value || '',
                        TrangThai: document.getElementById('study-task-status').value || ''
                    };

                    // BƯỚC 2: Validate dữ liệu
                    const validation = validateStudyTaskForm(formData);
                    if (!validation.ok) {
                        showStudyTaskFormError(validation.message, validation.field);
                        return;
                    }

                    const errorEl = document.getElementById('study-task-form-error');
                    if (errorEl) errorEl.style.display = 'none';

                    const saveBtn = document.getElementById('btn-save-study-task');
                    studyLogSubmitting = true;
                    if (saveBtn) saveBtn.disabled = true;

                    if (studyLogEditingId) {
                        // LUỒNG CHỈNH SỬA
                        const existingTask = studyLogTasks.find(t => getStudyTaskKey(t) === studyLogEditingId);
                        if (!existingTask) {
                            studyLogSubmitting = false;
                            if (saveBtn) saveBtn.disabled = false;
                            closeStudyTaskModal();
                            return;
                        }

                        existingTask.MonHoc = formData.MonHoc;
                        existingTask.TieuDe = formData.TieuDe;
                        existingTask.NoiDung = formData.NoiDung;
                        existingTask.LoaiNhiemVu = formData.LoaiNhiemVu;
                        existingTask.DoUuTien = formData.DoUuTien;
                        existingTask.GioHetHan = formData.GioHetHan;
                        existingTask.NgayHetHan = formData.NgayHetHan;
                        existingTask.TrangThai = formData.TrangThai;

                        // BƯỚC 4-6: Đóng Modal + Cập nhật state + Render lại row ngay lập tức
                        closeStudyTaskModal();
                        renderStudyLogTable();

                        // BƯỚC 7: Đồng bộ nền với Google Apps Script (KHÔNG await trước khi render)
                        callStudyLogAppsScript('updateTask', { task: existingTask, userId: getStudyLogUserId() }, 'POST')
                            .then(response => {
                                if (response && response.success) {
                                    showToast('Đã lưu nhiệm vụ thành công.', 'success');
                                } else {
                                    showToast('Đã cập nhật giao diện nhưng chưa đồng bộ được dữ liệu lên máy chủ.', 'error');
                                    console.error('Cập nhật nhiệm vụ thất bại:', response);
                                }
                            })
                            .catch(err => {
                                showToast('Đã cập nhật giao diện nhưng chưa đồng bộ được dữ liệu lên máy chủ.', 'error');
                                console.error('Lỗi đồng bộ cập nhật nhiệm vụ:', err);
                            })
                            .finally(() => {
                                studyLogSubmitting = false;
                                if (saveBtn) saveBtn.disabled = false;
                            });
                    } else {
                        // LUỒNG TẠO MỚI
                        // BƯỚC 3: Tạo object nhiệm vụ hoàn chỉnh.
                        // Cột "ID" giờ là ID tài khoản SỞ HỮU (dùng để phân quyền), KHÔNG còn là ID
                        // ngẫu nhiên của từng nhiệm vụ. "ThoiGianKhoiTao" ghép với "ID" tạo thành
                        // khóa nội bộ (xem getStudyTaskKey) để phân biệt từng nhiệm vụ.
                        const currentUserId = getStudyLogUserId();
                        if (!currentUserId) {
                            studyLogSubmitting = false;
                            if (saveBtn) saveBtn.disabled = false;
                            showToast('Không xác định được ID người dùng.', 'error');
                            return;
                        }

                        const newTask = {
                            ID: currentUserId,
                            MonHoc: formData.MonHoc,
                            TieuDe: formData.TieuDe,
                            NoiDung: formData.NoiDung,
                            LoaiNhiemVu: formData.LoaiNhiemVu,
                            DoUuTien: formData.DoUuTien,
                            ThoiGianKhoiTao: formatStudyLogCreatedDisplay(new Date()),
                            GioHetHan: formData.GioHetHan,
                            NgayHetHan: formData.NgayHetHan,
                            TrangThai: formData.TrangThai
                        };

                        // Chống nhân đôi: chỉ thêm vào state nếu khóa nội bộ chưa tồn tại
                        if (!studyLogTasks.some(t => getStudyTaskKey(t) === getStudyTaskKey(newTask))) {
                            studyLogTasks.push(newTask);
                        }

                        // BƯỚC 4-6: Đóng Modal + Render row ngay lập tức (Optimistic UI)
                        closeStudyTaskModal();
                        renderStudyLogTable();

                        // BƯỚC 7: Gửi request nền đến Google Apps Script SAU KHI đã render UI
                        callStudyLogAppsScript('createTask', { task: newTask, userId: currentUserId }, 'POST')
                            .then(response => {
                                if (response && response.success) {
                                    showToast('Đã lưu nhiệm vụ thành công.', 'success');
                                } else {
                                    showToast('Đã cập nhật giao diện nhưng chưa đồng bộ được dữ liệu lên máy chủ.', 'error');
                                    console.error('Tạo nhiệm vụ thất bại:', response);
                                }
                            })
                            .catch(err => {
                                showToast('Đã cập nhật giao diện nhưng chưa đồng bộ được dữ liệu lên máy chủ.', 'error');
                                console.error('Lỗi đồng bộ tạo nhiệm vụ:', err);
                            })
                            .finally(() => {
                                studyLogSubmitting = false;
                                if (saveBtn) saveBtn.disabled = false;
                            });
                    }
                });
            }

            // Khôi phục trạng thái Đánh dấu (bookmark) từ localStorage khi tải trang
            loadStudyLogBookmarks();
        });
        if (Array.isArray(y.semesters)) {
                            y.semesters.forEach(s => {
                                if (Array.isArray(s.subjects)) {
                                    s.subjects = sortLearningSubjects(s.subjects);
                                    // Đánh lại STT tự động theo thứ tự sau khi sort
                                    s.subjects.forEach((subj, idx) => {
                                        subj.stt = idx + 1;
                                    });
                                }
                            });
                        }
        
