class CanvasEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    this.state = {
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      minZoom: 0.15,
      maxZoom: 8,
    };

    this.dragState = { active: false, type: 'none', startMouseX: 0, startMouseY: 0, startOffsetX: 0, startOffsetY: 0, cameraId: null };
    this.clickCandidate = false;

    this.cameraManager = null;
    this.previewManager = null;
    this.planImage = null;
    this.imageLoaded = false;

    this.animFrameId = null;

    this.resize();
    this.bindEvents();
    this.startRenderLoop();
  }

  bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  screenToCanvas(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (screenX - rect.left) * (this.canvas.width / rect.width);
    const py = (screenY - rect.top) * (this.canvas.height / rect.height);
    return {
      x: (px - this.state.offsetX) / this.state.zoom,
      y: (py - this.state.offsetY) / this.state.zoom,
    };
  }

  canvasToScreen(worldX, worldY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = worldX * this.state.zoom + this.state.offsetX;
    const py = worldY * this.state.zoom + this.state.offsetY;
    return {
      x: px / (this.canvas.width / rect.width) + rect.left,
      y: py / (this.canvas.height / rect.height) + rect.top,
    };
  }

  onMouseDown(e) {
    const pos = this.screenToCanvas(e.clientX, e.clientY);

    if (this.cameraManager) {
      const handleHit = this.cameraManager.hitTestHandle(pos.x, pos.y);
      if (handleHit) {
        this.dragState = { active: true, type: handleHit.type, startMouseX: e.clientX, startMouseY: e.clientY, cameraId: handleHit.cameraId };
        this.clickCandidate = false;
        return;
      }

      const iconHit = this.cameraManager.hitTestIcon(pos.x, pos.y);
      if (iconHit) {
        this.cameraManager.select(iconHit.id);
        this.dragState = { active: true, type: 'icon-move', startMouseX: e.clientX, startMouseY: e.clientY, cameraId: iconHit.id };
        this.clickCandidate = true;
        return;
      }
    }

    if (this.cameraManager) this.cameraManager.deselect();
    if (this.previewManager) this.previewManager.hideHoverPreview();

    this.dragState = { active: true, type: 'pan', startMouseX: e.clientX, startMouseY: e.clientY, startOffsetX: this.state.offsetX, startOffsetY: this.state.offsetY };
    this.clickCandidate = false;
  }

  onMouseMove(e) {
    if (!this.dragState.active) {
      const pos = this.screenToCanvas(e.clientX, e.clientY);
      if (this.cameraManager) {
        const hit = this.cameraManager.hitTestIcon(pos.x, pos.y);
        if (hit && this.previewManager) {
          this.previewManager.showHoverPreview(hit, e.clientX, e.clientY);
        } else if (this.previewManager) {
          this.previewManager.hideHoverPreview();
        }
      }
      return;
    }

    const dx = e.clientX - this.dragState.startMouseX;
    const dy = e.clientY - this.dragState.startMouseY;

    if (this.clickCandidate && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      this.clickCandidate = false;
    }

    switch (this.dragState.type) {
      case 'pan':
        this.state.offsetX = this.dragState.startOffsetX + dx;
        this.state.offsetY = this.dragState.startOffsetY + dy;
        break;

      case 'icon-move':
        if (this.cameraManager) {
          this.dragState.startMouseX = e.clientX;
          this.dragState.startMouseY = e.clientY;
          this.cameraManager.moveCamera(this.dragState.cameraId, dx / this.state.zoom, dy / this.state.zoom);
        }
        break;

      case 'cone-length':
        if (this.cameraManager) {
          const pos = this.screenToCanvas(e.clientX, e.clientY);
          this.cameraManager.updateConeLength(this.dragState.cameraId, pos.x, pos.y);
        }
        break;

      case 'cone-width':
        if (this.cameraManager) {
          const pos = this.screenToCanvas(e.clientX, e.clientY);
          this.cameraManager.updateConeWidth(this.dragState.cameraId, pos.x, pos.y);
        }
        break;

      case 'rotate':
        if (this.cameraManager) {
          const pos = this.screenToCanvas(e.clientX, e.clientY);
          this.cameraManager.updateAngle(this.dragState.cameraId, pos.x, pos.y);
        }
        break;
    }
  }

  onMouseUp(e) {
    if (!this.dragState.active) return;

    if (this.clickCandidate && this.dragState.type === 'icon-move' && this.cameraManager) {
      this.clickCandidate = false;
      const cam = this.cameraManager.getCamera(this.dragState.cameraId);
      if (cam) {
        this.cameraManager.select(cam.id);
        if (this.previewManager) {
          this.previewManager.enterFullPreview(cam);
        }
      }
    }

    this.dragState.active = false;
    if (this.cameraManager) this.cameraManager.saveDebounced();
  }

  onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;

    const rect = this.canvas.getBoundingClientRect();
    const cssScaleX = this.canvas.width / rect.width;
    const cssScaleY = this.canvas.height / rect.height;

    const px = (e.clientX - rect.left) * cssScaleX;
    const py = (e.clientY - rect.top) * cssScaleY;

    const worldX = (px - this.state.offsetX) / this.state.zoom;
    const worldY = (py - this.state.offsetY) / this.state.zoom;

    this.state.zoom = Math.min(Math.max(this.state.zoom * factor, this.state.minZoom), this.state.maxZoom);

    this.state.offsetX = px - worldX * this.state.zoom;
    this.state.offsetY = py - worldY * this.state.zoom;
  }

  exitFullPreview() {
    if (this.previewManager) {
      this.previewManager.exitFullPreview();
    }
  }

  startRenderLoop() {
    const loop = (time) => {
      this.render(time);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  render(time) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.state.offsetX, this.state.offsetY);
    ctx.scale(this.state.zoom, this.state.zoom);

    if (this.imageLoaded && this.planImage) {
      ctx.drawImage(this.planImage, 0, 0);
    } else {
      this.drawGrid(ctx);
    }

    if (this.cameraManager) {
      this.cameraManager.renderCones(ctx);
      this.cameraManager.renderIcons(ctx, time);
      this.cameraManager.renderHandles(ctx);
    }

    ctx.restore();

    if (this.imageLoaded && this.planImage) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(Math.round(this.state.zoom * 100) + '%', 10, 10);
    }
  }

  drawGrid(ctx) {
    const size = 60;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 2000; x += size) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2000); ctx.stroke();
    }
    for (let y = 0; y <= 2000; y += size) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2000, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Building Plan', 1000, 980);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillText('Place plan.png in the /images folder', 1000, 1005);
  }

  loadPlanImage(src) {
    const img = new Image();
    img.onload = () => {
      this.planImage = img;
      this.imageLoaded = true;
      this.fitToContent();
    };
    img.onerror = () => {
      this.imageLoaded = false;
    };
    img.src = src;
  }

  fitToContent() {
    if (this.imageLoaded && this.planImage) {
      const iw = this.planImage.width;
      const ih = this.planImage.height;
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const s = Math.min(cw / iw, ch / ih) * 0.9;
      this.state.zoom = s;
      this.state.offsetX = (cw - iw * s) / 2;
      this.state.offsetY = (ch - ih * s) / 2;
    }
  }
}
