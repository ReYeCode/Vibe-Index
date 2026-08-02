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
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const githubProvider = new GithubAuthProvider();

// ── DOM references ──────────────────────────────────────────────
const loginBtn = document.getElementById('login-btn');
const navMods = document.getElementById('nav-mods');
const navProfile = document.getElementById('nav-profile');
const viewMods = document.getElementById('view-mods');
const viewProfile = document.getElementById('view-profile');
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

// ── View switching (both views live in this one index.html) ─────
function showView(view) {
  viewMods.classList.toggle('hidden', view !== 'mods');
  viewProfile.classList.toggle('hidden', view !== 'profile');
  navMods.classList.toggle('active', view === 'mods');
}
navMods.addEventListener('click', () => showView('mods'));
navProfile.addEventListener('click', () => showView('profile'));

// ── Auth ──────────────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  authError.classList.add('hidden');
  try {
    await signInWithPopup(auth, githubProvider);
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
    userAvatar.src = user.photoURL || '';
    userName.textContent = user.displayName || user.email || 'logged in';
    profileAvatar.src = user.photoURL || '';
    displayNameInput.value = user.displayName || '';
    loadMyMods();
  } else {
    loginBtn.classList.remove('hidden');
    navProfile.classList.add('hidden');
    showView('mods');
    pendingList.innerHTML = '';
    approvedList.innerHTML = '';
    rejectedList.innerHTML = '';
  }
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

// ── Public mods list ──────────────────────────────────────────────
async function loadMods() {
  modsList.innerHTML = '<p class="muted">Loading mods…</p>';
  try {
    // Needs a composite index (status ↑, createdAt ↓) — see the README
    // note. Firestore will print a direct "create index" link in the
    // console the first time this runs if it's missing.
    const modsQuery = query(
      collection(db, 'mods'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(modsQuery);
    const mods = snapshot.docs.map((doc) => doc.data());

    modCount.textContent = mods.length ? `${mods.length} indexed` : '';

    if (mods.length === 0) {
      modsList.innerHTML = '<p class="muted">No mods approved yet. Be the first!</p>';
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
          <img src="${escapeAttr(mod.authorAvatar)}" alt="">
          <span>${escapeHtml(mod.developer || mod.authorName)}</span>
        </div>
        <div class="mod-links">
          <a href="${escapeAttr(mod.downloadUrl)}" target="_blank" rel="noopener">Download</a>
          ${mod.repoUrl ? `<a class="secondary" href="${escapeAttr(mod.repoUrl)}" target="_blank" rel="noopener">Source</a>` : ''}
        </div>
      </article>`
      )
      .join('');
  } catch (err) {
    console.error(err);
    modsList.innerHTML = '<p class="muted">Could not load mods — open the browser console for details.</p>';
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

// ── Your mods (profile page) ──────────────────────────────────────
async function loadMyMods() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Equality-only filter, no orderBy — doesn't need a composite index.
    const mineQuery = query(collection(db, 'mods'), where('authorId', '==', user.uid));
    const snapshot = await getDocs(mineQuery);
    const mine = snapshot.docs.map((doc) => doc.data());
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

// GitHub base64-encodes file contents as ASCII with embedded newlines;
// decode it properly as UTF-8 so non-ASCII descriptions don't break.
function base64ToUtf8(b64) {
  const clean = b64.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

async function scanAndSubmitMod(repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw new Error("That doesn't look like a github.com repository URL");
  const { owner, repo } = parsed;

  // 1. Pull mod.json straight from the repo (this is what api.github.com
  //    is for — it supports CORS, unlike GitHub's release-asset CDN).
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/mod.json`);
  if (!metaRes.ok) {
    throw new Error(`Couldn't find mod.json at the root of ${owner}/${repo} (repo must be public)`);
  }
  const metaJson = await metaRes.json();
  const modJson = JSON.parse(base64ToUtf8(metaJson.content));

  const developer =
    modJson.developer ||
    (Array.isArray(modJson.developers) ? modJson.developers.join(', ') : '') ||
    'Unknown';

  // 2. Pull the latest release to find the actual .geode file to link to.
  const releaseRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
  if (!releaseRes.ok) {
    throw new Error(`${owner}/${repo} has no releases yet — publish one with a .geode file attached first`);
  }
  const release = await releaseRes.json();
  const asset = (release.assets || []).find((a) => a.name.endsWith('.geode'));
  if (!asset) {
    throw new Error('The latest release has no .geode file attached');
  }

  const user = auth.currentUser;
  await addDoc(collection(db, 'mods'), {
    modId: modJson.id || '',
    name: modJson.name || repo,
    description: modJson.description || '',
    version: modJson.version || release.tag_name || '',
    developer,
    repoUrl: `https://github.com/${owner}/${repo}`,
    downloadUrl: asset.browser_download_url,
    authorId: user.uid,
    authorName: user.displayName || 'anonymous',
    authorAvatar: user.photoURL || '',
    status: 'pending',
    rejectionReason: null,
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