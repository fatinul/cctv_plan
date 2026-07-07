class PreviewManager {
  constructor() {
    this.hoverTimer = null;
    this.hoverCamera = null;
    this.hoverPlayer = null;
    this.fullPlayer = null;

    this.hoverCanvas = document.getElementById('hoverCanvas');
    this.hoverPreview = document.getElementById('hoverPreview');
    this.fullCanvas = document.getElementById('fullCanvas');
    this.fullPreviewOverlay = document.getElementById('fullPreviewOverlay');
    this.fullPreviewTitle = document.getElementById('fullPreviewTitle');
    this.streamStatus = document.getElementById('streamStatus');
    this.closeBtn = document.getElementById('closePreviewBtn');
    this.pipExitArea = document.getElementById('pipExitArea');
    this.noStreamMsg = document.getElementById('noStreamMsg');

    this.pipExitArea.addEventListener('click', (e) => this.exitFullPreview());
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exitFullPreview();
    });

    var detailsCloseBtn = document.getElementById('detailsCloseBtn');
    if (detailsCloseBtn) {
      detailsCloseBtn.addEventListener('click', () => this.hideCameraDetails());
    }

    this.fullPreviewOverlay.addEventListener('click', (e) => {
      if (e.target === this.fullPreviewOverlay) this.exitFullPreview();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.exitFullPreview();
    });
  }

  showHoverPreview(camera, mouseX, mouseY) {
    if (this.hoverCamera && this.hoverCamera.id === camera.id) return;
    this.hideHoverPreview();
    this.hoverCamera = camera;

    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;

      let x = mouseX + 16;
      let y = mouseY + 16;
      if (x + 250 > window.innerWidth) x = mouseX - 250;
      if (y + 190 > window.innerHeight) y = mouseY - 190;

      this.hoverPreview.style.left = x + 'px';
      this.hoverPreview.style.top = y + 'px';
      this.hoverPreview.style.display = 'block';

      this.startHoverStream(camera);
    }, 300);
  }

  hideHoverPreview() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.hoverCamera = null;
    this.hoverPreview.style.display = 'none';
    this.destroyPlayer(this.hoverPlayer);
    this.hoverPlayer = null;
  }

  enterFullPreview(camera) {
    this.hideHoverPreview();

    if (this.fullPlayer) {
      this.destroyPlayer(this.fullPlayer);
      this.fullPlayer = null;
    }

    document.body.classList.add('pip-mode');
    this.fullPreviewTitle.textContent = camera.name;
    this.setStreamStatus('connecting');
    this.fullPreviewOverlay.classList.add('active');

    const container = document.getElementById('fullPreviewInner');

    if (camera.rtspUrl) {
      this.noStreamMsg.style.display = 'none';
      this.fullCanvas.style.display = 'block';
      this.fullCanvas.width = container.clientWidth;
      this.fullCanvas.height = container.clientHeight;

      this.startFullStream(camera);
    } else {
      this.fullCanvas.style.display = 'none';
      this.noStreamMsg.style.display = 'block';
      this.setStreamStatus('none');
    }
  }

  exitFullPreview() {
    document.body.classList.remove('pip-mode');
    this.fullPreviewOverlay.classList.remove('active');
    this.noStreamMsg.style.display = 'none';
    this.setStreamStatus('');

    if (this.fullPlayer) {
      this.destroyPlayer(this.fullPlayer);
      this.fullPlayer = null;
    }

    if (window.cameraManager) {
      window.cameraManager.deselect();
    }
  }

  setStreamStatus(state) {
    var el = this.streamStatus;
    if (!el) return;
    el.className = 'status-' + state;
    var texts = { connecting: 'Connecting...', connected: 'Live', error: 'Stream error', none: '' };
    el.textContent = texts[state] || '';
  }

  createPlayer(url, canvas) {
    return new Promise(function (resolve, reject) {
      if (typeof loadPlayer === 'function') {
        loadPlayer({ url: url, canvas: canvas, audio: false, videoBufferSize: 1024 * 1024 })
          .then(resolve)
          .catch(reject);
      } else if (typeof JSMpeg !== 'undefined' && JSMpeg && JSMpeg.Player) {
        var player = new JSMpeg.Player(url, {
          canvas: canvas,
          audio: false,
          videoBufferSize: 1024 * 1024,
          onSourceEstablished: function () { resolve(player); },
          onError: function () { reject(new Error('JSMpeg connection error')); },
        });
      } else {
        reject(new Error('Streaming library not available (JSMpeg/loadPlayer)'));
      }
    });
  }

  startHoverStream(camera) {
    if (!camera.rtspUrl) {
      this.drawPlaceholder(this.hoverCanvas, 'No stream');
      return;
    }

    var wsUrl = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/stream/' + camera.id;
    var self = this;

    this.createPlayer(wsUrl, this.hoverCanvas).then(function (player) {
      self.hoverPlayer = player;
    }).catch(function () {
      self.drawPlaceholder(self.hoverCanvas, 'Stream unavailable');
    });
  }

  startFullStream(camera) {
    if (!camera.rtspUrl) return;

    var wsUrl = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/stream/' + camera.id;
    var self = this;

    this.createPlayer(wsUrl, this.fullCanvas).then(function (player) {
      if (self.fullPlayer) self.destroyPlayer(self.fullPlayer);
      self.fullPlayer = player;
      self.setStreamStatus('connected');
    }).catch(function (err) {
      self.setStreamStatus('error');
    });
  }

  destroyPlayer(player) {
    if (!player) return;
    try {
      if (player.source && typeof player.source.destroy === 'function') {
        player.source.destroy();
      }
      if (typeof player.destroy === 'function') {
        player.destroy();
      } else if (typeof player.stop === 'function') {
        player.stop();
      }
    } catch (e) {}
  }

  showCameraDetails(camera) {
    var body = document.getElementById('cameraDetailsBody');
    var panel = document.getElementById('cameraDetails');
    if (!body || !panel) return;

    var statusClass = 'status-offline';
    var statusText = 'Offline';
    if (camera.rtspUrl) {
      statusClass = 'status-online';
      statusText = 'Online';
    }

    body.innerHTML =
      '<div class="detail-group">' +
        '<div class="detail-group-title">Camera</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">Name</span>' +
          '<span class="detail-value">' + this.esc(camera.name) + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">ID</span>' +
          '<span class="detail-value">' + this.esc(camera.id) + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">Status</span>' +
          '<span class="detail-value ' + statusClass + '">' + statusText + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="detail-group">' +
        '<div class="detail-group-title">Position</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">X</span>' +
          '<span class="detail-value">' + Math.round(camera.x) + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">Y</span>' +
          '<span class="detail-value">' + Math.round(camera.y) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="detail-group">' +
        '<div class="detail-group-title">Field of View</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">Angle</span>' +
          '<span class="detail-value">' + Math.round(camera.angle) + '&deg;</span>' +
        '</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">Cone Width</span>' +
          '<span class="detail-value">' + Math.round(camera.coneWidth) + '&deg;</span>' +
        '</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">Cone Length</span>' +
          '<span class="detail-value">' + Math.round(camera.coneLength) + 'px</span>' +
        '</div>' +
      '</div>';

    if (camera.rtspUrl) {
      body.innerHTML +=
        '<div class="detail-group">' +
          '<div class="detail-group-title">Stream</div>' +
          '<div class="detail-row">' +
            '<span class="detail-label">RTSP</span>' +
            '<span class="detail-value" style="font-size:11px">' + this.esc(camera.rtspUrl) + '</span>' +
          '</div>' +
        '</div>';
    }

    panel.classList.add('active');
  }

  hideCameraDetails() {
    var panel = document.getElementById('cameraDetails');
    if (panel) panel.classList.remove('active');
    if (window.cameraManager) window.cameraManager.deselect();
  }

  esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  drawPlaceholder(canvas, text) {
    try {
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    } catch (e) {}
  }
}
