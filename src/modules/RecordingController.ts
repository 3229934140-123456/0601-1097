import { BaseEventEmitter } from '../utils/events';
import { generateId } from '../utils/id';
import {
  RecordingOptions,
  RecordingState,
  VideoClip,
  KeyframeMarker,
  VideoResolution,
} from '../types';

interface RecordingEvents {
  stateChange: { state: RecordingState; previousState: RecordingState };
  keyframeCaptured: KeyframeMarker;
  clipCreated: VideoClip;
  error: Error;
}

export class RecordingController extends BaseEventEmitter<RecordingEvents> {
  private state: RecordingState = 'idle';
  private options: RecordingOptions | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private accumulatedPauseTime: number = 0;
  private currentClipId: string | null = null;
  private keyframes: KeyframeMarker[] = [];
  private mediaRecorder: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;

  async startRecording(options: RecordingOptions): Promise<VideoClip> {
    if (this.state === 'recording') {
      throw new Error('Already recording');
    }

    this.options = options;
    this.currentClipId = generateId();
    this.keyframes = [];
    this.accumulatedPauseTime = 0;

    try {
      this.stream = await this.getMediaStream(options);
      this.mediaRecorder = await this.createMediaRecorder(this.stream);
      this.videoElement = this.createVideoPreview(this.stream);

      this.setState('recording');
      this.startTime = performance.now();
      this.mediaRecorder.start();

      const clip: VideoClip = {
        id: this.currentClipId,
        filePath: `temp_${this.currentClipId}.mp4`,
        startTime: 0,
        endTime: 0,
        duration: 0,
        resolution: options.resolution,
        fps: options.fps,
      };

      return clip;
    } catch (error) {
      this.setState('idle');
      this.emit('error', error as Error);
      throw error;
    }
  }

  pauseRecording(): void {
    if (this.state !== 'recording') {
      throw new Error('Not recording');
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
    this.pausedTime = performance.now();
    this.setState('paused');
  }

  resumeRecording(): void {
    if (this.state !== 'paused') {
      throw new Error('Not paused');
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
    this.accumulatedPauseTime += performance.now() - this.pausedTime;
    this.setState('recording');
  }

  stopRecording(): Promise<VideoClip> {
    return new Promise((resolve, reject) => {
      if (this.state !== 'recording' && this.state !== 'paused') {
        reject(new Error('Not recording or paused'));
        return;
      }

      const endTime = performance.now();
      const duration = (endTime - this.startTime - this.accumulatedPauseTime) / 1000;

      if (this.mediaRecorder) {
        const chunks: BlobPart[] = [];
        this.mediaRecorder.ondataavailable = (e: any) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/mp4' });
          const filePath = `recording_${this.currentClipId}.mp4`;
          
          const clip: VideoClip = {
            id: this.currentClipId!,
            filePath,
            startTime: 0,
            endTime: duration,
            duration,
            resolution: this.options!.resolution,
            fps: this.options!.fps,
          };

          this.cleanup();
          this.setState('stopped');
          this.emit('clipCreated', clip);
          resolve(clip);
        };

        this.mediaRecorder.stop();
      } else {
        this.cleanup();
        this.setState('stopped');
        reject(new Error('MediaRecorder not initialized'));
      }
    });
  }

  captureKeyframe(label?: string): KeyframeMarker {
    if (this.state !== 'recording') {
      throw new Error('Not recording');
    }

    const currentTime = (performance.now() - this.startTime - this.accumulatedPauseTime) / 1000;
    
    const keyframe: KeyframeMarker = {
      id: generateId(),
      type: 'keyframe',
      timestamp: currentTime,
      clipId: this.currentClipId!,
      label,
    };

    this.keyframes.push(keyframe);
    this.emit('keyframeCaptured', keyframe);
    return keyframe;
  }

  getCurrentTime(): number {
    if (this.state === 'idle') return 0;
    const elapsed = (performance.now() - this.startTime - this.accumulatedPauseTime) / 1000;
    return this.state === 'paused' ? (this.pausedTime - this.startTime - this.accumulatedPauseTime) / 1000 : elapsed;
  }

  getState(): RecordingState {
    return this.state;
  }

  getKeyframes(): KeyframeMarker[] {
    return [...this.keyframes];
  }

  getVideoPreview(): HTMLVideoElement | null {
    return this.videoElement;
  }

  private setState(newState: RecordingState): void {
    const previousState = this.state;
    this.state = newState;
    if (previousState !== newState) {
      this.emit('stateChange', { state: newState, previousState });
    }
  }

  private async getMediaStream(options: RecordingOptions): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: options.camera === 'front' ? 'user' : 'environment',
        width: this.getResolutionWidth(options.resolution),
        height: this.getResolutionHeight(options.resolution),
        frameRate: options.fps,
      },
      audio: true,
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  private async createMediaRecorder(stream: MediaStream): Promise<any> {
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported');
    }
    return new MediaRecorder(stream, {
      mimeType: 'video/mp4;codecs=h264',
      videoBitsPerSecond: this.getVideoBitrate(this.options!.resolution),
    });
  }

  private createVideoPreview(stream: MediaStream): HTMLVideoElement {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    return video;
  }

  private getResolutionWidth(resolution: VideoResolution): number {
    const widths: Record<VideoResolution, number> = {
      '360p': 640,
      '480p': 854,
      '720p': 1280,
      '1080p': 1920,
      '4K': 3840,
    };
    return widths[resolution];
  }

  private getResolutionHeight(resolution: VideoResolution): number {
    const heights: Record<VideoResolution, number> = {
      '360p': 360,
      '480p': 480,
      '720p': 720,
      '1080p': 1080,
      '4K': 2160,
    };
    return heights[resolution];
  }

  private getVideoBitrate(resolution: VideoResolution): number {
    const bitrates: Record<VideoResolution, number> = {
      '360p': 1_000_000,
      '480p': 2_500_000,
      '720p': 5_000_000,
      '1080p': 8_000_000,
      '4K': 30_000_000,
    };
    return bitrates[resolution];
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.mediaRecorder = null;
  }

  destroy(): void {
    this.cleanup();
    this.removeAllListeners();
    this.state = 'idle';
  }
}
