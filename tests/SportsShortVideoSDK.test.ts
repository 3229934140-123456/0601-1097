import { SportsShortVideoSDK } from '../src/SportsShortVideoSDK';
import { SDKConfig, ProjectData } from '../src/types';

describe('SportsShortVideoSDK', () => {
  let sdk: SportsShortVideoSDK;
  const config: SDKConfig = {
    appId: 'test-app-id',
    apiKey: 'test-api-key',
    serverUrl: 'https://api.test.com',
  };

  beforeEach(() => {
    sdk = new SportsShortVideoSDK(config);
  });

  afterEach(() => {
    if (sdk.isInitialized()) {
      sdk.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      expect(sdk.isInitialized()).toBe(false);
      await sdk.initialize();
      expect(sdk.isInitialized()).toBe(true);
    });

    it('should throw error when appId or apiKey is missing', async () => {
      const invalidSdk = new SportsShortVideoSDK({
        appId: '',
        apiKey: '',
      });

      await expect(invalidSdk.initialize()).rejects.toThrow(
        'appId and apiKey are required'
      );
    });

    it('should emit ready event when initialized', (done) => {
      sdk.on('ready', () => {
        done();
      });
      sdk.initialize();
    });

    it('should not reinitialize if already initialized', async () => {
      await sdk.initialize();
      const spy = jest.spyOn(sdk as any, 'emit');
      await sdk.initialize();
      expect(spy).not.toHaveBeenCalledWith('ready');
    });
  });

  describe('module instances', () => {
    it('should have all module instances available', async () => {
      await sdk.initialize();
      expect(sdk.recording).toBeDefined();
      expect(sdk.clipImporter).toBeDefined();
      expect(sdk.actionMarker).toBeDefined();
      expect(sdk.rhythmAligner).toBeDefined();
      expect(sdk.commentary).toBeDefined();
      expect(sdk.coverGenerator).toBeDefined();
      expect(sdk.shareCallback).toBeDefined();
    });
  });

  describe('project management', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    it('should create a project with default values', () => {
      const project = sdk.createProject('测试项目');

      expect(project.id).toBeDefined();
      expect(project.name).toBe('测试项目');
      expect(project.orientation).toBe('portrait');
      expect(project.clips).toEqual([]);
      expect(project.markers).toEqual([]);
      expect(project.faceBlurConfig.enabled).toBe(false);
      expect(project.targetResolutions).toEqual(['720p', '1080p']);
    });

    it('should create a project with custom orientation', () => {
      const project = sdk.createProject('横屏项目', 'landscape');
      expect(project.orientation).toBe('landscape');
    });

    it('should add clip to project', () => {
      const project = sdk.createProject('测试项目');
      const clip = {
        id: 'clip-1',
        filePath: 'test.mp4',
        startTime: 0,
        endTime: 10,
        duration: 10,
        resolution: '1080p' as const,
        fps: 30,
      };

      const updatedProject = sdk.addClipToProject(project, clip);
      expect(updatedProject.clips.length).toBe(1);
      expect(updatedProject.clips[0].id).toBe('clip-1');
    });

    it('should add markers to project', () => {
      const project = sdk.createProject('测试项目');
      const markers = [
        {
          id: 'marker-1',
          type: 'error' as const,
          position: { x: 0.5, y: 0.5 },
          severity: 'high' as const,
          description: '测试错误',
          timestamp: 1.0,
          clipId: 'clip-1',
        },
      ];

      const updatedProject = sdk.addMarkersToProject(project, markers);
      expect(updatedProject.markers.length).toBe(1);
    });

    it('should enable face blur on project', () => {
      const project = sdk.createProject('测试项目');
      const updatedProject = sdk.enableFaceBlur(project, true);
      expect(updatedProject.faceBlurConfig.enabled).toBe(true);
    });

    it('should set target resolutions', () => {
      const project = sdk.createProject('测试项目');
      const updatedProject = sdk.setTargetResolutions(project, ['360p', '720p', '1080p']);
      expect(updatedProject.targetResolutions).toEqual(['360p', '720p', '1080p']);
    });
  });

  describe('export and share', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    it('should export project with default options', async () => {
      const project = sdk.createProject('测试项目');
      const clip = {
        id: 'clip-1',
        filePath: 'test.mp4',
        startTime: 0,
        endTime: 10,
        duration: 10,
        resolution: '1080p' as const,
        fps: 30,
      };
      const projectWithClip = sdk.addClipToProject(project, clip);

      const results = await sdk.exportProject(projectWithClip);
      expect(results.length).toBe(2);
      expect(results[0].resolution).toBe('720p');
      expect(results[1].resolution).toBe('1080p');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedSdk = new SportsShortVideoSDK(config);
      const project: ProjectData = {
        id: 'test',
        name: 'test',
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

      await expect(uninitializedSdk.exportProject(project)).rejects.toThrow(
        'SDK not initialized'
      );
    });
  });

  describe('summary generation', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    it('should generate training summary', () => {
      const markers = [
        {
          id: 'error-1',
          type: 'error' as const,
          position: { x: 0.5, y: 0.5 },
          severity: 'high' as const,
          description: '膝盖内扣',
          correction: '膝盖向外打开',
          timestamp: 1.0,
          clipId: 'clip-1',
        },
      ];

      const summary = sdk.generateSummary('深蹲', markers, 30, 15);
      expect(summary.exerciseName).toBe('深蹲');
      expect(summary.totalReps).toBe(15);
      expect(summary.errorCount).toBe(1);
    });
  });

  describe('draft management', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    it('should save and list drafts', async () => {
      const project = sdk.createProject('测试项目');
      const draft = await sdk.saveDraft('测试草稿', project);

      expect(draft.name).toBe('测试草稿');
      expect(sdk.listDrafts().length).toBe(1);
    });

    it('should load a saved draft', async () => {
      const project = sdk.createProject('测试项目');
      const savedDraft = await sdk.saveDraft('测试草稿', project);
      const loadedDraft = await sdk.loadDraft(savedDraft.id);

      expect(loadedDraft.id).toBe(savedDraft.id);
    });
  });

  describe('config', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    it('should return config copy', () => {
      const returnedConfig = sdk.getConfig();
      expect(returnedConfig.appId).toBe('test-app-id');
      expect(returnedConfig.apiKey).toBe('test-api-key');

      returnedConfig.appId = 'modified';
      expect(sdk.getConfig().appId).toBe('test-app-id');
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', async () => {
      await sdk.initialize();
      
      const destroySpy = jest.spyOn(sdk.recording, 'destroy');
      const clearAllListenersSpy = jest.spyOn(sdk as any, 'removeAllListeners');

      sdk.destroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(clearAllListenersSpy).toHaveBeenCalled();
      expect(sdk.isInitialized()).toBe(false);
    });
  });
});
