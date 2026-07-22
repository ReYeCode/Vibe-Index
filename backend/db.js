const { Pool } = require('pg');

// IMPORTANT: DATABASE_URL should be Supabase's "Session pooler" connection
// string (aws-0-<region>.pooler.supabase.com:5432), not the direct
// "db.<ref>.supabase.co:5432" string. The direct string only resolves over
// IPv6, and most free hosts (Render included) can't route IPv6 outbound, so
// the direct string will hang or fail to connect. See the README for where
// to copy this from in the Supabase dashboard.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
