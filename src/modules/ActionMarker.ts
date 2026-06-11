import { BaseEventEmitter } from '../utils/events';
import { generateId } from '../utils/id';
import {
  Marker,
  AngleMarker,
  ErrorMarker,
  KeyframeMarker,
  CorrectionMarker,
  Point,
  Rect,
} from '../types';

interface ActionMarkerEvents {
  markerAdded: Marker;
  markerUpdated: Marker;
  markerRemoved: { markerId: string };
  error: Error;
}

export class ActionMarker extends BaseEventEmitter<ActionMarkerEvents> {
  private markers: Map<string, Marker> = new Map();

  addAngleMarker(
    clipId: string,
    timestamp: number,
    point1: Point,
    point2: Point,
    point3: Point,
    color: string = '#ff4444',
    label?: string
  ): AngleMarker {
    const angle = this.calculateAngle(point1, point2, point3);
    
    const marker: AngleMarker = {
      id: generateId(),
      type: 'angle',
      point1,
      point2,
      point3,
      angle,
      color,
      label,
      timestamp,
      clipId,
    };

    this.markers.set(marker.id, marker);
    this.emit('markerAdded', marker);
    return marker;
  }

  addErrorMarker(
    clipId: string,
    timestamp: number,
    position: Point,
    description: string,
    severity: 'low' | 'medium' | 'high' = 'medium',
    area?: Rect,
    correction?: string
  ): ErrorMarker {
    const marker: ErrorMarker = {
      id: generateId(),
      type: 'error',
      position,
      area,
      severity,
      description,
      correction,
      timestamp,
      clipId,
    };

    this.markers.set(marker.id, marker);
    this.emit('markerAdded', marker);
    return marker;
  }

  addKeyframeMarker(
    clipId: string,
    timestamp: number,
    label?: string,
    thumbnail?: string
  ): KeyframeMarker {
    const marker: KeyframeMarker = {
      id: generateId(),
      type: 'keyframe',
      timestamp,
      clipId,
      thumbnail,
      label,
    };

    this.markers.set(marker.id, marker);
    this.emit('markerAdded', marker);
    return marker;
  }

  addCorrectionMarker(
    clipId: string,
    timestamp: number,
    beforePosition: Point,
    afterPosition: Point,
    description: string
  ): CorrectionMarker {
    const marker: CorrectionMarker = {
      id: generateId(),
      type: 'correction',
      timestamp,
      clipId,
      beforePosition,
      afterPosition,
      description,
    };

    this.markers.set(marker.id, marker);
    this.emit('markerAdded', marker);
    return marker;
  }

  updateMarker(markerId: string, updates: Partial<Marker>): Marker {
    const marker = this.markers.get(markerId);
    if (!marker) {
      throw new Error(`Marker not found: ${markerId}`);
    }

    const updatedMarker = { ...marker, ...updates } as Marker;
    this.markers.set(markerId, updatedMarker);
    this.emit('markerUpdated', updatedMarker);
    return updatedMarker;
  }

  removeMarker(markerId: string): boolean {
    const result = this.markers.delete(markerId);
    if (result) {
      this.emit('markerRemoved', { markerId });
    }
    return result;
  }

  getMarker(markerId: string): Marker | undefined {
    return this.markers.get(markerId);
  }

  getMarkersByClip(clipId: string): Marker[] {
    return Array.from(this.markers.values()).filter(m => m.clipId === clipId);
  }

  getMarkersByType<T extends Marker['type']>(type: T): Extract<Marker, { type: T }>[] {
    return Array.from(this.markers.values()).filter(m => m.type === type) as Extract<Marker, { type: T }>[];
  }

