// Simple JSON-file "database" with in-process write queue (per-file mutex)
// so concurrent requests never interleave writes and corrupt a file.
const fs = require('fs');
const path = require('path');

// Vercel (and most serverless platforms) ship a read-only filesystem for the
// deployed project — only /tmp is writable, and it's wiped on every cold
// start. Detect that and redirect writes there instead of crashing.
// Locally / on a VPS this stays the real project data/ folder, unchanged.
const DATA_DIR = process.env.VERCEL
  ? '/tmp/medequip-data'
  : path.join(__dirname, '..', '..', 'data');

const queues = new Map(); // filename -> Promise chain

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function ensureFile(name, defaultValue) {
  const p = filePath(name);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

function readRaw(name) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeRaw(name, data) {
  const p = filePath(name);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, p); // atomic on same filesystem
}

// Queue every read-modify-write against a file so two simultaneous
// requests (e.g. two borrow actions) can't race and clobber each other.
function enqueue(name, task) {
  const prev = queues.get(name) || Promise.resolve();
  const next = prev.then(task, task);
  queues.set(name, next.catch(() => {}));
  return next;
}

const db = {
  read(name) {
    return enqueue(name, async () => readRaw(name));
  },
  write(name, data) {
    return enqueue(name, async () => {
      writeRaw(name, data);
      return data;
    });
  },
  // Read-modify-write helper: fn receives current array, returns new array
  update(name, fn) {
    return enqueue(name, async () => {
      const current = readRaw(name);
      const next = fn(current);
      writeRaw(name, next);
      return next;
    });
  },
  nextId(records, prefix) {
    const nums = records
      .map((r) => {
        const idField = Object.keys(r).find((k) => k.endsWith('_id'));
        const val = idField ? String(r[idField]) : '';
        const m = val.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => !Number.isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  },
};

module.exports = { db, ensureFile, DATA_DIR };
