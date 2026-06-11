import { BaseEventEmitter } from './utils/events';
import { generateId } from './utils/id';
import { RecordingController } from './modules/RecordingController';
import { ClipImporter } from './modules/ClipImporter';
import { ActionMarker } from './modules/ActionMarker';
import { RhythmAligner } from './modules/RhythmAligner';
import { CommentaryOverlay } from './modules/CommentaryOverlay';
import { CoverGenerator } from './modules/CoverGenerator';
import { ShareCallback } from './modules/ShareCallback';
import {
  SDKConfig,
  ProjectData,
  VideoOrientation,
  VideoResolution,
  ExportOptions,
  ExportResult,
  VideoClip,
  Marker,
  CoverConfig,
  TrainingSummary,
  Draft,
  UploadProgress,
  PlaybackEvent,
  PlaybackState,
} from './types';

interface SDKEvents {
  ready: void;
  error: Error;
}

export class SportsShortVideoSDK extends BaseEventEmitter<SDKEvents> {
  private config: SDKConfig;
  private initialized: boolean = false;

  public recording: RecordingController;
  public clipImporter: ClipImporter;
  public actionMarker: ActionMarker;
  public rhythmAligner: RhythmAligner;
  public commentary: CommentaryOverlay;
  public coverGenerator: CoverGenerator;
  public shareCallback: ShareCallback;

  constructor(config: SDKConfig) {
    super();
    this.config = config;
    this.recording = new RecordingController();
    this.clipImporter = new ClipImporter();
    this.actionMarker = new ActionMarker();
    this.rhythmAligner = new RhythmAligner();
    this.commentary = new CommentaryOverlay();
    this.coverGenerator = new CoverGenerator();
    this.shareCallback = new ShareCallback();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.config.appId || !this.config.apiKey) {
      throw new Error('appId and apiKey are required');
    }

    this.initialized = true;
    this.emit('ready', undefined as any);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  createProject(name: string, orientation: VideoOrientation = 'portrait'): ProjectData {
    this.checkInitialized();

    return {
      id: generateId(),
      name,
      clips: [],
      markers: [],
      slowMotionSegments: [],
      comparisonSegments: [],
      voiceOverlays: [],
      overlays: [],
      faceBlurConfig: {
        enabled: false,
        blurLevel: 'medium',
        tracking: true,
      },
      orientation,
      targetResolutions: ['720p', '1080p'],
    };
  }

  collectProjectData(): ProjectData {
    this.checkInitialized();

    const clips = this.clipImporter.getAllClips();
    const markers = this.actionMarker.getAllMarkers();
    const slowMotionSegments = this.rhythmAligner.getAllSlowMotions();
    const comparisonSegments = this.rhythmAligner.getAllComparisons();
    const voiceOverlays = this.commentary.getVoiceOverlays();
    const overlays = this.commentary.getTrainingOverlays();
    const faceBlurConfig = this.commentary.getFaceBlurConfig();

    return {
      id: generateId(),
      name: 'Untitled Project',
      clips,
      markers,
      slowMotionSegments,
      comparisonSegments,
      voiceOverlays,
      overlays,
      faceBlurConfig,
      orientation: 'portrait',
      targetResolutions: ['720p', '1080p'],
    };
  }

  async exportProject(
    projectData: ProjectData,
    options: Partial<ExportOptions> = {},
    onProgress?: (progress: number, resolution: VideoResolution) => void
  ): Promise<ExportResult[]> {
    this.checkInitialized();

    const fullOptions: ExportOptions = {
      resolutions: projectData.targetResolutions,
      fps: 30,
      format: 'mp4',
      quality: 'medium',
      includeWatermark: true,
      ...options,
    };

    return this.shareCallback.exportVideo(projectData, fullOptions, onProgress);
  }

  async generateCover(
    config: CoverConfig
  ): Promise<string> {
    this.checkInitialized();
    return this.coverGenerator.generateCover(config);
  }

  generateSummary(
    exerciseName: string,
    markers: Marker[],
    duration: number,
    totalReps: number
  ): TrainingSummary {
    this.checkInitialized();
    return this.shareCallback.generateTrainingSummary(
      exerciseName,
      markers,
      duration,
      totalReps
    );
  }

  async saveDraft(
    name: string,
    projectData: ProjectData,
    thumbnail?: string
  ): Promise<Draft> {
    this.checkInitialized();
    return this.shareCallback.saveDraft(name, projectData, thumbnail);
  }

  async loadDraft(draftId: string): Promise<Draft> {
    this.checkInitialized();
    return this.shareCallback.loadDraft(draftId);
  }

  listDrafts(): Draft[] {
    this.checkInitialized();
    return this.shareCallback.listDrafts();
  }

  async uploadVideo(
    videoId: string,
    filePath: string,
    targetUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    this.checkInitialized();
    return this.shareCallback.uploadVideo(videoId, filePath, targetUrl, onProgress);
  }

  sendPlaybackEvent(event: PlaybackEvent, state?: Partial<PlaybackState>): void {
    this.checkInitialized();
    this.shareCallback.sendPlaybackEvent(event, state);
  }

  addClipToProject(project: ProjectData, clip: VideoClip): ProjectData {
    return {
      ...project,
      clips: [...project.clips, clip],
    };
  }

  addMarkersToProject(project: ProjectData, markers: Marker[]): ProjectData {
    return {
      ...project,
      markers: [...project.markers, ...markers],
    };
  }

  enableFaceBlur(project: ProjectData, enabled: boolean = true): ProjectData {
    return {
      ...project,
      faceBlurConfig: {
        ...project.faceBlurConfig,
        enabled,
      },
    };
  }

  setTargetResolutions(project: ProjectData, resolutions: VideoResolution[]): ProjectData {
    return {
      ...project,
      targetResolutions: resolutions,
    };
  }

  getConfig(): SDKConfig {
    return { ...this.config };
  }

  destroy(): void {
    this.recording.destroy();
    this.clipImporter.clearAll();
    this.actionMarker.clearAllMarkers();
    this.rhythmAligner.clearAll();
    this.commentary.clearAll();
    this.shareCallback.clearAll();
    this.removeAllListeners();
    this.initialized = false;
  }

  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }
  }
}
