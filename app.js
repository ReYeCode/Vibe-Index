// ── Firebase setup ────────────────────────────────────────────────
// Get these 6 values from: Firebase console → ⚙️ → Project settings →
// "Your apps" → the web app (</>) → SDK setup and configuration.
// Not secret — safe to have visible in frontend code.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import {
  getAuth,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile,
  getAdditionalUserInfo,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  increment,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBIQa6Ykh6149gWU1PfnBxzKuWF_s6c-mY",
  authDomain: "vibemodded-index.firebaseapp.com",
  projectId: "vibemodded-index",
  storageBucket: "vibemodded-index.firebasestorage.app",
  messagingSenderId: "182624398225",
  appId: "1:182624398225:web:4e24a4255938f224408830"
};

// ⚠️ Add your own Firebase Auth UID here to get admin access (Approve/
// Reject buttons, Feature toggle). Find your UID in the Firebase console
// → Authentication → Users tab, after logging in once. This list must
// match ADMIN_UIDS in firestore.rules exactly, or the buttons will show
// but every click will be rejected by the server.
const ADMIN_UIDS = ['REPLACE_WITH_YOUR_UID'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const githubProvider = new GithubAuthProvider();

function isAdmin(user) {
  return !!user && ADMIN_UIDS.includes(user.uid);
}

// ── DOM references ──────────────────────────────────────────────
const loginBtn = document.getElementById('login-btn');
const navMods = document.getElementById('nav-mods');
const navDevelopers = document.getElementById('nav-developers');
const navAdmin = document.getElementById('nav-admin');
const navProfile = document.getElementById('nav-profile');
const viewMods = document.getElementById('view-mods');
const viewDevelopers = document.getElementById('view-developers');
const viewProfile = document.getElementById('view-profile');
const viewAdmin = document.getElementById('view-admin');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const authError = document.getElementById('auth-error');

const profileAvatar = document.getElementById('profile-avatar');
const displayNameForm = document.getElementById('display-name-form');
const displayNameInput = document.getElementById('display-name-input');
const profileStatus = document.getElementById('profile-status');
const logoutBtn = document.getElementById('logout-btn');

const modForm = document.getElementById('mod-form');
const submitStatus = document.getElementById('submit-status');
const modsList = document.getElementById('mods-list');
const modCount = document.getElementById('mod-count');
const pendingList = document.getElementById('pending-list');
const approvedList = document.getElementById('approved-list');
const rejectedList = document.getElementById('rejected-list');

const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const filterMine = document.getElementById('filter-mine');
const filterFeatured = document.getElementById('filter-featured');
const tagFiltersEl = document.getElementById('tag-filters');
const platformFiltersEl = document.getElementById('platform-filters');
const activeFilterBanner = document.getElementById('active-filter-banner');
const activeFilterText = document.getElementById('active-filter-text');
const clearFilterBtn = document.getElementById('clear-filter-btn');
const developersList = document.getElementById('developers-list');
const adminPendingList = document.getElementById('admin-pending-list');
const adminApprovedList = document.getElementById('admin-approved-list');

const PLATFORM_LABELS = {
  win: 'Windows',
  mac: 'macOS',
  'mac-intel': 'macOS (Intel)',
  'mac-arm': 'macOS (ARM)',
  android: 'Android',
  android32: 'Android (32-bit)',
  android64: 'Android (64-bit)',
  ios: 'iOS',
};

// ── State ─────────────────────────────────────────────────────────
let allMods = []; // every approved mod, fetched once and filtered/sorted in memory
let developerFilter = null;

// ── View switching ────────────────────────────────────────────────
function showView(view) {
  viewMods.classList.toggle('hidden', view !== 'mods');
  viewDevelopers.classList.toggle('hidden', view !== 'developers');
  viewProfile.classList.toggle('hidden', view !== 'profile');
  viewAdmin.classList.toggle('hidden', view !== 'admin');
  navMods.classList.toggle('active', view === 'mods');
  navDevelopers.classList.toggle('active', view === 'developers');
}
navMods.addEventListener('click', () => showView('mods'));
navDevelopers.addEventListener('click', () => {
  showView('developers');
  renderDevelopers();
});
navProfile.addEventListener('click', () => showView('profile'));
navAdmin.addEventListener('click', () => {
  showView('admin');
  loadAdmin();
});

// ── Auth ──────────────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  authError.classList.add('hidden');
  try {
    const result = await signInWithPopup(auth, githubProvider);
    const info = getAdditionalUserInfo(result);
    const githubUsername = info?.username || '';
    // Saved so we can verify repo ownership later even in a session where
    // the user didn't just click through the login popup.
    await setDoc(
      doc(db, 'users', result.user.uid),
      {
        githubUsername,
        displayName: result.user.displayName || '',
        avatarUrl: result.user.photoURL || '',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    authError.textContent = `Login failed: ${err.message}`;
    authError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    navProfile.classList.remove('hidden');
    navAdmin.classList.toggle('hidden', !isAdmin(user));
    userAvatar.src = user.photoURL || '';
    userName.textContent = user.displayName || user.email || 'logged in';
    profileAvatar.src = user.photoURL || '';
    displayNameInput.value = user.displayName || '';
    loadMyMods();
  } else {
    loginBtn.classList.remove('hidden');
    navProfile.classList.add('hidden');
    navAdmin.classList.add('hidden');
    showView('mods');
    pendingList.innerHTML = '';
    approvedList.innerHTML = '';
    rejectedList.innerHTML = '';
  }
  renderModsList(); // "only my mods" depends on auth state
});

displayNameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;
  profileStatus.textContent = 'Saving…';
  try {
    await updateProfile(user, { displayName: displayNameInput.value.trim() });
    userName.textContent = user.displayName;
    profileStatus.textContent = 'Updated!';
  } catch (err) {
    profileStatus.textContent = `Error: ${err.message}`;
  }
});

