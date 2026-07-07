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
    this.closeBtn = document.getElementById('closePreviewBtn');
    this.pipExitArea = document.getElementById('pipExitArea');

    this.pipExitArea.addEventListener('click', (e) => {
      this.exitFullPreview();
    });

    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exitFullPreview();
    });

    this.fullPreviewOverlay.addEventListener('click', (e) => {
      if (e.target === this.fullPreviewOverlay) {
        this.exitFullPreview();
      }
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

    this.fullPreviewOverlay.classList.add('active');

    const container = document.getElementById('fullPreviewInner');
    const noStream = document.getElementById('noStreamMsg');

    if (camera.rtspUrl) {
      noStream.style.display = 'none';
      this.fullCanvas.style.display = 'block';
      this.fullCanvas.width = container.clientWidth;
      this.fullCanvas.height = container.clientHeight;

      this.startFullStream(camera);
    } else {
      this.fullCanvas.style.display = 'none';
      noStream.style.display = 'block';
    }
  }

  exitFullPreview() {
    document.body.classList.remove('pip-mode');
    this.fullPreviewOverlay.classList.remove('active');
    document.getElementById('noStreamMsg').style.display = 'none';

    if (this.fullPlayer) {
      this.destroyPlayer(this.fullPlayer);
      this.fullPlayer = null;
    }

    if (window.cameraManager) {
      window.cameraManager.deselect();
    }
  }

  startHoverStream(camera) {
    if (!camera.rtspUrl) {
      this.drawPlaceholder(this.hoverCanvas, 'No stream');
      return;
    }

    try {
      const wsUrl = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/stream/' + camera.id;
      loadPlayer({
        url: wsUrl,
        canvas: this.hoverCanvas,
        audio: false,
        videoBufferSize: 512 * 1024,
      }).then((player) => {
        this.hoverPlayer = player;
      }).catch(() => {});
    } catch (e) {}
  }

  startFullStream(camera) {
    if (!camera.rtspUrl) return;

    try {
      const wsUrl = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/stream/' + camera.id;
      loadPlayer({
        url: wsUrl,
        canvas: this.fullCanvas,
        audio: false,
        videoBufferSize: 1024 * 1024,
      }).then((player) => {
        if (this.fullPlayer) this.destroyPlayer(this.fullPlayer);
        this.fullPlayer = player;
      }).catch(() => {});
    } catch (e) {}
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
