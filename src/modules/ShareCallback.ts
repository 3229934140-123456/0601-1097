import { BaseEventEmitter } from '../utils/events';
import { generateId } from '../utils/id';
import {
  UploadProgress,
  TrainingSummary,
  Draft,
  ProjectData,
  ExportOptions,
  ExportResult,
  VideoResolution,
  PlaybackEvent,
  PlaybackState,
  ErrorMarker,
  Marker,
} from '../types';

interface ShareCallbackEvents {
  uploadProgress: UploadProgress;
  uploadComplete: { videoId: string; url: string };
  uploadError: { videoId: string; error: Error };
  exportProgress: { videoId: string; resolution: VideoResolution; progress: number };
  exportComplete: ExportResult[];
  playbackEvent: { event: PlaybackEvent; state: PlaybackState };
  summaryGenerated: TrainingSummary;
  draftSaved: Draft;
  draftLoaded: Draft;
  error: Error;
}

export class ShareCallback extends BaseEventEmitter<ShareCallbackEvents> {
  private drafts: Map<string, Draft> = new Map();
  private uploadCache: Map<string, UploadProgress> = new Map();
  private playbackState: PlaybackState = {
    currentTime: 0,
    duration: 0,
    paused: true,
    volume: 1,
  };

  async exportVideo(
    projectData: ProjectData,
    options: ExportOptions,
    onProgress?: (progress: number, resolution: VideoResolution) => void
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];
    const totalResolutions = options.resolutions.length;
    
    for (let i = 0; i < totalResolutions; i++) {
      const resolution = options.resolutions[i];
      const videoId = generateId();
      
      for (let p = 0; p <= 100; p += 10) {
        await this.delay(100);
        const progress = (i * 100 + p) / totalResolutions;
        
        this.emit('exportProgress', { videoId, resolution, progress: p });
        if (onProgress) {
          onProgress(progress, resolution);
        }
      }
      
      const result: ExportResult = {
        videoId,
        filePath: `export_${videoId}_${resolution}.${options.format}`,
        resolution,
        duration: projectData.clips.reduce((sum, c) => sum + c.duration, 0),
        fileSize: this.estimateFileSize(resolution, projectData, options),
      };
      
      results.push(result);
    }
    
