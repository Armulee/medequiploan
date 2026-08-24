require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

const { ensureFile } = require('./lib/db');
const { seedIfEmpty } = require('./seed');
const { requireAuth } = require('./middleware/auth');
const { UPLOAD_ROOT } = require('./lib/upload');

// Make sure data files exist even on a totally fresh checkout / cold start.
['borrowers', 'equipment', 'records', 'requests', 'users', 'audit_log'].forEach((f) => ensureFile(f, []));

// On serverless (Vercel), each cold start gets a fresh /tmp — reseed demo
// data automatically so the deployed preview works without a manual step.
// Locally / on a VPS this only seeds once (seed.js already ran at setup).
seedIfEmpty().catch((e) => console.error('Seed check failed:', e));

const authRoutes = require('./routes/auth');
const borrowerRoutes = require('./routes/borrowers');
const equipmentRoutes = require('./routes/equipment');
const recordRoutes = require('./routes/records');
const requestRoutes = require('./routes/requests');
const auditRoutes = require('./routes/audit');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie-based session (payload signed and stored client-side) instead of an
// in-memory store — works identically on a long-running VPS process and on
// stateless serverless functions, where a plain in-memory session store
// would silently lose logins between invocations.
app.use(
  cookieSession({
    name: 'medequip.sid',
    keys: [process.env.SESSION_SECRET || 'dev-secret-change-me-in-.env'],
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && (process.env.TRUST_PROXY === '1' || !!process.env.VERCEL),
  })
);

// Uploaded photos are PII / health data — only logged-in staff can view them.
app.use('/uploads', requireAuth, express.static(UPLOAD_ROOT));

app.use('/api/auth', authRoutes);
app.use('/api/borrowers', borrowerRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/audit-log', auditRoutes);

// Frontend (static, public — no PII lives in these files)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Basic error handler so a thrown error returns JSON instead of hanging/crashing.
app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.message && err.message.includes('รองรับเฉพาะไฟล์รูปภาพ')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ (server error)' });
});

module.exports = app;
