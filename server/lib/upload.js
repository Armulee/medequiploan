const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// See db.js: Vercel's project filesystem is read-only, so uploads have to
// land in /tmp there. They will NOT survive a cold start or be visible to a
// different concurrent instance — fine for a UI preview, not for real
// patient ID/health photos. The VPS deployment path keeps real persistence.
const UPLOAD_ROOT = process.env.VERCEL
  ? '/tmp/medequip-uploads'
  : path.join(__dirname, '..', '..', 'uploads');

['id_cards', 'illness_photos'].forEach((sub) => {
  fs.mkdirSync(path.join(UPLOAD_ROOT, sub), { recursive: true });
});

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function storageFor(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_ROOT, subfolder)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const name = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, name);
    },
  });
}

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  cb(new Error('รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp, heic)'));
}

const idCardUpload = multer({
  storage: storageFor('id_cards'),
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

const illnessPhotoUpload = multer({
  storage: storageFor('illness_photos'),
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

module.exports = { idCardUpload, illnessPhotoUpload, UPLOAD_ROOT };
