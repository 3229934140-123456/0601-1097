import { RhythmAligner } from '../src/modules/RhythmAligner';
import { CommentaryOverlay } from '../src/modules/CommentaryOverlay';
import { ShareCallback } from '../src/modules/ShareCallback';
import { CoverGenerator } from '../src/modules/CoverGenerator';
import { ProjectData, CoverConfig, VideoOrientation } from '../src/types';

const mockContext = {
  fillStyle: '',
  fillRect: jest.fn(),
  drawImage: jest.fn(),
  strokeStyle: '',
  lineWidth: 0,
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fillText: jest.fn(),
  font: '',
  textAlign: '' as CanvasTextAlign,
  textBaseline: '' as CanvasTextBaseline,
  measureText: jest.fn().mockReturnValue({ width: 100 }),
  createLinearGradient: jest.fn().mockReturnValue({ addColorStop: jest.fn() }),
  fill: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  clip: jest.fn(),
  rect: jest.fn(),
  arc: jest.fn(),
  ellipse: jest.fn(),
  filter: '',
  setLineDash: jest.fn(),
  quadraticCurveTo: jest.fn(),
  closePath: jest.fn(),
  canvas: document.createElement('canvas'),
  globalAlpha: 1,
} as any;

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Improvement Tests', () => {
  describe('1. Recording pause duration', () => {
    it('should have correct initial state', () => {
      const { RecordingController } = require('../src/modules/RecordingController');
      const controller = new RecordingController();
      
      expect(controller.getCurrentTime()).toBe(0);
      expect(controller.getState()).toBe('idle');
      expect(controller.getKeyframes()).toEqual([]);
    });

    it('should throw error when pausing without recording', () => {
      const { RecordingController } = require('../src/modules/RecordingController');
      const controller = new RecordingController();
      
      expect(() => controller.pauseRecording()).toThrow('Not recording');
    });
  });

  describe('2. Cover generation with async image loading', () => {
    let coverGenerator: CoverGenerator;

    beforeEach(() => {
      coverGenerator = new CoverGenerator();
    });

    it('generateCover should return a Promise', () => {
      const config: CoverConfig = {
        templateId: 'portrait-simple',
        title: '测试封面',
      };
      
      const result = coverGenerator.generateCover(config);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should have correct default templates', () => {
      const templates = coverGenerator.getTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should filter templates by orientation', () => {
      const portraitTemplates = coverGenerator.getTemplates('portrait');
      const landscapeTemplates = coverGenerator.getTemplates('landscape');
      
      expect(portraitTemplates.length).toBeGreaterThan(0);
      expect(landscapeTemplates.length).toBeGreaterThan(0);
      
      portraitTemplates.forEach(t => expect(t.orientation).toBe('portrait'));
      landscapeTemplates.forEach(t => expect(t.orientation).toBe('landscape'));
    });

    it('should get template by id', () => {
      const template = coverGenerator.getTemplate('portrait-simple');
      expect(template).toBeDefined();
      expect(template?.id).toBe('portrait-simple');
      expect(template?.orientation).toBe('portrait');
    });

    it('selectTemplate should emit templateSelected event', () => {
      const handler = jest.fn();
      coverGenerator.on('templateSelected', handler);
      
      const template = coverGenerator.selectTemplate('portrait-comparison');
      
      expect(handler).toHaveBeenCalledWith(template);
      expect(template.id).toBe('portrait-comparison');
    });

    it('should add custom template', () => {
      const newTemplate = coverGenerator.addTemplate({
        name: '自定义模板',
        orientation: 'portrait' as VideoOrientation,
        thumbnailUrl: 'custom.jpg',
        layout: 'image-title',
      });
      
      expect(newTemplate.id).toBeDefined();
      expect(newTemplate.name).toBe('自定义模板');
      expect(coverGenerator.getTemplates().length).toBe(6);
    });

    it('should remove template', () => {
      const newTemplate = coverGenerator.addTemplate({
        name: '待删除',
        orientation: 'portrait' as VideoOrientation,
        thumbnailUrl: 'test.jpg',
        layout: 'image-only',
      });
      
      const result = coverGenerator.removeTemplate(newTemplate.id);
      expect(result).toBe(true);
      expect(coverGenerator.getTemplate(newTemplate.id)).toBeUndefined();
    });
  });

  describe('3. Draft persistence', () => {
    let shareCallback: ShareCallback;
    const mockProjectData: ProjectData = {
      id: 'test-project',
      name: 'Test',
      clips: [],
      markers: [],
      slowMotionSegments: [],
      comparisonSegments: [],
      voiceOverlays: [],
      overlays: [],
      faceBlurConfig: { enabled: false, blurLevel: 'medium', tracking: true },
      orientation: 'portrait',
      targetResolutions: ['720p'],
    };

    beforeEach(() => {
      localStorage.clear();
      shareCallback = new ShareCallback();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should load drafts from localStorage on initialization', async () => {
      await shareCallback.saveDraft('草稿1', mockProjectData);
      await shareCallback.saveDraft('草稿2', mockProjectData);
      
      const newShareCallback = new ShareCallback();
      const drafts = newShareCallback.listDrafts();
      
      expect(drafts.length).toBe(2);
      expect(drafts.map(d => d.name)).toContain('草稿1');
      expect(drafts.map(d => d.name)).toContain('草稿2');
    });

    it('should delete draft from localStorage', async () => {
      const draft = await shareCallback.saveDraft('待删除', mockProjectData);
      
      expect(shareCallback.listDrafts().length).toBe(1);
      
      const result = shareCallback.deleteDraft(draft.id);
      expect(result).toBe(true);
      expect(shareCallback.listDrafts().length).toBe(0);
      
      const newShareCallback = new ShareCallback();
      expect(newShareCallback.listDrafts().length).toBe(0);
    });

    it('should persist draft name updates to localStorage', async () => {
      const draft = await shareCallback.saveDraft('原名', mockProjectData);
      
      const updated = await shareCallback.updateDraft(draft.id, { name: '新名' });
      expect(updated.name).toBe('新名');
      
      const newShareCallback = new ShareCallback();
      const reloaded = newShareCallback.listDrafts();
      expect(reloaded.length).toBe(1);
      expect(reloaded[0].name).toBe('新名');
    });

    it('listDrafts should return drafts sorted by updatedAt descending', async () => {
      await shareCallback.saveDraft('早的草稿', mockProjectData);
      await new Promise(resolve => setTimeout(resolve, 50));
      await shareCallback.saveDraft('晚的草稿', mockProjectData);
      
      const drafts = shareCallback.listDrafts();
      expect(drafts[0].name).toBe('晚的草稿');
      expect(drafts[1].name).toBe('早的草稿');
    });

    it('should load draft by id from storage', async () => {
      const saved = await shareCallback.saveDraft('可加载', mockProjectData);
      
      const newShareCallback = new ShareCallback();
      const loaded = await newShareCallback.loadDraft(saved.id);
      
      expect(loaded.id).toBe(saved.id);
      expect(loaded.name).toBe('可加载');
    });
  });

  describe('4. Slow motion timeline', () => {
    let rhythmAligner: RhythmAligner;

    beforeEach(() => {
      rhythmAligner = new RhythmAligner();
    });

    it('0.5x speed should make duration twice as long', () => {
      const clipId = 'test-clip';
      const baseDuration = 10;
      
      rhythmAligner.addSlowMotion(clipId, 0, baseDuration, 0.5);
      const adjustedDuration = rhythmAligner.getAdjustedDuration(clipId, baseDuration);
      
      expect(adjustedDuration).toBeCloseTo(20, 0.5);
    });

    it('0.25x speed should make duration 4x longer', () => {
      const clipId = 'test-clip-2';
      const baseDuration = 5;
      
      rhythmAligner.addSlowMotion(clipId, 0, baseDuration, 0.25);
      const adjustedDuration = rhythmAligner.getAdjustedDuration(clipId, baseDuration);
      
      expect(adjustedDuration).toBeCloseTo(20, 0.5);
    });

    it('normal speed (no slow motion) should not change duration', () => {
      const clipId = 'test-clip-3';
      const baseDuration = 10;
      
      const adjustedDuration = rhythmAligner.getAdjustedDuration(clipId, baseDuration);
      
      expect(adjustedDuration).toBeCloseTo(10, 0.5);
    });

    it('adjusted timeline should have longer total duration for slow motion', () => {
      const clipId = 'test-clip-4';
      const baseDuration = 10;
      
      rhythmAligner.addSlowMotion(clipId, 3, 7, 0.5);
      const timeline = rhythmAligner.calculateAdjustedTimeline(clipId, baseDuration);
      
      const lastEntry = timeline[timeline.length - 1];
      expect(lastEntry.adjustedTime).toBeGreaterThan(baseDuration);
      expect(lastEntry.originalTime).toBeCloseTo(10, 0.1);
    });

    it('partial slow motion segment should extend only that part', () => {
      const clipId = 'test-clip-5';
      const baseDuration = 10;
      
      rhythmAligner.addSlowMotion(clipId, 5, 6, 0.5);
      const adjustedDuration = rhythmAligner.getAdjustedDuration(clipId, baseDuration);
      
      const slowPartOriginal = 1;
      const slowPartAdjusted = slowPartOriginal / 0.5;
      const normalPart = baseDuration - slowPartOriginal;
      const expectedDuration = normalPart + slowPartAdjusted;
      
      expect(adjustedDuration).toBeCloseTo(expectedDuration, 0.5);
    });

    it('should throw error for speed >= 1', () => {
      expect(() => {
        rhythmAligner.addSlowMotion('clip', 0, 10, 1.0);
      }).toThrow('Speed must be between 0 and 1 for slow motion');
    });

    it('should throw error for speed <= 0', () => {
      expect(() => {
        rhythmAligner.addSlowMotion('clip', 0, 10, 0);
      }).toThrow('Speed must be between 0 and 1 for slow motion');
    });

    it('should remove slow motion segment', () => {
      const segment = rhythmAligner.addSlowMotion('clip', 0, 5, 0.5);
      
      const result = rhythmAligner.removeSlowMotion(segment.id);
      expect(result).toBe(true);
      expect(rhythmAligner.getSlowMotionByClip('clip').length).toBe(0);
    });

    it('should get slow motions by clip id', () => {
      rhythmAligner.addSlowMotion('clip-a', 0, 5, 0.5);
      rhythmAligner.addSlowMotion('clip-b', 0, 3, 0.25);
      rhythmAligner.addSlowMotion('clip-a', 6, 8, 0.5);
      
      expect(rhythmAligner.getSlowMotionByClip('clip-a').length).toBe(2);
      expect(rhythmAligner.getSlowMotionByClip('clip-b').length).toBe(1);
    });
  });

  describe('5. Deterministic face detection', () => {
    let commentary: CommentaryOverlay;

    beforeEach(() => {
      commentary = new CommentaryOverlay();
    });

    function createMockImageData(width: number, height: number): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
      return { data, width, height } as ImageData;
    }

    it('same clipId should produce same face positions', () => {
      const clipId = 'same-clip';
      const imageData = createMockImageData(100, 100);
      
      const faces1 = commentary.detectFaces(imageData, clipId);
      const faces2 = commentary.detectFaces(imageData, clipId);
      
      expect(faces1.length).toBe(faces2.length);
      for (let i = 0; i < faces1.length; i++) {
        expect(faces1[i].x).toBeCloseTo(faces2[i].x, 5);
        expect(faces1[i].y).toBeCloseTo(faces2[i].y, 5);
        expect(faces1[i].width).toBeCloseTo(faces2[i].width, 5);
        expect(faces1[i].height).toBeCloseTo(faces2[i].height, 5);
      }
    });

    it('different clipIds should produce different face positions', () => {
      const imageData = createMockImageData(100, 100);
      
      const faces1 = commentary.detectFaces(imageData, 'clip-A');
      const faces2 = commentary.detectFaces(imageData, 'clip-B');
      
      const allSame = faces1.length === faces2.length &&
        faces1.every((f, i) => 
          f.x === faces2[i].x && 
          f.y === faces2[i].y &&
          f.width === faces2[i].width &&
          f.height === faces2[i].height
        );
      
      expect(allSame).toBe(false);
    });

    it('repeated detection on same clip should return cached result', () => {
      const clipId = 'cached-clip';
      const imageData = createMockImageData(100, 100);
      
      const faces1 = commentary.detectFaces(imageData, clipId);
      const faces2 = commentary.detectFaces(imageData, clipId);
      
      expect(faces1).toBe(faces2);
    });

    it('same clip with different CommentaryOverlay instances should produce same results', () => {
      const clipId = 'consistent-clip';
      const imageData = createMockImageData(100, 100);
      
      const commentary1 = new CommentaryOverlay();
      const commentary2 = new CommentaryOverlay();
      
      const faces1 = commentary1.detectFaces(imageData, clipId);
      const faces2 = commentary2.detectFaces(imageData, clipId);
      
      expect(faces1.length).toBe(faces2.length);
      for (let i = 0; i < faces1.length; i++) {
        expect(faces1[i].x).toBeCloseTo(faces2[i].x, 5);
        expect(faces1[i].y).toBeCloseTo(faces2[i].y, 5);
      }
    });

    it('face positions should be in valid ranges', () => {
      const clipId = 'valid-range-clip';
      const imageData = createMockImageData(200, 200);
      
      const faces = commentary.detectFaces(imageData, clipId);
      
      expect(faces.length).toBeGreaterThan(0);
      faces.forEach(face => {
        expect(face.x).toBeGreaterThanOrEqual(0.05);
        expect(face.x).toBeLessThanOrEqual(0.85);
        expect(face.y).toBeGreaterThanOrEqual(0.05);
        expect(face.y).toBeLessThanOrEqual(0.75);
        expect(face.width).toBeGreaterThan(0);
        expect(face.height).toBeGreaterThan(0);
      });
    });

    it('should update face blur config', () => {
      const config = commentary.setFaceBlurConfig({ enabled: true, blurLevel: 'high' });
      
      expect(config.enabled).toBe(true);
      expect(config.blurLevel).toBe('high');
      expect(config.tracking).toBe(true);
    });

    it('getFaceBlurConfig should return a copy', () => {
      const config1 = commentary.getFaceBlurConfig();
      config1.enabled = true;
      
      const config2 = commentary.getFaceBlurConfig();
      expect(config2.enabled).toBe(false);
    });
  });
});
