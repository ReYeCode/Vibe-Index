// ⚠️ REPLACE this with your actual Render service URL — tell me the name
// you gave it on Render and I'll fill this in for you, or just swap it
// yourself: it's always https://<your-render-service-name>.onrender.com
const API_URL = 'https://vibemodded-index-api.onrender.com';

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userBox = document.getElementById('user-box');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const submitSection = document.getElementById('submit-section');
const modForm = document.getElementById('mod-form');
const submitStatus = document.getElementById('submit-status');
const modsList = document.getElementById('mods-list');
const modCount = document.getElementById('mod-count');
const authError = document.getElementById('auth-error');

const TOKEN_KEY = 'vibemodded_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// After GitHub login, the backend redirects here with either
// ?token=... (success) or ?auth_error=... (failure). Read whichever is
// present, then scrub the query string so it doesn't linger in the URL.
function captureRedirectParams() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const err = params.get('auth_error');

  if (token) setToken(token);
  if (err) {
    authError.textContent = `Login failed: ${err}. Please try again.`;
    authError.classList.remove('hidden');
  }
  if (token || err) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function loadCurrentUser() {
  const token = getToken();
  if (!token) {
    showLoggedOut();
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Session expired');
    const user = await res.json();

    loginBtn.classList.add('hidden');
    userBox.classList.remove('hidden');
    submitSection.classList.remove('hidden');
    userAvatar.src = user.avatarUrl;
    userName.textContent = user.username;
  } catch (err) {
    clearToken();
    showLoggedOut();
  }
}

function showLoggedOut() {
  loginBtn.classList.remove('hidden');
  userBox.classList.add('hidden');
  submitSection.classList.add('hidden');
}

async function loadMods() {
  modsList.innerHTML = '<p class="muted">Loading mods…</p>';
  try {
    const res = await fetch(`${API_URL}/api/mods`);
    if (!res.ok) throw new Error('Request failed');
    const mods = await res.json();

    modCount.textContent = mods.length ? `${mods.length} indexed` : '';

    if (mods.length === 0) {
      modsList.innerHTML = '<p class="muted">No mods submitted yet. Be the first!</p>';
      return;
    }

    modsList.innerHTML = mods
      .map(
        (mod, i) => `
      <article class="mod-card">
        <div class="mod-card-top">
          <span class="mod-index">No. ${String(mods.length - i).padStart(3, '0')}</span>
          ${mod.version ? `<span class="mod-version">v${escapeHtml(mod.version)}</span>` : ''}
        </div>
        <h3 class="mod-name">${escapeHtml(mod.name)}</h3>
        <p class="mod-desc">${escapeHtml(mod.description || 'No description provided.')}</p>
        <div class="mod-author">
          <img src="${escapeAttr(mod.author_avatar)}" alt="">
          <span>${escapeHtml(mod.author)}</span>
        </div>
        <div class="mod-links">
          <a href="${escapeAttr(mod.download_url)}" target="_blank" rel="noopener">Download</a>
          ${mod.repo_url ? `<a class="secondary" href="${escapeAttr(mod.repo_url)}" target="_blank" rel="noopener">Source</a>` : ''}
        </div>
      </article>`
      )
      .join('');
  } catch (err) {
    modsList.innerHTML =
      '<p class="muted">Could not load mods. Free Render services sleep after 15 min idle — the first request can take ~30-60s to wake it up. Try refreshing shortly.</p>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

loginBtn.addEventListener('click', () => {
  window.location.href = `${API_URL}/auth/github`;
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  showLoggedOut();
});

modForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = getToken();
  submitStatus.textContent = 'Submitting…';

  try {
    const res = await fetch(`${API_URL}/api/mods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: document.getElementById('mod-name').value,
        description: document.getElementById('mod-description').value,
        version: document.getElementById('mod-version').value,
        download_url: document.getElementById('mod-download').value,
        repo_url: document.getElementById('mod-repo').value,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }

    modForm.reset();
    submitStatus.textContent = 'Mod submitted!';
    loadMods();
  } catch (err) {
    submitStatus.textContent = `Error: ${err.message}`;
  }
});

captureRedirectParams();
loadCurrentUser();
loadMods();
