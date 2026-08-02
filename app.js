// ── Firebase setup ────────────────────────────────────────────────
// Get these 6 values from: Firebase console → ⚙️ (gear icon, top left)
// → Project settings → scroll to "Your apps" → click the web app (</>)
// → "SDK setup and configuration" → Config.
// These are NOT secret — Firebase config is meant to be public in
// frontend code, unlike the old GITHUB_CLIENT_SECRET / JWT_SECRET.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import {
  getAuth,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
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

// ── Auth ──────────────────────────────────────────────────────────
// No backend, no JWT, no redirect — Firebase handles the whole GitHub
// OAuth handshake itself and just gives us a signed-in user back.
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

// Fires once on page load with whatever the current session is (or null),
// and again any time sign-in state changes. Firebase persists the session
// itself, so there's no localStorage token to manage anymore.
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    userBox.classList.remove('hidden');
    submitSection.classList.remove('hidden');
    userAvatar.src = user.photoURL || '';
    userName.textContent = user.displayName || user.email || 'logged in';
  } else {
    loginBtn.classList.remove('hidden');
    userBox.classList.add('hidden');
    submitSection.classList.add('hidden');
  }
});

// ── Mods list ─────────────────────────────────────────────────────
async function loadMods() {
  modsList.innerHTML = '<p class="muted">Loading mods…</p>';
  try {
    const modsQuery = query(collection(db, 'mods'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(modsQuery);
    const mods = snapshot.docs.map((doc) => doc.data());

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
          <img src="${escapeAttr(mod.authorAvatar)}" alt="">
          <span>${escapeHtml(mod.authorName)}</span>
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

// ── Submit form ───────────────────────────────────────────────────
modForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  submitStatus.textContent = 'Submitting…';
  try {
    await addDoc(collection(db, 'mods'), {
      name: document.getElementById('mod-name').value,
      description: document.getElementById('mod-description').value,
      version: document.getElementById('mod-version').value,
      downloadUrl: document.getElementById('mod-download').value,
      repoUrl: document.getElementById('mod-repo').value,
      authorId: user.uid,
      authorName: user.displayName || 'anonymous',
      authorAvatar: user.photoURL || '',
      createdAt: serverTimestamp(),
    });

    modForm.reset();
    submitStatus.textContent = 'Mod submitted!';
    loadMods();
  } catch (err) {
    submitStatus.textContent = `Error: ${err.message}`;
  }
});

loadMods();