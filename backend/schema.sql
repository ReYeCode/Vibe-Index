-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).

-- Users table: one row per GitHub account that has ever logged in
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  github_id BIGINT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mods table: one row per submitted mod
CREATE TABLE IF NOT EXISTS mods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  download_url TEXT NOT NULL,
  repo_url TEXT,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mods_author ON mods(author_id);
CREATE INDEX IF NOT EXISTS idx_mods_created_at ON mods(created_at DESC);
