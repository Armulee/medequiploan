// Single Vercel serverless function handling every request (see vercel.json
// rewrite). Exporting the Express app directly works because Express apps
// are valid (req, res) request handlers, which is what Vercel's Node.js
// runtime expects.
module.exports = require('../server/app');