    this.emit('exportComplete', results);
    return results;
  }

  async uploadVideo(
    videoId: string,
    filePath: string,
    targetUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const totalBytes = this.getFileSize(filePath);
      let uploadedBytes = 0;
      const startTime = Date.now();

      const interval = setInterval(() => {
        const increment = Math.random() * 0.1 * totalBytes;
        uploadedBytes = Math.min(uploadedBytes + increment, totalBytes);
        const progress = (uploadedBytes / totalBytes) * 100;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = uploadedBytes / elapsed;

        const progressData: UploadProgress = {
          videoId,
          progress,
          uploadedBytes,
          totalBytes,
          speed,
        };

        this.uploadCache.set(videoId, progressData);
        this.emit('uploadProgress', progressData);
        
        if (onProgress) {
          onProgress(progressData);
        }

        if (uploadedBytes >= totalBytes) {
          clearInterval(interval);
          const videoUrl = `${targetUrl}/${videoId}`;
          this.emit('uploadComplete', { videoId, url: videoUrl });
          resolve(videoUrl);
        }
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
        const error = new Error('Upload timed out');
        this.emit('uploadError', { videoId, error });
        reject(error);
      }, 60000);
    });
  }

  cancelUpload(videoId: string): boolean {
    return this.uploadCache.delete(videoId);
  }

  getUploadProgress(videoId: string): UploadProgress | undefined {
    return this.uploadCache.get(videoId);
  }

  generateTrainingSummary(
    exerciseName: string,
    markers: Marker[],
    duration: number,
    totalReps: number
  ): TrainingSummary {
    const errorMarkers = markers.filter(m => m.type === 'error') as ErrorMarker[];
    const highSeverityErrors = errorMarkers.filter(e => e.severity === 'high');
    const mediumSeverityErrors = errorMarkers.filter(e => e.severity === 'medium');
    
    const keyErrors = Array.from(new Set(errorMarkers.map(e => e.description))).slice(0, 5);
    const corrections = Array.from(new Set(errorMarkers.map(e => e.correction).filter(Boolean) as string[]));
    
    const suggestions = this.generateSuggestions(errorMarkers);
    const correctReps = Math.max(0, totalReps - highSeverityErrors.length);
    const avgScore = this.calculateAvgScore(errorMarkers, totalReps);

    const summary: TrainingSummary = {
      id: generateId(),
      exerciseName,
      totalReps,
      correctReps,
      errorCount: errorMarkers.length,
      duration,
      avgScore,
      keyErrors,
      suggestions,
      createdAt: new Date(),
    };

    this.emit('summaryGenerated', summary);
    return summary;
  }

  async saveDraft(
    name: string,
    projectData: ProjectData,
    thumbnail?: string
  ): Promise<Draft> {
    const draft: Draft = {
      id: generateId(),
      name,
      projectData: JSON.parse(JSON.stringify(projectData)),
      thumbnail,
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    this.drafts.set(draft.id, draft);
    
    try {
      await this.persistDraft(draft);
    } catch (error) {
      console.warn('Failed to persist draft to storage:', error);
    }

    this.emit('draftSaved', draft);
    return draft;
  }

  async loadDraft(draftId: string): Promise<Draft> {
    let draft: Draft | undefined = this.drafts.get(draftId);
    
    if (!draft) {
      const persistedDraft = await this.loadPersistedDraft(draftId);
      if (persistedDraft) {
        draft = persistedDraft;
        this.drafts.set(draftId, draft);
      }
    }

    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    this.emit('draftLoaded', draft);
    return draft;
  }

  async updateDraft(
    draftId: string,
    updates: Partial<Pick<Draft, 'name' | 'projectData' | 'thumbnail'>>
  ): Promise<Draft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const updatedDraft: Draft = {
      ...draft,
      ...updates,
      updatedAt: new Date(),
    };

    this.drafts.set(draftId, updatedDraft);
    this.emit('draftSaved', updatedDraft);
    return updatedDraft;
  }

  deleteDraft(draftId: string): boolean {
    return this.drafts.delete(draftId);
  }

  listDrafts(): Draft[] {
    return Array.from(this.drafts.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  sendPlaybackEvent(event: PlaybackEvent, state: Partial<PlaybackState> = {}): void {
    this.playbackState = { ...this.playbackState, ...state };
    this.emit('playbackEvent', { event, state: { ...this.playbackState } });
  }

  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  setPlaybackState(state: Partial<PlaybackState>): void {
    this.playbackState = { ...this.playbackState, ...state };
  }

  shareToPlatform(
    platform: string,
    videoPath: string,
    coverPath?: string,
    description?: string
  ): Promise<{ success: boolean; platform: string; url?: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          platform,
          url: `https://${platform}.com/share/${generateId()}`,
        });
      }, 1000);
    });
  }

  private async persistDraft(draft: Draft): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`draft_${draft.id}`, JSON.stringify(draft));
    }
  }

  private async loadPersistedDraft(draftId: string): Promise<Draft | null> {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(`draft_${draftId}`);
      if (data) {
        const draft = JSON.parse(data);
        draft.createdAt = new Date(draft.createdAt);
        draft.updatedAt = new Date(draft.updatedAt);
        return draft;
      }
    }
    return null;
  }

  private generateSuggestions(errorMarkers: ErrorMarker[]): string[] {
    const suggestions: string[] = [];
    const highErrors = errorMarkers.filter(e => e.severity === 'high');
    const mediumErrors = errorMarkers.filter(e => e.severity === 'medium');
    
    if (highErrors.length > 0) {
      suggestions.push(`重点纠正 ${highErrors[0].description}，建议放慢动作速度练习`);
    }
    
    if (mediumErrors.length > 2) {
      suggestions.push('注意保持核心收紧，身体稳定');
    }
    
    if (errorMarkers.length > 5) {
      suggestions.push('建议分段练习，每次专注一个动作要点');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('动作整体表现良好，继续保持！');
    }
    
    return suggestions;
  }

  private calculateAvgScore(errorMarkers: ErrorMarker[], totalReps: number): number {
    if (totalReps === 0) return 100;
    
    const scoreDeductions: Record<string, number> = {
      low: 2,
      medium: 5,
      high: 10,
    };
    
    const totalDeductions = errorMarkers.reduce(
      (sum, e) => sum + scoreDeductions[e.severity],
      0
    );
    
    return Math.max(0, Math.min(100, 100 - totalDeductions / totalReps));
  }

  private getFileSize(filePath: string): number {
    return Math.random() * 50 * 1024 * 1024 + 10 * 1024 * 1024;
  }

  private estimateFileSize(
    resolution: VideoResolution,
    projectData: ProjectData,
    options: ExportOptions
  ): number {
    const bitrates: Record<VideoResolution, number> = {
      '360p': 1,
      '480p': 2.5,
      '720p': 5,
      '1080p': 8,
      '4K': 30,
    };

    const qualityMultipliers: Record<string, number> = {
      low: 0.5,
      medium: 1,
      high: 1.5,
    };

    const duration = projectData.clips.reduce((sum, c) => sum + c.duration, 0);
    const bitrate = bitrates[resolution] * qualityMultipliers[options.quality];
    
    return Math.round((bitrate * duration * 1024 * 1024) / 8);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearAll(): void {
    this.drafts.clear();
    this.uploadCache.clear();
  }
}