  getMarkersInTimeRange(clipId: string, startTime: number, endTime: number): Marker[] {
    return Array.from(this.markers.values()).filter(
      m => m.clipId === clipId && m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  getAllMarkers(): Marker[] {
    return Array.from(this.markers.values());
  }

  clearMarkersByClip(clipId: string): number {
    const clipMarkers = Array.from(this.markers.values()).filter(m => m.clipId === clipId);
    clipMarkers.forEach(m => this.markers.delete(m.id));
    return clipMarkers.length;
  }

  clearAllMarkers(): void {
    this.markers.clear();
  }

  getAngleMarkers(clipId?: string): AngleMarker[] {
    let markers = this.getMarkersByType('angle');
    if (clipId) {
      markers = markers.filter(m => m.clipId === clipId);
    }
    return markers;
  }

  getErrorMarkers(clipId?: string): ErrorMarker[] {
    let markers = this.getMarkersByType('error');
    if (clipId) {
      markers = markers.filter(m => m.clipId === clipId);
    }
    return markers;
  }

  getKeyframeMarkers(clipId?: string): KeyframeMarker[] {
    let markers = this.getMarkersByType('keyframe');
    if (clipId) {
      markers = markers.filter(m => m.clipId === clipId);
    }
    return markers;
  }

  getCorrectionMarkers(clipId?: string): CorrectionMarker[] {
    let markers = this.getMarkersByType('correction');
    if (clipId) {
      markers = markers.filter(m => m.clipId === clipId);
    }
    return markers;
  }

  renderMarkersOnCanvas(
    ctx: CanvasRenderingContext2D,
    clipId: string,
    timestamp: number,
    width: number,
    height: number
  ): void {
    const markers = this.getMarkersInTimeRange(clipId, timestamp - 0.1, timestamp + 0.1);
    
    markers.forEach(marker => {
      switch (marker.type) {
        case 'angle':
          this.renderAngleMarker(ctx, marker, width, height);
          break;
        case 'error':
          this.renderErrorMarker(ctx, marker, width, height);
          break;
        case 'correction':
          this.renderCorrectionMarker(ctx, marker, width, height);
          break;
      }
    });
  }

  private calculateAngle(p1: Point, p2: Point, p3: Point): number {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle) * (180 / Math.PI);
  }

  private renderAngleMarker(
    ctx: CanvasRenderingContext2D,
    marker: AngleMarker,
    width: number,
    height: number
  ): void {
    const p1 = { x: marker.point1.x * width, y: marker.point1.y * height };
    const p2 = { x: marker.point2.x * width, y: marker.point2.y * height };
    const p3 = { x: marker.point3.x * width, y: marker.point3.y * height };

    ctx.strokeStyle = marker.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();

    const angleText = `${marker.angle.toFixed(1)}°`;
    ctx.fillStyle = marker.color;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(angleText, p2.x, p2.y - 10);

    if (marker.label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.fillText(marker.label, p2.x, p2.y + 25);
    }
  }

  private renderErrorMarker(
    ctx: CanvasRenderingContext2D,
    marker: ErrorMarker,
    width: number,
    height: number
  ): void {
    const pos = { x: marker.position.x * width, y: marker.position.y * height };

    const colors: Record<string, string> = {
      low: '#ffc107',
      medium: '#ff9800',
      high: '#f44336',
    };

    ctx.strokeStyle = colors[marker.severity];
    ctx.lineWidth = 3;

    if (marker.area) {
      const area = {
        x: marker.area.x * width,
        y: marker.area.y * height,
        w: marker.area.width * width,
        h: marker.area.height * height,
      };
      ctx.strokeRect(area.x, area.y, area.w, area.h);
      
      ctx.fillStyle = `${colors[marker.severity]}33`;
      ctx.fillRect(area.x, area.y, area.w, area.h);
    } else {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(pos.x - 35, pos.y);
      ctx.lineTo(pos.x + 35, pos.y);
      ctx.moveTo(pos.x, pos.y - 35);
      ctx.lineTo(pos.x, pos.y + 35);
      ctx.stroke();
    }

    ctx.fillStyle = colors[marker.severity];
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(marker.description, pos.x + 30, pos.y - 10);

    if (marker.correction) {
      ctx.fillStyle = '#4caf50';
      ctx.font = '11px Arial';
      ctx.fillText(`✓ ${marker.correction}`, pos.x + 30, pos.y + 10);
    }
  }

  private renderCorrectionMarker(
    ctx: CanvasRenderingContext2D,
    marker: CorrectionMarker,
    width: number,
    height: number
  ): void {
    const before = { x: marker.beforePosition.x * width, y: marker.beforePosition.y * height };
    const after = { x: marker.afterPosition.x * width, y: marker.afterPosition.y * height };

    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(before.x, before.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f44336';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('❌', before.x, before.y + 4);

    ctx.strokeStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(after.x, after.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#4caf50';
    ctx.fillText('✓', after.x, after.y + 4);

    ctx.strokeStyle = '#2196f3';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(before.x, before.y);
    ctx.lineTo(after.x, after.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const midX = (before.x + after.x) / 2;
    const midY = (before.y + after.y) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.fillText(marker.description, midX, midY - 20);
  }
}
