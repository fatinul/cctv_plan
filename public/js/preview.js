class PreviewManager {
  constructor() {
    this.hoverTimer = null;
    this.hoverCamera = null;
    this.fullPlayer = null;

    this.hoverPreview = document.getElementById('hoverPreview');
    this.fullCanvas = document.getElementById('fullCanvas');
    this.fullPreviewOverlay = document.getElementById('fullPreviewOverlay');
    this.fullPreviewInner = document.getElementById('fullPreviewInner');
    this.fullPreviewTitle = document.getElementById('fullPreviewTitle');
    this.streamStatus = document.getElementById('streamStatus');
    this.closeBtn = document.getElementById('closePreviewBtn');
    this.pipExitArea = document.getElementById('pipExitArea');
    this.noStreamMsg = document.getElementById('noStreamMsg');

    this.detailsUpdateTimer = null;
    this.detailsCameraId = null;

    // Replace hoverCanvas with an iframe container
    var hoverCanvas = document.getElementById('hoverCanvas');
    if (hoverCanvas) {
      this.hoverIframeContainer = document.createElement('div');
      this.hoverIframeContainer.style.cssText = 'width:240px;height:180px;background:#000;overflow:hidden;border-radius:4px;';
      hoverCanvas.parentNode.replaceChild(this.hoverIframeContainer, hoverCanvas);
    }

    // Hide fullCanvas — we use iframe instead
    if (this.fullCanvas) this.fullCanvas.style.display = 'none';

    this.pipExitArea.addEventListener('click', () => this.exitFullPreview());
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

  // ── go2rtc URL helper ───────────────────────────────────────────────────────
  getStreamUrl(cameraId, width, height) {
    var base = window.__GO2RTC_URL__ || 'http://localhost:1984';
    var url = base + '/stream.html?src=' + encodeURIComponent(cameraId) + '&mode=webrtc,mse,hls,mjpeg';
    if (width) url += '&width=' + width;
    return url;
  }

  // ── Hover preview ───────────────────────────────────────────────────────────
  showHoverPreview(camera, mouseX, mouseY) {
    if (this.hoverCamera && this.hoverCamera.id === camera.id) return;
    this.hideHoverPreview();
    this.hoverCamera = camera;

    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;

      // Position the preview box
      let x = mouseX + 16;
      let y = mouseY + 16;
      if (x + 220 > window.innerWidth) x = mouseX - 220;
      if (y + 170 > window.innerHeight) y = mouseY - 170;

      this.hoverPreview.style.left = x + 'px';
      this.hoverPreview.style.top = y + 'px';
      this.hoverPreview.style.display = 'block';

      // Load stream in hover iframe
      if (this.hoverIframeContainer) {
        this.hoverIframeContainer.innerHTML = '';
        if (camera.rtspUrl) {
          var iframe = document.createElement('iframe');
          iframe.src = this.getStreamUrl(camera.id, 200);
          iframe.style.cssText = 'width:240px;height:180px;border:none;display:block;';
          iframe.allow = 'autoplay';
          this.hoverIframeContainer.appendChild(iframe);
        } else {
          this.hoverIframeContainer.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:11px;text-align:center;padding-top:60px;">No stream</div>';
        }
      }
    }, 500);
  }

  hideHoverPreview() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.hoverCamera = null;
    this.hoverPreview.style.display = 'none';

    // Stop hover stream
    if (this.hoverIframeContainer) {
      var iframe = this.hoverIframeContainer.querySelector('iframe');
      if (iframe) iframe.src = '';
      this.hoverIframeContainer.innerHTML = '';
    }
  }

  // ── Full preview ────────────────────────────────────────────────────────────
  enterFullPreview(camera) {
    this.hideHoverPreview();
    this.destroyPlayer(this.fullPlayer);
    this.fullPlayer = null;

    document.body.classList.add('pip-mode');
    this.fullPreviewTitle.textContent = camera.name;
    this.fullPreviewOverlay.classList.add('active');

    // Hide canvas and noStreamMsg initially
    if (this.fullCanvas) this.fullCanvas.style.display = 'none';
    this.noStreamMsg.style.display = 'none';

    if (camera.rtspUrl) {
      this.setStreamStatus('connecting');
      this.startFullStream(camera);
    } else {
      this.noStreamMsg.style.display = 'block';
      this.setStreamStatus('none');
    }
  }

  exitFullPreview() {
    document.body.classList.remove('pip-mode');
    this.fullPreviewOverlay.classList.remove('active');
    this.noStreamMsg.style.display = 'none';
    this.setStreamStatus('');

    this.destroyPlayer(this.fullPlayer);
    this.fullPlayer = null;

    if (window.cameraManager) window.cameraManager.deselect();
  }

  startFullStream(camera) {
    // Remove any existing iframe
    var existing = this.fullPreviewInner.querySelector('iframe');
    if (existing) {
      existing.src = '';
      existing.parentNode.removeChild(existing);
    }

    var self = this;
    var iframe = document.createElement('iframe');
    iframe.src = this.getStreamUrl(camera.id);
    iframe.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'border:none',
      'background:#000',
      'z-index:1',
    ].join(';');
    iframe.allow = 'autoplay; fullscreen';
    iframe.setAttribute('allowfullscreen', '');

    iframe.onload = function () {
      self.setStreamStatus('connected');
    };

    // Make fullPreviewInner position:relative so iframe fills it
    this.fullPreviewInner.style.position = 'relative';
    this.fullPreviewInner.appendChild(iframe);

    this.fullPlayer = { type: 'iframe', iframe: iframe };
  }

  destroyPlayer(player) {
    if (!player) return;
    if (player.type === 'iframe' && player.iframe) {
      player.iframe.src = '';
      if (player.iframe.parentNode) player.iframe.parentNode.removeChild(player.iframe);
    }
  }

  setStreamStatus(state) {
    var el = this.streamStatus;
    if (!el) return;
    el.className = 'status-' + state;
    var texts = { connecting: 'Connecting...', connected: 'Live', error: 'Stream error', none: '' };
    el.textContent = texts[state] || '';
  }

  // ── Camera details panel ────────────────────────────────────────────────────
  showCameraDetails(camera) {
    var body = document.getElementById('cameraDetailsBody');
    var panel = document.getElementById('cameraDetails');
    if (!body || !panel) return;

    var rtspBlock = '';
    if (camera.rtspUrl) {
      rtspBlock =
        '<div class="detail-group">' +
          '<div class="detail-group-title">Stream</div>' +
          '<div class="detail-row">' +
            '<span class="detail-label">RTSP</span>' +
            '<span class="detail-value" id="detail-rtsp" style="font-size:11px">' + this.esc(camera.rtspUrl) + '</span>' +
          '</div>' +
        '</div>';
    }

    body.innerHTML =
      '<div class="detail-group">' +
        '<div class="detail-group-title">Camera</div>' +
        '<div class="detail-row"><span class="detail-label">Name</span><span class="detail-value" id="detail-name">' + this.esc(camera.name) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">ID</span><span class="detail-value" id="detail-id">' + this.esc(camera.id) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Status</span><span class="detail-value" id="detail-status">Offline</span></div>' +
      '</div>' +
      '<div class="detail-group">' +
        '<div class="detail-group-title">Position</div>' +
        '<div class="detail-row"><span class="detail-label">X</span><span class="detail-value" id="detail-pos-x">-</span></div>' +
        '<div class="detail-row"><span class="detail-label">Y</span><span class="detail-value" id="detail-pos-y">-</span></div>' +
      '</div>' +
      '<div class="detail-group">' +
        '<div class="detail-group-title">Field of View</div>' +
        '<div class="detail-row"><span class="detail-label">Angle</span><span class="detail-value" id="detail-angle">-</span></div>' +
        '<div class="detail-row"><span class="detail-label">Cone Width</span><span class="detail-value" id="detail-cone-w">-</span></div>' +
        '<div class="detail-row"><span class="detail-label">Cone Length</span><span class="detail-value" id="detail-cone-l">-</span></div>' +
      '</div>' + rtspBlock;

    panel.classList.add('active');
    this.startDetailsUpdates(camera.id);
  }

  hideCameraDetails() {
    this.stopDetailsUpdates();
    var panel = document.getElementById('cameraDetails');
    if (panel) panel.classList.remove('active');
    if (window.cameraManager) window.cameraManager.deselect();
  }

  startDetailsUpdates(cameraId) {
    this.stopDetailsUpdates();
    this.detailsCameraId = cameraId;
    this.updateCameraDetails();
    this.detailsUpdateTimer = setInterval(() => this.updateCameraDetails(), 100);
  }

  stopDetailsUpdates() {
    if (this.detailsUpdateTimer) {
      clearInterval(this.detailsUpdateTimer);
      this.detailsUpdateTimer = null;
    }
    this.detailsCameraId = null;
  }

  updateCameraDetails() {
    if (!this.detailsCameraId || !window.cameraManager) return;
    var cam = window.cameraManager.getCamera(this.detailsCameraId);
    if (!cam) return;

    var el = (id) => document.getElementById(id);

    var statusEl = el('detail-status');
    if (statusEl) {
      statusEl.textContent = cam.rtspUrl ? 'Online' : 'Offline';
      statusEl.className = 'detail-value ' + (cam.rtspUrl ? 'status-online' : 'status-offline');
    }

    var xEl = el('detail-pos-x'); if (xEl) xEl.textContent = Math.round(cam.x);
    var yEl = el('detail-pos-y'); if (yEl) yEl.textContent = Math.round(cam.y);
    var aEl = el('detail-angle'); if (aEl) aEl.textContent = Math.round(cam.angle) + '\u00B0';
    var cwEl = el('detail-cone-w'); if (cwEl) cwEl.textContent = Math.round(cam.coneWidth) + '\u00B0';
    var clEl = el('detail-cone-l'); if (clEl) clEl.textContent = Math.round(cam.coneLength) + 'px';
    var rtspEl = el('detail-rtsp'); if (rtspEl && cam.rtspUrl) rtspEl.textContent = cam.rtspUrl;
  }

  esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
} 