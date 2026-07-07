class CameraManager {
  constructor(cameras, iconImg) {
    this.cameras = cameras || [];
    this.iconImg = iconImg;
    this.selectedCameraId = null;
    this.iconSize = 32;
    this.saveTimer = null;
  }

  getCamera(id) {
    return this.cameras.find(c => c.id === id) || null;
  }

  select(id) {
    this.selectedCameraId = id;
  }

  deselect() {
    this.selectedCameraId = null;
  }

  renderCones(ctx) {
    for (const cam of this.cameras) {
      this.renderCone(ctx, cam);
    }
  }

  renderCone(ctx, cam) {
    const angleRad = cam.angle * Math.PI / 180;
    const halfWidthRad = (cam.coneWidth / 2) * Math.PI / 180;

    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.rotate(angleRad);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, cam.coneLength, -halfWidthRad, halfWidthRad);
    ctx.closePath();

    ctx.fillStyle = cam.color || 'rgba(255, 200, 50, 0.25)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cam.coneLength, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  renderIcons(ctx, time) {
    for (const cam of this.cameras) {
      this.renderIcon(ctx, cam, time);
    }
  }

  renderIcon(ctx, cam, time) {
    const s = this.iconSize;
    const sel = cam.id === this.selectedCameraId;
    const angleRad = cam.angle * Math.PI / 180;

    ctx.save();
    ctx.translate(cam.x, cam.y);

    if (sel) {
      const pulse = 0.7 + Math.sin((time || Date.now()) / 280) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, s / 2 + 7, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 200, 50, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.globalAlpha = pulse;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (this.iconImg && this.iconImg.complete && this.iconImg.naturalWidth > 0) {
      ctx.drawImage(this.iconImg, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = '#444';
      ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      ctx.fillStyle = '#555';
      ctx.fillRect(s / 5, -s / 2.5, s / 3, s / 4);
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(0, 0, s / 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (sel) {
      const hDist = s * 0.7;
      const hx = Math.cos(angleRad) * hDist;
      const hy = Math.sin(angleRad) * hDist;

      ctx.beginPath();
      ctx.moveTo(Math.cos(angleRad) * s / 3, Math.sin(angleRad) * s / 3);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = 'rgba(255,200,50,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc33';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(cam.name, 0, -s / 2 - 6);

    ctx.restore();
  }

  renderHandles(ctx) {
    if (!this.selectedCameraId) return;
    const cam = this.getCamera(this.selectedCameraId);
    if (!cam) return;

    const angleRad = cam.angle * Math.PI / 180;
    const halfWidthRad = (cam.coneWidth / 2) * Math.PI / 180;

    const tipX = cam.x + Math.cos(angleRad) * cam.coneLength;
    const tipY = cam.y + Math.sin(angleRad) * cam.coneLength;

    ctx.save();

    ctx.beginPath();
    ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,200,50,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('L', tipX, tipY + 0.5);

    const wAngle = angleRad + halfWidthRad;
    const wLen = cam.coneLength * 0.82;
    const wX = cam.x + Math.cos(wAngle) * wLen;
    const wY = cam.y + Math.sin(wAngle) * wLen;

    ctx.beginPath();
    ctx.arc(wX, wY, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100,200,255,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('W', wX, wY + 0.5);

    ctx.restore();
  }

  hitTestIcon(worldX, worldY) {
    const threshold = this.iconSize / 2 + 6;
    for (const cam of this.cameras) {
      const dx = worldX - cam.x;
      const dy = worldY - cam.y;
      if (dx * dx + dy * dy < threshold * threshold) {
        return cam;
      }
    }
    return null;
  }

  hitTestHandle(worldX, worldY) {
    if (!this.selectedCameraId) return null;
    const cam = this.getCamera(this.selectedCameraId);
    if (!cam) return null;

    const angleRad = cam.angle * Math.PI / 180;
    const halfWidthRad = (cam.coneWidth / 2) * Math.PI / 180;
    const t = 10;

    const tipX = cam.x + Math.cos(angleRad) * cam.coneLength;
    const tipY = cam.y + Math.sin(angleRad) * cam.coneLength;
    if ((worldX - tipX) ** 2 + (worldY - tipY) ** 2 < t * t) {
      return { type: 'cone-length', cameraId: cam.id };
    }

    const wAngle = angleRad + halfWidthRad;
    const wLen = cam.coneLength * 0.82;
    const wX = cam.x + Math.cos(wAngle) * wLen;
    const wY = cam.y + Math.sin(wAngle) * wLen;
    if ((worldX - wX) ** 2 + (worldY - wY) ** 2 < t * t) {
      return { type: 'cone-width', cameraId: cam.id };
    }

    const rDist = this.iconSize * 0.7;
    const rX = cam.x + Math.cos(angleRad) * rDist;
    const rY = cam.y + Math.sin(angleRad) * rDist;
    if ((worldX - rX) ** 2 + (worldY - rY) ** 2 < t * t) {
      return { type: 'rotate', cameraId: cam.id };
    }

    return null;
  }

  moveCamera(id, dx, dy) {
    const cam = this.getCamera(id);
    if (cam) { cam.x += dx; cam.y += dy; }
  }

  updateConeLength(id, worldX, worldY) {
    const cam = this.getCamera(id);
    if (!cam) return;
    const dx = worldX - cam.x;
    const dy = worldY - cam.y;
    cam.coneLength = Math.max(15, Math.sqrt(dx * dx + dy * dy));
  }

  updateConeWidth(id, worldX, worldY) {
    const cam = this.getCamera(id);
    if (!cam) return;
    const dx = worldX - cam.x;
    const dy = worldY - cam.y;
    const angleToPoint = Math.atan2(dy, dx) * 180 / Math.PI;
    let diff = angleToPoint - cam.angle;
    if (diff < 0) diff += 360;
    if (diff > 180) diff -= 360;
    cam.coneWidth = Math.max(10, Math.min(180, Math.abs(diff) * 2));
  }

  updateAngle(id, worldX, worldY) {
    const cam = this.getCamera(id);
    if (!cam) return;
    const dx = worldX - cam.x;
    const dy = worldY - cam.y;
    cam.angle = (Math.atan2(dy, dx) * 180 / Math.PI);
    if (cam.angle < 0) cam.angle += 360;
  }

  saveDebounced() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 2000);
  }

  async save() {
    try {
      await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.cameras),
      });
    } catch (e) {
      // silently fail
    }
  }
}
