const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const server = require('http').createServer(app);
const router = express.Router();

// ── Environment config ────────────────────────────────────────────────────────
const FRIGATE_URL         = process.env.FRIGATE_URL         || 'http://localhost:5000';
const GO2RTC_INTERNAL_URL = process.env.GO2RTC_INTERNAL_URL || 'http://localhost:1984';
// This is the URL the BROWSER uses to reach go2rtc (must be accessible from client)
const GO2RTC_PUBLIC_URL   = process.env.GO2RTC_PUBLIC_URL   || 'http://localhost:1984';
const PORT                = process.env.PORT                || 3000;

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static files ──────────────────────────────────────────────────────────────
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// ── Load cameras config ───────────────────────────────────────────────────────
let cameras = [];
const CAMERAS_FILE = path.join(__dirname, 'cameras.json');
try {
  const raw = fs.readFileSync(CAMERAS_FILE, 'utf-8');
  cameras = JSON.parse(raw);
  console.log(`Loaded ${cameras.length} camera(s) from cameras.json`);
} catch (e) {
  console.warn('No cameras.json found, using empty config');
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.render('index', { cameras, frigateUrl: FRIGATE_URL });
});

router.get('/api/cameras', (req, res) => res.json(cameras));

router.post('/api/cameras', express.json(), (req, res) => {
  try {
    cameras = req.body;
    fs.writeFileSync(CAMERAS_FILE, JSON.stringify(cameras, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save cameras' });
  }
});

// Return direct go2rtc HLS URL for the browser to use
// Browser hits go2rtc directly on port 1984 — no proxy needed
router.get('/api/stream-url/:id', (req, res) => {
  const cam = cameras.find(c => c.id === req.params.id);
  if (!cam) return res.status(404).json({ error: 'Camera not found' });

  res.json({
    id:  cam.id,
    // Direct go2rtc HLS URL — browser accesses this directly
    hls: `${GO2RTC_PUBLIC_URL}/api/stream.m3u8?src=${cam.id}`,
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
router.use((req, res) => {
  console.log(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

app.use('/', router);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Frigate URL:         ${FRIGATE_URL}`);
  console.log(`go2rtc Internal URL: ${GO2RTC_INTERNAL_URL}`);
  console.log(`go2rtc Public URL:   ${GO2RTC_PUBLIC_URL}`);
});