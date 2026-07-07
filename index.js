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

cameras.forEach((cam) => {
  if (cam.rtspUrl) {
    app.ws(`/stream/${cam.id}`, proxy({
      url: cam.rtspUrl,
      verbose: false,
    }));
  }
});

app.get('/', (req, res) => {
  res.render('index', { cameras, scriptUrl });
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