// ── Helpers ───────────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
function platformLabel(key) {
  return PLATFORM_LABELS[key] || key;
}

// ── Public mods list ──────────────────────────────────────────────
async function loadMods() {
  modsList.innerHTML = '<p class="muted">Loading mods…</p>';
  try {
    // Needs a composite index (status ↑, createdAt ↓) — Firestore will
    // print a direct "create index" link in the console if it's missing.
    const modsQuery = query(
      collection(db, 'mods'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(modsQuery);
    allMods = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    buildDynamicFilters();
    renderModsList();
  } catch (err) {
    console.error(err);
    modsList.innerHTML = '<p class="muted">Could not load mods — open the browser console for details.</p>';
  }
}

// Builds the Tags / Platform checkbox lists from whatever tags and
// platforms actually appear across the current mods, instead of a
// hardcoded list that could drift out of date.
function buildDynamicFilters() {
  const tags = new Set();
  const platforms = new Set();
  allMods.forEach((m) => {
    (m.tags || []).forEach((t) => tags.add(t));
    (m.platforms || []).forEach((p) => platforms.add(p));
  });

  tagFiltersEl.innerHTML = tags.size
    ? [...tags].sort().map((t) => `
      <label class="checkbox-row">
        <input type="checkbox" class="tag-filter-checkbox" value="${escapeAttr(t)}"> ${escapeHtml(t)}
      </label>`).join('')
    : '<p class="muted small">No tags yet.</p>';

  platformFiltersEl.innerHTML = platforms.size
    ? [...platforms].sort().map((p) => `
      <label class="checkbox-row">
        <input type="checkbox" class="platform-filter-checkbox" value="${escapeAttr(p)}"> ${escapeHtml(platformLabel(p))}
      </label>`).join('')
    : '<p class="muted small">No platform data yet.</p>';

  tagFiltersEl.querySelectorAll('.tag-filter-checkbox').forEach((cb) => cb.addEventListener('change', renderModsList));
  platformFiltersEl.querySelectorAll('.platform-filter-checkbox').forEach((cb) => cb.addEventListener('change', renderModsList));
}

function renderModsList() {
  const term = searchInput.value.trim().toLowerCase();
  const selectedTags = [...tagFiltersEl.querySelectorAll('.tag-filter-checkbox:checked')].map((cb) => cb.value);
  const selectedPlatforms = [...platformFiltersEl.querySelectorAll('.platform-filter-checkbox:checked')].map((cb) => cb.value);
  const onlyMine = filterMine.checked;
  const onlyFeatured = filterFeatured.checked;
  const user = auth.currentUser;

  if (developerFilter) {
    activeFilterText.textContent = `Showing mods by ${developerFilter}`;
    activeFilterBanner.classList.remove('hidden');
  } else {
    activeFilterBanner.classList.add('hidden');
  }

  let mods = allMods.filter((m) => {
    if (term) {
      const haystack = `${m.name} ${m.description} ${m.developer}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (developerFilter && m.developer !== developerFilter) return false;
    if (selectedTags.length && !selectedTags.some((t) => (m.tags || []).includes(t))) return false;
    if (selectedPlatforms.length && !selectedPlatforms.some((p) => (m.platforms || []).includes(p))) return false;
    if (onlyMine && (!user || m.authorId !== user.uid)) return false;
    if (onlyFeatured && !m.featured) return false;
    return true;
  });

  const sortBy = sortSelect.value;
  mods = mods.slice().sort((a, b) => {
    if (sortBy === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return (b.downloads || 0) - (a.downloads || 0); // 'downloads' default
  });

  modCount.textContent = mods.length ? `${mods.length} indexed` : '';

  if (mods.length === 0) {
    modsList.innerHTML = '<p class="muted">No mods match — try clearing a filter.</p>';
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
      <h3 class="mod-name">${mod.featured ? '<span class="featured-star" title="Featured">★</span>' : ''}${escapeHtml(mod.name)}</h3>
      <p class="mod-desc">${escapeHtml(mod.description || 'No description provided.')}</p>
      <div class="mod-badges">
        ${(mod.tags || []).map((t) => `<span class="mod-badge">${escapeHtml(t)}</span>`).join('')}
        ${(mod.platforms || []).map((p) => `<span class="mod-badge">${escapeHtml(platformLabel(p))}</span>`).join('')}
      </div>
      <div class="mod-author">
        <img src="${escapeAttr(mod.authorAvatar)}" alt="">
        <span>${escapeHtml(mod.developer || mod.authorName)}</span>
      </div>
      <div class="mod-downloads">${(mod.downloads || 0).toLocaleString()} downloads</div>
      <div class="mod-links">
        <a class="download-link" data-mod-id="${mod.id}" href="${escapeAttr(mod.downloadUrl)}" target="_blank" rel="noopener">Download</a>
        ${mod.repoUrl ? `<a class="secondary" href="${escapeAttr(mod.repoUrl)}" target="_blank" rel="noopener">Source</a>` : ''}
      </div>
    </article>`
    )
    .join('');
}

// Fire-and-forget counter bump — doesn't block the download navigation.
modsList.addEventListener('click', (e) => {
  const link = e.target.closest('.download-link');
  if (!link) return;
  const id = link.dataset.modId;
  updateDoc(doc(db, 'mods', id), { downloads: increment(1) }).catch((err) => console.error(err));
});

searchInput.addEventListener('input', renderModsList);
sortSelect.addEventListener('change', renderModsList);
filterMine.addEventListener('change', renderModsList);
filterFeatured.addEventListener('change', renderModsList);
clearFilterBtn.addEventListener('click', () => {
  developerFilter = null;
  renderModsList();
});

// ── Developers view ───────────────────────────────────────────────
function renderDevelopers() {
  const counts = new Map();
  allMods.forEach((m) => {
    const name = m.developer || m.authorName || 'Unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  const developers = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  developersList.innerHTML = developers.length
    ? developers
        .map(
          ([name, count]) => `
      <button class="developer-card" data-developer="${escapeAttr(name)}">
        <div class="developer-name">${escapeHtml(name)}</div>
        <div class="developer-count">${count} mod${count === 1 ? '' : 's'}</div>
      </button>`
        )
        .join('')
    : '<p class="muted">No developers yet.</p>';

  developersList.querySelectorAll('.developer-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      developerFilter = btn.dataset.developer;
      showView('mods');
      renderModsList();
    });
  });
}

// ── Your mods (profile page) ──────────────────────────────────────
async function loadMyMods() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const mineQuery = query(collection(db, 'mods'), where('authorId', '==', user.uid));
    const snapshot = await getDocs(mineQuery);
    const mine = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    mine.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    renderMyMods(pendingList, mine.filter((m) => m.status === 'pending'), 'No pending mods.');
    renderMyMods(approvedList, mine.filter((m) => m.status === 'approved'), 'No approved mods yet.');
    renderMyMods(rejectedList, mine.filter((m) => m.status === 'rejected'), 'No rejected mods.');
  } catch (err) {
    console.error(err);
  }
}

function renderMyMods(container, mods, emptyText) {
  if (mods.length === 0) {
    container.innerHTML = `<p class="muted">${emptyText}</p>`;
    return;
  }
  container.innerHTML = mods
    .map(
      (m) => `
    <div class="my-mod-row">
      <span>${escapeHtml(m.name)} ${m.version ? `<span class="mod-version">v${escapeHtml(m.version)}</span>` : ''}</span>
      ${m.status === 'rejected' && m.rejectionReason ? `<span class="muted">${escapeHtml(m.rejectionReason)}</span>` : ''}
    </div>`
    )
    .join('');
}

// ── Admin view ──────────────────────────────────────────────────────
async function loadAdmin() {
  const user = auth.currentUser;
  if (!isAdmin(user)) return;

  try {
    const pendingQuery = query(collection(db, 'mods'), where('status', '==', 'pending'));
    const pendingSnap = await getDocs(pendingQuery);
    const pending = pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    adminPendingList.innerHTML = pending.length
      ? pending
          .map(
            (m) => `
        <div class="admin-row">
          <div class="admin-row-info">
            ${escapeHtml(m.name)} ${m.version ? `v${escapeHtml(m.version)}` : ''}
            <span class="muted">by ${escapeHtml(m.developer)} · submitted by ${escapeHtml(m.authorName)}</span>
            <span class="muted"><a href="${escapeAttr(m.repoUrl)}" target="_blank" rel="noopener">${escapeHtml(m.repoUrl)}</a></span>
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-approve small" data-approve="${m.id}">Approve</button>
            <button class="btn btn-reject small" data-reject="${m.id}">Reject</button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="muted">Nothing pending.</p>';

    adminPendingList.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => setModStatus(btn.dataset.approve, 'approved'));
    });
    adminPendingList.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reason = window.prompt('Reason for rejecting (shown to the submitter):', '');
        if (reason === null) return; // cancelled
        setModStatus(btn.dataset.reject, 'rejected', reason);
      });
    });

    const approvedQuery = query(collection(db, 'mods'), where('status', '==', 'approved'));
    const approvedSnap = await getDocs(approvedQuery);
    const approved = approvedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    adminApprovedList.innerHTML = approved.length
      ? approved
          .map(
            (m) => `
        <div class="admin-row">
          <div class="admin-row-info">${escapeHtml(m.name)} ${m.featured ? '<span class="featured-star">★ featured</span>' : ''}</div>
          <div class="admin-row-actions">
            <button class="btn btn-ghost small" data-toggle-feature="${m.id}" data-current="${m.featured ? '1' : '0'}">
              ${m.featured ? 'Unfeature' : 'Feature'}
            </button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="muted">No approved mods yet.</p>';

    adminApprovedList.querySelectorAll('[data-toggle-feature]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nextFeatured = btn.dataset.current !== '1';
        await updateDoc(doc(db, 'mods', btn.dataset.toggleFeature), { featured: nextFeatured });
        loadAdmin();
        loadMods();
      });
    });
  } catch (err) {
    console.error(err);
  }
}

