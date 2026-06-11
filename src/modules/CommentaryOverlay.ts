import { BaseEventEmitter } from '../utils/events';
import { generateId } from '../utils/id';
import {
  VoiceOverlay,
  FaceBlurConfig,
  TrainingOverlay,
  Rect,
} from '../types';

interface CommentaryOverlayEvents {
  voiceAdded: VoiceOverlay;
  overlayAdded: TrainingOverlay;
  overlayUpdated: TrainingOverlay;
  overlayRemoved: { overlayId: string };
  faceBlurConfigUpdated: FaceBlurConfig;
  error: Error;
}

export class CommentaryOverlay extends BaseEventEmitter<CommentaryOverlayEvents> {
  private voiceOverlays: Map<string, VoiceOverlay> = new Map();
  private overlays: Map<string, TrainingOverlay> = new Map();
  private faceBlurConfig: FaceBlurConfig = {
    enabled: false,
    blurLevel: 'medium',
    tracking: true,
  };
  private detectedFaces: Map<string, Rect[]> = new Map();

  addVoiceOverlay(
    audioPath: string,
    startTime: number,
    endTime?: number,
    volume: number = 1,
    text?: string
  ): VoiceOverlay {
    const overlay: VoiceOverlay = {
      id: generateId(),
      audioPath,
      startTime,
      endTime,
      volume,
      text,
    };

    this.voiceOverlays.set(overlay.id, overlay);
    this.emit('voiceAdded', overlay);
    return overlay;
  }

  addTrainingOverlay(
    type: TrainingOverlay['type'],
    position: TrainingOverlay['position'],
    value: string | number,
    startTime: number,
    endTime: number,
    style?: TrainingOverlay['style']
  ): TrainingOverlay {
    const overlay: TrainingOverlay = {
      id: generateId(),
      type,
      position,
      value,
      startTime,
      endTime,
      style,
    };

    this.overlays.set(overlay.id, overlay);
    this.emit('overlayAdded', overlay);
    return overlay;
  }

  updateTrainingOverlay(overlayId: string, updates: Partial<TrainingOverlay>): TrainingOverlay {
    const overlay = this.overlays.get(overlayId);
    if (!overlay) {
      throw new Error(`Overlay not found: ${overlayId}`);
    }

    const updatedOverlay = { ...overlay, ...updates };
    this.overlays.set(overlayId, updatedOverlay);
    this.emit('overlayUpdated', updatedOverlay);
    return updatedOverlay;
  }

  removeTrainingOverlay(overlayId: string): boolean {
    const result = this.overlays.delete(overlayId);
    if (result) {
      this.emit('overlayRemoved', { overlayId });
    }
    return result;
  }

  setFaceBlurConfig(config: Partial<FaceBlurConfig>): FaceBlurConfig {
    this.faceBlurConfig = { ...this.faceBlurConfig, ...config };
    this.emit('faceBlurConfigUpdated', this.faceBlurConfig);
    return this.faceBlurConfig;
  }

  getFaceBlurConfig(): FaceBlurConfig {
    return { ...this.faceBlurConfig };
  }

  getVoiceOverlays(): VoiceOverlay[] {
    return Array.from(this.voiceOverlays.values());
  }

  getTrainingOverlays(): TrainingOverlay[] {
    return Array.from(this.overlays.values());
  }

  getOverlaysAtTime(time: number): TrainingOverlay[] {
    return Array.from(this.overlays.values()).filter(
      o => time >= o.startTime && time <= o.endTime
    );
  }

  getVoiceOverlaysAtTime(time: number): VoiceOverlay[] {
    return Array.from(this.voiceOverlays.values()).filter(v => {
      const endTime = v.endTime ?? v.startTime + 5;
      return time >= v.startTime && time <= endTime;
    });
  }

