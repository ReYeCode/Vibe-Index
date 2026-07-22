require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const {
  PORT = 10000,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  FRONTEND_ORIGIN,
  FRONTEND_URL,
  JWT_SECRET,
} = process.env;

// Fail fast if something required is missing, instead of failing weirdly later.
const required = {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  FRONTEND_ORIGIN,
  FRONTEND_URL,
  JWT_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
};
for (const [key, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();

// FRONTEND_ORIGIN must be scheme+host only (e.g. https://username.github.io),
// because that's the exact format browsers send in the `Origin` header.
// It must NOT include a path, even though your site lives at a sub-path.
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// ---------- Health check ----------
// Render's free tier spins the service down after 15 min of inactivity.
// An uptime monitor or the GitHub Actions workflow in this repo can ping
// this endpoint to keep the service (and the Supabase project) awake.
app.get('/health', (req, res) => res.json({ ok: true }));

// ---------- Auth middleware ----------
function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = payload; // { id, githubId, username, avatarUrl }
    next();
  });
}

// ---------- Step 1: kick off GitHub OAuth ----------
// The frontend just redirects the browser here.
app.get('/auth/github', (req, res) => {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: 'read:user user:email',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// ---------- Step 2: GitHub redirects back here with ?code=... ----------
app.get('/auth/github/callback', async (req, res) => {
  const { code, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return res.status(400).send('Missing OAuth code from GitHub.');
  }

  try {
    // Exchange the temporary code for a GitHub access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error('GitHub token exchange failed:', tokenData);
      return res.redirect(`${FRONTEND_URL}/?auth_error=github_token_exchange_failed`);
    }

    // Use the access token to fetch the user's GitHub profile
    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'vibemodded-index',
      },
    });
    const profile = await profileRes.json();

    if (!profileRes.ok || !profile.id) {
      console.error('GitHub profile fetch failed:', profile);
      return res.redirect(`${FRONTEND_URL}/?auth_error=github_profile_fetch_failed`);
    }

    // Upsert the user into Postgres
    const result = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (github_id)
       DO UPDATE SET username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url
       RETURNING id, github_id, username, avatar_url`,
      [profile.id, profile.login, profile.avatar_url]
    );
    const user = result.rows[0];

    // Issue our own short-lived-ish JWT so the static frontend doesn't need
    // server-side sessions or cross-domain cookies.
    const appToken = jwt.sign(
      {
        id: user.id,
        githubId: user.github_id,
        username: user.username,
        avatarUrl: user.avatar_url,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Hand the token back to the static frontend via a redirect + query param.
    res.redirect(`${FRONTEND_URL}/?token=${appToken}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}/?auth_error=server_error`);
  }
});

// ---------- Who am I? ----------
app.get('/api/user', authenticateToken, (req, res) => {
  res.json(req.user);
});

// ---------- Public: list mods ----------
app.get('/api/mods', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mods.id, mods.name, mods.description, mods.version,
              mods.download_url, mods.repo_url, mods.created_at,
              users.username AS author, users.avatar_url AS author_avatar
       FROM mods
       JOIN users ON users.id = mods.author_id
       ORDER BY mods.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to list mods:', err);
    res.status(500).json({ error: 'Failed to load mods' });
  }
});

// ---------- Protected: submit a mod ----------
app.post('/api/mods', authenticateToken, async (req, res) => {
  const { name, description, version, download_url, repo_url } = req.body || {};

  if (!name || !download_url) {
    return res.status(400).json({ error: 'name and download_url are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO mods (name, description, version, download_url, repo_url, author_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description || null, version || null, download_url, repo_url || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to save mod:', err);
    res.status(500).json({ error: 'Failed to save mod' });
  }
});

app.listen(PORT, () => console.log(`Vibemodded Index API running on port ${PORT}`));
