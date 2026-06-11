import { BaseEventEmitter } from '../utils/events';
import { generateId } from '../utils/id';
import {
  SlowMotionSegment,
  ComparisonSegment,
  ComparisonMode,
  VideoClip,
} from '../types';

interface RhythmAlignerEvents {
  slowMotionAdded: SlowMotionSegment;
  comparisonAdded: ComparisonSegment;
  segmentRemoved: { segmentId: string };
  beatDetected: { timestamp: number; clipId: string };
  error: Error;
}

export class RhythmAligner extends BaseEventEmitter<RhythmAlignerEvents> {
  private slowMotionSegments: Map<string, SlowMotionSegment> = new Map();
  private comparisonSegments: Map<string, ComparisonSegment> = new Map();

  addSlowMotion(
    clipId: string,
    startTime: number,
    endTime: number,
    speed: number = 0.5
  ): SlowMotionSegment {
    if (speed >= 1 || speed <= 0) {
      throw new Error('Speed must be between 0 and 1 for slow motion');
    }

    const segment: SlowMotionSegment = {
      id: generateId(),
      startTime,
      endTime,
      speed,
      clipId,
    };

    this.slowMotionSegments.set(segment.id, segment);
    this.emit('slowMotionAdded', segment);
    return segment;
  }

  addComparison(
    sourceClipId: string,
    referenceClipId: string,
    startTime: number,
    endTime: number,
    mode: ComparisonMode = 'side-by-side'
  ): ComparisonSegment {
    const segment: ComparisonSegment = {
      id: generateId(),
      mode,
      sourceClipId,
      referenceClipId,
      startTime,
      endTime,
    };

    this.comparisonSegments.set(segment.id, segment);
    this.emit('comparisonAdded', segment);
    return segment;
  }

  removeSlowMotion(segmentId: string): boolean {
    const result = this.slowMotionSegments.delete(segmentId);
    if (result) {
      this.emit('segmentRemoved', { segmentId });
    }
    return result;
  }

  removeComparison(segmentId: string): boolean {
    const result = this.comparisonSegments.delete(segmentId);
    if (result) {
      this.emit('segmentRemoved', { segmentId });
    }
    return result;
  }

  getSlowMotionByClip(clipId: string): SlowMotionSegment[] {
    return Array.from(this.slowMotionSegments.values()).filter(s => s.clipId === clipId);
  }

  getComparisonsByClip(clipId: string): ComparisonSegment[] {
    return Array.from(this.comparisonSegments.values()).filter(
      s => s.sourceClipId === clipId || s.referenceClipId === clipId
    );
  }

  getSlowMotion(segmentId: string): SlowMotionSegment | undefined {
    return this.slowMotionSegments.get(segmentId);
  }

  getComparison(segmentId: string): ComparisonSegment | undefined {
    return this.comparisonSegments.get(segmentId);
  }

  getAllSlowMotions(): SlowMotionSegment[] {
    return Array.from(this.slowMotionSegments.values());
  }

  getAllComparisons(): ComparisonSegment[] {
    return Array.from(this.comparisonSegments.values());
  }

  detectBeats(
    clip: VideoClip,
    sensitivity: number = 0.7
  ): number[] {
    const beats: number[] = [];
    const duration = clip.duration;
    const interval = 1 / clip.fps;
    
    for (let t = 0; t < duration; t += interval) {
      if (Math.random() < sensitivity * 0.1) {
        beats.push(Math.round(t * 100) / 100);
        this.emit('beatDetected', { timestamp: t, clipId: clip.id });
      }
    }
    
    return beats;
  }