  detectFaces(imageData: ImageData, clipId: string): Rect[] {
    const faces: Rect[] = [];
    const faceCount = Math.floor(Math.random() * 2) + 1;
    
    for (let i = 0; i < faceCount; i++) {
      faces.push({
        x: 0.2 + Math.random() * 0.6,
        y: 0.1 + Math.random() * 0.3,
        width: 0.15 + Math.random() * 0.1,
        height: 0.15 + Math.random() * 0.1,
      });
    }
    
    this.detectedFaces.set(clipId, faces);
    return faces;
  }

  applyFaceBlur(
    ctx: CanvasRenderingContext2D,
    clipId: string,
    width: number,
    height: number
  ): void {
    if (!this.faceBlurConfig.enabled) return;

    const faces = this.detectedFaces.get(clipId) || [];
    
    const blurRadii: Record<string, number> = {
      low: 5,
      medium: 15,
      high: 30,
    };

    faces.forEach(face => {
      const x = face.x * width;
      const y = face.y * height;
      const w = face.width * width;
      const h = face.height * height;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = `blur(${blurRadii[this.faceBlurConfig.blurLevel]}px)`;
      ctx.drawImage(ctx.canvas, x, y, w, h, x, y, w, h);
      ctx.restore();
    });
  }

  renderOverlays(
    ctx: CanvasRenderingContext2D,
    time: number,
    width: number,
    height: number
  ): void {
    const activeOverlays = this.getOverlaysAtTime(time);
    
    activeOverlays.forEach(overlay => {
      this.renderOverlay(ctx, overlay, width, height);
    });
  }

  clearAll(): void {
    this.voiceOverlays.clear();
    this.overlays.clear();
    this.detectedFaces.clear();
  }

  private renderOverlay(
    ctx: CanvasRenderingContext2D,
    overlay: TrainingOverlay,
    width: number,
    height: number
  ): void {
    const positions = this.getOverlayPosition(overlay.position, width, height);
    
    ctx.save();
    
    const fontSize = overlay.style?.fontSize || 24;
    const color = overlay.style?.color || '#ffffff';
    const bgColor = overlay.style?.backgroundColor || 'rgba(0, 0, 0, 0.6)';
    
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = positions.align;
    ctx.textBaseline = positions.baseline;
    
    const padding = 12;
    const text = String(overlay.value);
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width + padding * 2;
    const textHeight = fontSize + padding;
    
    let bgX = positions.x;
    let bgY = positions.y;
    
    if (positions.align === 'right') {
      bgX = positions.x - textWidth;
    } else if (positions.align === 'center') {
      bgX = positions.x - textWidth / 2;
    }
    
    if (positions.baseline === 'bottom') {
      bgY = positions.y - textHeight;
    }
    
    ctx.fillStyle = bgColor;
    this.roundRect(ctx, bgX, bgY, textWidth, textHeight, 8);
    ctx.fill();
    
    ctx.fillStyle = color;
    const textX = positions.align === 'left' ? positions.x + padding : 
                  positions.align === 'right' ? positions.x - padding : positions.x;
    const textY = positions.baseline === 'top' ? positions.y + padding + fontSize / 2 :
                  positions.baseline === 'bottom' ? positions.y - padding + fontSize / 2 : positions.y + fontSize / 4;
    
    ctx.fillText(text, textX, textY);
    
    ctx.restore();
  }

  private getOverlayPosition(
    position: TrainingOverlay['position'],
    width: number,
    height: number
  ): { x: number; y: number; align: CanvasTextAlign; baseline: CanvasTextBaseline } {
    const margin = 20;
    
    switch (position) {
      case 'top-left':
        return { x: margin, y: margin, align: 'left', baseline: 'top' };
      case 'top-right':
        return { x: width - margin, y: margin, align: 'right', baseline: 'top' };
      case 'bottom-left':
        return { x: margin, y: height - margin, align: 'left', baseline: 'bottom' };
      case 'bottom-right':
        return { x: width - margin, y: height - margin, align: 'right', baseline: 'bottom' };
      case 'center':
        return { x: width / 2, y: height / 2, align: 'center', baseline: 'middle' };
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
