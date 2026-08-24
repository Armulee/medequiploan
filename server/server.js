// Local / VPS entrypoint: `npm start` runs this. On Vercel, api/index.js
// requires server/app.js directly instead (no app.listen there — Vercel's
// runtime handles the request lifecycle itself).
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ระบบยืม-คืนกายอุปกรณ์การแพทย์ กำลังทำงานที่ http://localhost:${PORT}`);
});
