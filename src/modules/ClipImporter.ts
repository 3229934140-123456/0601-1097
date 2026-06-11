import { BaseEventEmitter } from '../utils/events';
import { generateId } from '../utils/id';
import { VideoClip, VideoResolution } from '../types';

interface ClipImporterEvents {
  clipImported: VideoClip;
  progress: { clipId: string; progress: number };
  error: Error;
}

export class ClipImporter extends BaseEventEmitter<ClipImporterEvents> {
  private clips: Map<string, VideoClip> = new Map();

  async importFromFile(file: File, trimStart?: number, trimEnd?: number): Promise<VideoClip> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;

        const clip: VideoClip = {
          id: generateId(),
          filePath: file.name,
          startTime: trimStart || 0,
          endTime: trimEnd || duration,
          duration: (trimEnd || duration) - (trimStart || 0),
          resolution: this.detectResolution(width, height),
          fps: 30,
        };

        this.clips.set(clip.id, clip);
        this.emit('clipImported', clip);
        resolve(clip);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        const error = new Error('Failed to load video file');
        this.emit('error', error);
        reject(error);
      };

      video.src = URL.createObjectURL(file);
    });
  }

  async importFromPath(filePath: string, trimStart?: number, trimEnd?: number): Promise<VideoClip> {
    const clip: VideoClip = {
      id: generateId(),
      filePath,
      startTime: trimStart || 0,
      endTime: trimEnd || 0,
      duration: trimEnd ? trimEnd - (trimStart || 0) : 0,
      resolution: '720p',
      fps: 30,
    };

    return this.probeVideoMetadata(clip);
  }

  async importFromUrl(url: string, trimStart?: number, trimEnd?: number): Promise<VideoClip> {
    const clip: VideoClip = {
      id: generateId(),
      filePath: url,
      startTime: trimStart || 0,
      endTime: trimEnd || 0,
      duration: 0,
      resolution: '720p',
      fps: 30,
    };

    return this.probeVideoMetadata(clip);
  }

  trimClip(clipId: string, startTime: number, endTime: number): VideoClip {
    const clip = this.clips.get(clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }

    const updatedClip: VideoClip = {
      ...clip,
      startTime,
      endTime,
      duration: endTime - startTime,
    };

    this.clips.set(clipId, updatedClip);
    return updatedClip;
  }

  getClip(clipId: string): VideoClip | undefined {
    return this.clips.get(clipId);
  }

  getAllClips(): VideoClip[] {
    return Array.from(this.clips.values());
  }

  removeClip(clipId: string): boolean {
    return this.clips.delete(clipId);
  }

  clearAll(): void {
    this.clips.clear();
  }

  private async probeVideoMetadata(clip: VideoClip): Promise<VideoClip> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;

        const startTime = clip.startTime || 0;
        const endTime = clip.endTime || duration;

        const updatedClip: VideoClip = {
          ...clip,
          startTime,
          endTime,
          duration: endTime - startTime,
          resolution: this.detectResolution(width, height),
        };

        this.clips.set(updatedClip.id, updatedClip);
        this.emit('clipImported', updatedClip);
        resolve(updatedClip);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        const error = new Error('Failed to probe video metadata');
        this.emit('error', error);
        reject(error);
      };

      video.src = clip.filePath;
    });
  }

  private detectResolution(width: number, height: number): VideoResolution {
    const maxDim = Math.max(width, height);
    
    if (maxDim >= 2160) return '4K';
    if (maxDim >= 1080) return '1080p';
    if (maxDim >= 720) return '720p';
    if (maxDim >= 480) return '480p';
    return '360p';
  }
}