  alignToBeat(
    clipId: string,
    beats: number[],
    keyframeTimestamps: number[]
  ): Map<number, number> {
    const alignment = new Map<number, number>();
    
    keyframeTimestamps.forEach(keyframeTime => {
      let closestBeat = beats[0];
      let minDiff = Math.abs(keyframeTime - closestBeat);
      
      for (let i = 1; i < beats.length; i++) {
        const diff = Math.abs(keyframeTime - beats[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closestBeat = beats[i];
        }
      }
      
      alignment.set(keyframeTime, closestBeat);
    });
    
    return alignment;
  }

  calculateAdjustedTimeline(
    clipId: string,
    baseDuration: number
  ): { originalTime: number; adjustedTime: number }[] {
    const slowMotions = this.getSlowMotionByClip(clipId);
    const timeline: { originalTime: number; adjustedTime: number }[] = [];
    
    let adjustedTime = 0;
    const step = 0.1;
    
    for (let t = 0; t <= baseDuration; t += step) {
      const speed = this.getSpeedAtTime(clipId, t, slowMotions);
      const timeScale = 1 / speed;
      adjustedTime += step * timeScale;
      timeline.push({
        originalTime: Math.round(t * 10) / 10,
        adjustedTime: Math.round(adjustedTime * 10) / 10,
      });
    }
    
    return timeline;
  }

  getAdjustedDuration(clipId: string, baseDuration: number): number {
    const slowMotions = this.getSlowMotionByClip(clipId);
    let adjustedDuration = 0;
    const step = 0.01;
    
    for (let t = 0; t < baseDuration; t += step) {
      const speed = this.getSpeedAtTime(clipId, t, slowMotions);
      adjustedDuration += step / speed;
    }
    
    return Math.round(adjustedDuration * 100) / 100;
  }

  renderComparisonOnCanvas(
    ctx: CanvasRenderingContext2D,
    segment: ComparisonSegment,
    sourceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    referenceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    width: number,
    height: number
  ): void {
    ctx.clearRect(0, 0, width, height);
    
    switch (segment.mode) {
      case 'side-by-side':
        this.renderSideBySide(ctx, sourceImage, referenceImage, width, height);
        break;
      case 'top-bottom':
        this.renderTopBottom(ctx, sourceImage, referenceImage, width, height);
        break;
      case 'overlay':
        this.renderOverlay(ctx, sourceImage, referenceImage, width, height);
        break;
    }
  }

  clearAll(): void {
    this.slowMotionSegments.clear();
    this.comparisonSegments.clear();
  }

  private getSpeedAtTime(
    clipId: string,
    time: number,
    segments: SlowMotionSegment[]
  ): number {
    for (const segment of segments) {
      if (segment.clipId === clipId && time >= segment.startTime && time < segment.endTime) {
        return segment.speed;
      }
    }
    return 1;
  }

  private renderSideBySide(
    ctx: CanvasRenderingContext2D,
    sourceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    referenceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    width: number,
    height: number
  ): void {
    const halfWidth = width / 2;
    
    ctx.drawImage(sourceImage, 0, 0, halfWidth, height);
    ctx.drawImage(referenceImage, halfWidth, 0, halfWidth, height);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, height);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('你的动作', 10, 25);
    ctx.textAlign = 'right';
    ctx.fillText('标准动作', width - 10, 25);
  }

  private renderTopBottom(
    ctx: CanvasRenderingContext2D,
    sourceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    referenceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    width: number,
    height: number
  ): void {
    const halfHeight = height / 2;
    
    ctx.drawImage(sourceImage, 0, 0, width, halfHeight);
    ctx.drawImage(referenceImage, 0, halfHeight, width, halfHeight);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, halfHeight);
    ctx.lineTo(width, halfHeight);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('你的动作', 10, 25);
    ctx.fillText('标准动作', 10, halfHeight + 25);
  }

  private renderOverlay(
    ctx: CanvasRenderingContext2D,
    sourceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    referenceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    width: number,
    height: number
  ): void {
    ctx.drawImage(sourceImage, 0, 0, width, height);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(referenceImage, 0, 0, width, height);
    ctx.globalAlpha = 1;
    
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(0, 0, width, height);
    ctx.setLineDash([]);
  }
}
