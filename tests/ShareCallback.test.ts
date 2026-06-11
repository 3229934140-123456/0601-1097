import { ShareCallback } from '../src/modules/ShareCallback';
import {
  ProjectData,
  ExportOptions,
  VideoResolution,
  ErrorMarker,
} from '../src/types';

describe('ShareCallback', () => {
  let shareCallback: ShareCallback;
  const mockProjectData: ProjectData = {
    id: 'test-project',
    name: 'Test Project',
    clips: [
      {
        id: 'clip-1',
        filePath: 'test.mp4',
        startTime: 0,
        endTime: 10,
        duration: 10,
        resolution: '1080p',
        fps: 30,
      },
    ],
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
    orientation: 'portrait',
    targetResolutions: ['720p', '1080p'],
  };

  beforeEach(() => {
    shareCallback = new ShareCallback();
  });

  afterEach(() => {
    shareCallback.clearAll();
  });

  describe('exportVideo', () => {
    it('should export video with multiple resolutions', async () => {
      const options: ExportOptions = {
        resolutions: ['720p', '1080p'],
        fps: 30,
        format: 'mp4',
        quality: 'high',
      };

      const results = await shareCallback.exportVideo(mockProjectData, options);

      expect(results.length).toBe(2);
      expect(results[0].resolution).toBe('720p');
      expect(results[1].resolution).toBe('1080p');
      expect(results[0].duration).toBe(10);
      expect(results[0].filePath).toContain('export_');
      expect(results[0].fileSize).toBeGreaterThan(0);
    });

    it('should call onProgress callback', async () => {
      const options: ExportOptions = {
        resolutions: ['720p'],
        fps: 30,
        format: 'mp4',
        quality: 'medium',
      };

      const progressCallback = jest.fn();
      await shareCallback.exportVideo(mockProjectData, options, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback.mock.calls.length).toBeGreaterThan(5);
    });

    it('should emit exportProgress and exportComplete events', async () => {
      const options: ExportOptions = {
        resolutions: ['720p'],
        fps: 30,
        format: 'mp4',
        quality: 'low',
      };

      const progressHandler = jest.fn();
      const completeHandler = jest.fn();

      shareCallback.on('exportProgress', progressHandler);
      shareCallback.on('exportComplete', completeHandler);

      await shareCallback.exportVideo(mockProjectData, options);

      expect(progressHandler).toHaveBeenCalled();
      expect(completeHandler).toHaveBeenCalled();
    });
  });

  describe('generateTrainingSummary', () => {
    it('should generate summary with correct calculations', () => {
      const markers: ErrorMarker[] = [
        {
          id: 'error-1',
          type: 'error',
          position: { x: 0.5, y: 0.5 },
          severity: 'high',
          description: '膝盖内扣',
          correction: '膝盖向外打开',
          timestamp: 1.0,
          clipId: 'clip-1',
        },
        {
          id: 'error-2',
          type: 'error',
          position: { x: 0.5, y: 0.5 },
          severity: 'medium',
          description: '背部弯曲',
          correction: '保持背部挺直',
          timestamp: 2.0,
          clipId: 'clip-1',
        },
        {
          id: 'error-3',
          type: 'error',
          position: { x: 0.5, y: 0.5 },
          severity: 'low',
          description: '脚跟抬起',
          timestamp: 3.0,
          clipId: 'clip-1',
        },
      ];

      const summary = shareCallback.generateTrainingSummary(
        '深蹲',
        markers,
        30,
        15
      );

      expect(summary.id).toBeDefined();
      expect(summary.exerciseName).toBe('深蹲');
      expect(summary.totalReps).toBe(15);
      expect(summary.correctReps).toBe(14);
      expect(summary.errorCount).toBe(3);
      expect(summary.duration).toBe(30);
      expect(summary.avgScore).toBeGreaterThan(0);
      expect(summary.avgScore).toBeLessThanOrEqual(100);
      expect(summary.keyErrors.length).toBe(3);
      expect(summary.suggestions.length).toBeGreaterThan(0);
      expect(summary.createdAt).toBeInstanceOf(Date);
    });

    it('should handle no errors correctly', () => {
      const summary = shareCallback.generateTrainingSummary(
        '深蹲',
        [],
        30,
        15
      );

      expect(summary.correctReps).toBe(15);
      expect(summary.errorCount).toBe(0);
      expect(summary.avgScore).toBe(100);
      expect(summary.keyErrors.length).toBe(0);
      expect(summary.suggestions).toContain('动作整体表现良好，继续保持！');
    });

    it('should emit summaryGenerated event', () => {
      const handler = jest.fn();
      shareCallback.on('summaryGenerated', handler);

      shareCallback.generateTrainingSummary('深蹲', [], 30, 15);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('draft management', () => {
    it('should save a draft', async () => {
      const draft = await shareCallback.saveDraft(
        '测试草稿',
        mockProjectData,
        'thumbnail.jpg'
      );

      expect(draft.id).toBeDefined();
      expect(draft.name).toBe('测试草稿');
      expect(draft.thumbnail).toBe('thumbnail.jpg');
      expect(draft.projectData.id).toBe('test-project');
      expect(draft.createdAt).toBeInstanceOf(Date);
      expect(draft.updatedAt).toBeInstanceOf(Date);
    });

    it('should load a saved draft', async () => {
      const savedDraft = await shareCallback.saveDraft('测试草稿', mockProjectData);
      const loadedDraft = await shareCallback.loadDraft(savedDraft.id);

      expect(loadedDraft.id).toBe(savedDraft.id);
      expect(loadedDraft.name).toBe('测试草稿');
    });

    it('should throw error when loading non-existent draft', async () => {
      await expect(shareCallback.loadDraft('non-existent-id')).rejects.toThrow(
        'Draft not found: non-existent-id'
      );
    });

    it('should update a draft', async () => {
      const draft = await shareCallback.saveDraft('原始名称', mockProjectData);
      await new Promise(resolve => setTimeout(resolve, 100));
      const updatedDraft = await shareCallback.updateDraft(draft.id, {
        name: '更新后的名称',
      });

      expect(updatedDraft.name).toBe('更新后的名称');
      expect(updatedDraft.updatedAt.getTime()).toBeGreaterThan(draft.updatedAt.getTime());
    });

    it('should list drafts sorted by updated time', async () => {
      await shareCallback.saveDraft('草稿1', mockProjectData);
      await new Promise(resolve => setTimeout(resolve, 100));
      await shareCallback.saveDraft('草稿2', mockProjectData);

      const drafts = shareCallback.listDrafts();
      expect(drafts.length).toBe(2);
      expect(drafts[0].name).toBe('草稿2');
      expect(drafts[1].name).toBe('草稿1');
    });

    it('should delete a draft', async () => {
      const draft = await shareCallback.saveDraft('测试草稿', mockProjectData);
      const result = shareCallback.deleteDraft(draft.id);

      expect(result).toBe(true);
      expect(shareCallback.listDrafts().length).toBe(0);
    });
  });

  describe('playback events', () => {
    it('should send playback events with state', () => {
      const handler = jest.fn();
      shareCallback.on('playbackEvent', handler);

      shareCallback.sendPlaybackEvent('play', {
        currentTime: 0,
        duration: 30,
        paused: false,
      });

      expect(handler).toHaveBeenCalledWith({
        event: 'play',
        state: {
          currentTime: 0,
          duration: 30,
          paused: false,
          volume: 1,
        },
      });
    });

    it('should get and set playback state', () => {
      expect(shareCallback.getPlaybackState()).toEqual({
        currentTime: 0,
        duration: 0,
        paused: true,
        volume: 1,
      });

      shareCallback.setPlaybackState({ currentTime: 5, volume: 0.8 });

      expect(shareCallback.getPlaybackState()).toEqual({
        currentTime: 5,
        duration: 0,
        paused: true,
        volume: 0.8,
      });
    });
  });

  describe('shareToPlatform', () => {
    it('should share to platform and return result', async () => {
      const result = await shareCallback.shareToPlatform(
        'douyin',
        'video.mp4',
        'cover.jpg',
        '测试描述'
      );

      expect(result.success).toBe(true);
      expect(result.platform).toBe('douyin');
      expect(result.url).toContain('https://douyin.com/share/');
    });
  });
});
