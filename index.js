const express = require('express');
const path = require('path');
const fs = require('fs');
const relay = require('rtsp-relay');

const app = express();
const server = require('http').createServer(app);

const { proxy, scriptUrl } = relay(app, server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

let cameras = [];
try {
  const raw = fs.readFileSync(path.join(__dirname, 'cameras.json'), 'utf-8');
  cameras = JSON.parse(raw);
} catch (e) {
  console.warn('No cameras.json found, using empty config');
}

app.ws('/stream/:id', (ws, req) => {
  const cam = cameras.find(c => c.id === req.params.id);
  if (!cam) {
    ws.close(1008, 'Camera not found');
    return;
  }
  if (!cam.rtspUrl) {
    ws.close(1008, 'No RTSP URL configured');
    return;
  }
  const handler = proxy({ url: cam.rtspUrl, verbose: false });
  handler(ws, req);
});

app.get('/', (req, res) => {
  res.render('index', { cameras });
});

app.get('/api/cameras', (req, res) => {
  res.json(cameras);
});

app.post('/api/cameras', express.json(), (req, res) => {
  cameras = req.body;
  fs.writeFileSync(
    path.join(__dirname, 'cameras.json'),
    JSON.stringify(cameras, null, 2)
  );
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
