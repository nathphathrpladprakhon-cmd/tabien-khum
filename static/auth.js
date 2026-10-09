/**
 * Authentication and User Management Module for Tabien-Khum
 * กองสาธารณสุขและสิ่งแวดล้อม เทศบาลนครบางบัวทอง
 */

const AUTH_USERS_KEY = 'tabien_khum_users';
const AUTH_SESSION_KEY = 'tabien_khum_current_user';

const DEFAULT_USERS = [
  { username: 'admin', password: 'admin1234', name: 'ผู้ดูแลระบบ', role: 'admin' },
  { username: 'officer', password: '1234', name: 'เจ้าหน้าที่สาธารณสุข', role: 'officer' }
];

function getUsers() {
  try {
    const raw = localStorage.getItem(AUTH_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(DEFAULT_USERS));
  return [...DEFAULT_USERS];
}

function saveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCurrentUser(user) {
  if (user) {
    const data = JSON.stringify(user);
    sessionStorage.setItem(AUTH_SESSION_KEY, data);
    localStorage.setItem(AUTH_SESSION_KEY, data);
  } else {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
  }
}

function authenticate(username, password) {
  const users = getUsers();
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '').trim();
  const found = users.find(x => String(x.username).toLowerCase() === u && String(x.password) === p);
  if (found) {
    setCurrentUser(found);
    return found;
  }
  return null;
}

function logout() {
  setCurrentUser(null);
  location.reload();
}

function ensureLoginOverlay() {
  let overlay = document.getElementById('loginOverlay');
  if (!overlay) {
    overlay = document.createElement('dialog');
    overlay.id = 'loginOverlay';
    overlay.innerHTML = `
      <div class="login-header">
        <img src="municipality-seal-transparent.png" alt="ตราเทศบาลนครบางบัวทอง">
        <h2>ระบบทะเบียนคุม</h2>
        <p>กองสาธารณสุขและสิ่งแวดล้อม • เทศบาลนครบางบัวทอง</p>
      </div>
      <div class="login-body">
        <form id="loginForm">
          <div class="login-field">
            <label for="loginUsername">ชื่อผู้ใช้งาน (Username)</label>
            <input type="text" id="loginUsername" placeholder="กรอกชื่อผู้ใช้งาน" required autocomplete="username">
          </div>
          <div class="login-field">
            <label for="loginPassword">รหัสผ่าน (Password)</label>
            <input type="password" id="loginPassword" placeholder="กรอกรหัสผ่าน" required autocomplete="current-password">
          </div>
          <button type="submit" class="login-btn">เข้าสู่ระบบ</button>
          <div class="login-error" id="loginError"></div>
          <div class="login-hints">
            🔒 กรุณาเข้าสู่ระบบเพื่อเข้าถึงข้อมูลทะเบียนและแผนที่
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('cancel', e => {
      // Prevent closing login dialog via Escape key
      if (!getCurrentUser()) e.preventDefault();
    });

    const form = overlay.querySelector('#loginForm');
    form.onsubmit = e => {
      e.preventDefault();
      const u = overlay.querySelector('#loginUsername').value;
      const p = overlay.querySelector('#loginPassword').value;
      const errorDiv = overlay.querySelector('#loginError');
      const user = authenticate(u, p);
      if (user) {
        errorDiv.textContent = '';
        overlay.close();
        updateAuthDisplay();
        window.dispatchEvent(new CustomEvent('auth-success', { detail: user }));
      } else {
        errorDiv.textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
      }
    };
  }
  return overlay;
}

function updateAuthDisplay() {
  const user = getCurrentUser();
  const nameEl = document.getElementById('currentUserName');
  if (nameEl && user) {
    nameEl.textContent = `${user.name} (${user.role === 'admin' ? 'ผู้ดูแล' : 'เจ้าหน้าที่'})`;
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }
}

function checkLoginRequired() {
  const user = getCurrentUser();
  const overlay = ensureLoginOverlay();
  if (!user) {
    overlay.showModal();
    const input = overlay.querySelector('#loginUsername');
    if (input) setTimeout(() => input.focus(), 100);
  } else {
    if (overlay.open) overlay.close();
    updateAuthDisplay();
  }
}

// User Management in Settings
function renderUserManager() {
  const container = document.getElementById('userListContainer');
  if (!container) return;
  const users = getUsers();
  const current = getCurrentUser();

  const rows = users.map((u, idx) => `
    <tr>
      <td><b>${escapeAuth(u.username)}</b></td>
      <td>${escapeAuth(u.name)}</td>
      <td><span class="tag" style="background:#e8f4ef;color:#0e5145;padding:3px 8px;border-radius:6px;font-size:11px">${u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่'}</span></td>
      <td>
        ${users.length > 1 && u.username !== current?.username ? `
          <button type="button" class="secondary" style="padding:3px 8px;font-size:11px;color:#c00;border-color:#fca5a5" data-del-user="${escapeAuth(u.username)}">ลบ</button>
        ` : '<span style="color:#999;font-size:11px">บัญชีปัจจุบัน</span>'}
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="user-table">
      <thead>
        <tr><th>ชื่อผู้ใช้</th><th>ชื่อ - สกุล</th><th>บทบาท</th><th>จัดการ</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  container.querySelectorAll('[data-del-user]').forEach(btn => {
    btn.onclick = () => {
      const uname = btn.dataset.delUser;
      if (confirm(`ยืนยันการลบบัญชีผู้ใช้ "${uname}" หรือไม่?`)) {
        const remaining = getUsers().filter(x => x.username !== uname);
        saveUsers(remaining);
        renderUserManager();
      }
    };
  });
}

function setupUserAddForm() {
  const form = document.getElementById('addUserForm');
  if (!form) return;
  form.onsubmit = e => {
    e.preventDefault();
    const u = form.elements['newUsername'].value.trim();
    const p = form.elements['newPassword'].value.trim();
    const name = form.elements['newName'].value.trim();
    const role = form.elements['newRole'].value;

    if (!u || !p || !name) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');

    const users = getUsers();
    if (users.some(x => x.username.toLowerCase() === u.toLowerCase())) {
      return alert('มีชื่อผู้ใช้งานนี้อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
    }

    users.push({ username: u, password: p, name, role });
    saveUsers(users);
    form.reset();
    renderUserManager();
    alert(`เพิ่มบัญชีผู้ใช้งาน "${u}" เรียบร้อยแล้ว`);
  };
}

function escapeAuth(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Auto init on DOMContentLoaded or load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    checkLoginRequired();
    setupUserAddForm();
  });
} else {
  checkLoginRequired();
  setupUserAddForm();
}