async function setModStatus(modId, status, rejectionReason = null) {
  try {
    await updateDoc(doc(db, 'mods', modId), { status, rejectionReason });
    loadAdmin();
    loadMods();
  } catch (err) {
    window.alert(`Failed to update: ${err.message}`);
  }
}

// ── GitHub mod.json scanner ───────────────────────────────────────
function parseRepoUrl(url) {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

// GitHub base64-encodes file contents with embedded newlines; decode it
// properly as UTF-8 so non-ASCII descriptions don't break.
function base64ToUtf8(b64) {
  const clean = b64.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

async function scanAndSubmitMod(repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw new Error("That doesn't look like a github.com repository URL");
  const { owner, repo } = parsed;
  const user = auth.currentUser;

  // 0. Ownership check — the repo's actual owner must match the GitHub
  // account currently signed in, so nobody can index someone else's mod
  // under their own name.
  const userDocSnap = await getDoc(doc(db, 'users', user.uid));
  const githubUsername = userDocSnap.exists() ? userDocSnap.data().githubUsername : null;

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!repoRes.ok) throw new Error(`Repo ${owner}/${repo} not found (it must be public)`);
  const repoData = await repoRes.json();
  const actualOwner = repoData.owner?.login || owner;

  if (!githubUsername || actualOwner.toLowerCase() !== githubUsername.toLowerCase()) {
    throw new Error(
      `This repo belongs to "${actualOwner}", but you're logged in as "${githubUsername || 'unknown'}" — you can only submit mods from your own repos.`
    );
  }

  // 1. mod.json from the repo root (api.github.com supports CORS; the
  // release-asset CDN used in step 2 does not, which is why we read the
  // manifest here instead of unzipping the .geode file itself).
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/mod.json`);
  if (!metaRes.ok) {
    throw new Error(`Couldn't find mod.json at the root of ${owner}/${repo}`);
  }
  const metaJson = await metaRes.json();
  const modJson = JSON.parse(base64ToUtf8(metaJson.content));

  const developer =
    modJson.developer ||
    (Array.isArray(modJson.developers) ? modJson.developers.join(', ') : '') ||
    'Unknown';
  const tags = Array.isArray(modJson.tags) ? modJson.tags : [];
  const platforms = modJson.gd && typeof modJson.gd === 'object' ? Object.keys(modJson.gd) : [];

  // 2. Latest release, to find the actual .geode file to link to.
  const releaseRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
  if (!releaseRes.ok) {
    throw new Error(`${owner}/${repo} has no releases yet — publish one with a .geode file attached first`);
  }
  const release = await releaseRes.json();
  const asset = (release.assets || []).find((a) => a.name.endsWith('.geode'));
  if (!asset) {
    throw new Error('The latest release has no .geode file attached');
  }

  await addDoc(collection(db, 'mods'), {
    modId: modJson.id || '',
    name: modJson.name || repo,
    description: modJson.description || '',
    version: modJson.version || release.tag_name || '',
    developer,
    tags,
    platforms,
    repoUrl: `https://github.com/${owner}/${repo}`,
    downloadUrl: asset.browser_download_url,
    authorId: user.uid,
    authorName: user.displayName || 'anonymous',
    authorAvatar: user.photoURL || '',
    status: 'pending',
    rejectionReason: null,
    featured: false,
    downloads: 0,
    createdAt: serverTimestamp(),
  });

  return modJson.name || repo;
}

modForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('mod-repo-url');
  submitStatus.textContent = 'Scanning repo…';
  try {
    const name = await scanAndSubmitMod(input.value);
    input.value = '';
    submitStatus.textContent = `Submitted "${name}" — pending review.`;
    loadMyMods();
  } catch (err) {
    submitStatus.textContent = `Error: ${err.message}`;
  }
});

loadMods();