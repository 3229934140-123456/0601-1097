export type VideoResolution = '360p' | '480p' | '720p' | '1080p' | '4K';

export type VideoOrientation = 'portrait' | 'landscape';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export type MarkerType = 'angle' | 'error' | 'keyframe' | 'correction';

export type ComparisonMode = 'side-by-side' | 'overlay' | 'top-bottom';

export type PlaybackEvent = 'play' | 'pause' | 'ended' | 'timeupdate' | 'seek';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoClip {
  id: string;
  filePath: string;
  startTime: number;
  endTime: number;
  duration: number;
  resolution: VideoResolution;
  fps: number;
}

export interface AngleMarker {
  id: string;
  type: 'angle';
  point1: Point;
  point2: Point;
  point3: Point;
  angle: number;
  color: string;
  label?: string;
  timestamp: number;
  clipId: string;
}

export interface ErrorMarker {
  id: string;
  type: 'error';
  position: Point;
  area?: Rect;
  severity: 'low' | 'medium' | 'high';
  description: string;
  correction?: string;
  timestamp: number;
  clipId: string;
}

export interface KeyframeMarker {
  id: string;
  type: 'keyframe';
  timestamp: number;
  clipId: string;
  thumbnail?: string;
  label?: string;
}

export interface CorrectionMarker {
  id: string;
  type: 'correction';
  timestamp: number;
  clipId: string;
  beforePosition: Point;
  afterPosition: Point;
  description: string;
}

export type Marker = AngleMarker | ErrorMarker | KeyframeMarker | CorrectionMarker;

export interface SlowMotionSegment {
  id: string;
  startTime: number;
  endTime: number;
  speed: number;
  clipId: string;
}

export interface ComparisonSegment {
  id: string;
  mode: ComparisonMode;
  sourceClipId: string;
  referenceClipId: string;
  startTime: number;
  endTime: number;
}

export interface VoiceOverlay {
  id: string;
  audioPath: string;
  startTime: number;
  endTime?: number;
  volume: number;
  text?: string;
}

export interface FaceBlurConfig {
  enabled: boolean;
  blurLevel: 'low' | 'medium' | 'high';
  tracking: boolean;
}

export interface TrainingOverlay {
  id: string;
  type: 'count' | 'timer' | 'score' | 'text';
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  value: string | number;
  startTime: number;
  endTime: number;
  style?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  };
}

export interface CoverTemplate {
  id: string;
  name: string;
  orientation: VideoOrientation;
  thumbnailUrl: string;
  layout: 'image-only' | 'image-title' | 'image-title-subtitle' | 'comparison';
}

export interface CoverConfig {
  templateId: string;
  imagePath?: string;
  beforeImagePath?: string;
  afterImagePath?: string;
  title?: string;
  subtitle?: string;
  trainingCount?: number;
  includeTrainingStats?: boolean;
}

export interface UploadProgress {
  videoId: string;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speed: number;
}

export interface TrainingSummary {
  id: string;
  exerciseName: string;
  totalReps: number;
  correctReps: number;
  errorCount: number;
  duration: number;
  avgScore: number;
  keyErrors: string[];
  suggestions: string[];
  videoThumbnail?: string;
  createdAt: Date;
}

export interface Draft {
  id: string;
  name: string;
  projectData: ProjectData;
  thumbnail?: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface ProjectData {
  id: string;
  name: string;
  clips: VideoClip[];
  markers: Marker[];
  slowMotionSegments: SlowMotionSegment[];
  comparisonSegments: ComparisonSegment[];
  voiceOverlays: VoiceOverlay[];
  overlays: TrainingOverlay[];
  faceBlurConfig: FaceBlurConfig;
  coverConfig?: CoverConfig;
  orientation: VideoOrientation;
  targetResolutions: VideoResolution[];
}

export interface ExportOptions {
  resolutions: VideoResolution[];
  fps: number;
  format: 'mp4' | 'mov' | 'gif';
  quality: 'low' | 'medium' | 'high';
  includeWatermark?: boolean;
}

export interface ExportResult {
  videoId: string;
  filePath: string;
  resolution: VideoResolution;
  duration: number;
  fileSize: number;
  thumbnailPath?: string;
}

export interface RecordingOptions {
  camera: 'front' | 'back';
  resolution: VideoResolution;
  fps: number;
  orientation: VideoOrientation;
  maxDuration?: number;
  autoSave?: boolean;
}

export interface PlaybackState {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
}

export interface SDKConfig {
  appId: string;
  apiKey: string;
  serverUrl?: string;
  cacheDir?: string;
  maxCacheSize?: number;
}
