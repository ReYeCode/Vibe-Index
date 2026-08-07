<article class="mod-card">
      <div class="mod-card-top">
        <span class="mod-index">No. ${String(mods.length - i).padStart(3, '0')}</span>
        ${mod.version ? `<span class="mod-version">v${escapeHtml(mod.version)}</span>` : ''}
      </div>
      <h3 class="mod-name">${mod.featured ? '<span class="featured-star" title="Featured">*</span>' : ''}${escapeHtml(mod.name)}</h3>
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

// This just bumps a counter, it does not block the download link from
// opening normally.
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

// Developers view.
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

// Your mods, shown on the profile page.
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

// Admin view.
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
            <span class="muted">by ${escapeHtml(m.developer)}, submitted by ${escapeHtml(m.authorName)}</span>
            <span class="muted"><a href="${escapeAttr(m.repoUrl)}" target="_blank" rel="noopener">${escapeHtml(m.repoUrl)}</a></span>
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-approve small" data-approve="${m.id}">Approve</button>
            <button class="btn btn-reject small" data-reject="${m.id}">Reject</button>
            <button class="btn btn-ghost small" data-delete="${m.id}">Delete</button>
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
        const reason = window.prompt('Reason for rejecting, this is shown to the person who submitted it:', '');
        if (reason === null) return;
        setModStatus(btn.dataset.reject, 'rejected', reason);
      });
    });
    adminPendingList.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteMod(btn.dataset.delete));
    });

    const approvedQuery = query(collection(db, 'mods'), where('status', '==', 'approved'));
    const approvedSnap = await getDocs(approvedQuery);
    const approved = approvedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    adminApprovedList.innerHTML = approved.length
      ? approved
          .map(
            (m) => `
        <div class="admin-row">
          <div class="admin-row-info">${escapeHtml(m.name)} ${m.featured ? '<span class="featured-star">featured</span>' : ''}</div>
          <div class="admin-row-actions">
            <button class="btn btn-ghost small" data-toggle-feature="${m.id}" data-current="${m.featured ? '1' : '0'}">
              ${m.featured ? 'Unfeature' : 'Feature'}
            </button>
            <button class="btn btn-ghost small" data-delete="${m.id}">Delete</button>
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
    adminApprovedList.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteMod(btn.dataset.delete));
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
    window.alert(`Could not update that mod: ${err.message}`);
  }
}

async function deleteMod(modId) {
  if (!window.confirm('Delete this mod for good? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'mods', modId));
    loadAdmin();
    loadMods();
  } catch (err) {
    window.alert(`Could not delete that mod: ${err.message}`);
  }
}

// GitHub mod.json scanner.
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

// GitHub base64 encodes file contents with line breaks mixed in, so this
// strips those and decodes it properly as UTF 8, otherwise descriptions
// with accented letters or emoji come out broken.
function base64ToUtf8(b64) {
  const clean = b64.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

async function scanAndSubmitMod(repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw new Error("That doesn't look like a github.com repository link");
  const { owner, repo } = parsed;
  const user = auth.currentUser;

  // Ownership check. The repo's real owner has to match the GitHub
  // account currently signed in, so nobody can index someone else's mod
  // under their own name.
  const userDocSnap = await getDoc(doc(db, 'users', user.uid));
  const githubUsername = userDocSnap.exists() ? userDocSnap.data().githubUsername : null;

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!repoRes.ok) throw new Error(`Repo ${owner}/${repo} was not found, it needs to be public`);
  const repoData = await repoRes.json();
  const actualOwner = repoData.owner?.login || owner;

  if (!githubUsername || actualOwner.toLowerCase() !== githubUsername.toLowerCase()) {
    throw new Error(
      `This repo belongs to "${actualOwner}", but you are logged in as "${githubUsername || 'unknown'}". You can only submit mods from your own repos.`
    );
  }

  // mod.json from the repo root. api.github.com allows this kind of
  // request from a browser, the release download links used below do
  // not, which is why we read the manifest here instead of opening the
  // .geode file itself.
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/mod.json`);
  if (!metaRes.ok) {
    throw new Error(`Could not find mod.json at the root of ${owner}/${repo}`);
  }
  const metaJson = await metaRes.json();
  const modJson = JSON.parse(base64ToUtf8(metaJson.content));

  const developer =
    modJson.developer ||
    (Array.isArray(modJson.developers) ? modJson.developers.join(', ') : '') ||
    'Unknown';
  const tags = Array.isArray(modJson.tags) ? modJson.tags : [];
  const platforms = modJson.gd && typeof modJson.gd === 'object' ? Object.keys(modJson.gd) : [];

  // Latest release, so we can find the actual .geode file to link to.
  const releaseRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
  if (!releaseRes.ok) {
    throw new Error(`${owner}/${repo} does not have any releases yet. Publish one with a .geode file attached first.`);
  }
  const release = await releaseRes.json();
  const asset = (release.assets || []).find((a) => a.name.endsWith('.geode'));
  if (!asset) {
    throw new Error('The latest release does not have a .geode file attached to it.');
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
  submitStatus.textContent = 'Scanning repo...';
  try {
    const name = await scanAndSubmitMod(input.value);
    input.value = '';
    submitStatus.textContent = `Submitted "${name}". It is pending review now.`;
    loadMyMods();
  } catch (err) {
    submitStatus.textContent = `Error: ${err.message}`;
  }
});

loadMods();