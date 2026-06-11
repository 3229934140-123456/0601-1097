import { ActionMarker } from '../src/modules/ActionMarker';
import { Point, ErrorMarker } from '../src/types';

describe('ActionMarker', () => {
  let actionMarker: ActionMarker;

  beforeEach(() => {
    actionMarker = new ActionMarker();
  });

  afterEach(() => {
    actionMarker.clearAllMarkers();
  });

  describe('addAngleMarker', () => {
    it('should add an angle marker with correct angle calculation', () => {
      const clipId = 'test-clip-1';
      const timestamp = 1.5;
      const point1: Point = { x: 0.3, y: 0.3 };
      const point2: Point = { x: 0.3, y: 0.5 };
      const point3: Point = { x: 0.5, y: 0.5 };

      const marker = actionMarker.addAngleMarker(
        clipId,
        timestamp,
        point1,
        point2,
        point3,
        '#ff4444',
        '膝关节'
      );

      expect(marker.id).toBeDefined();
      expect(marker.type).toBe('angle');
      expect(marker.clipId).toBe(clipId);
      expect(marker.timestamp).toBe(timestamp);
      expect(marker.angle).toBeCloseTo(90, 0.5);
      expect(marker.label).toBe('膝关节');
      expect(marker.color).toBe('#ff4444');
    });

    it('should emit markerAdded event', (done) => {
      actionMarker.on('markerAdded', (marker) => {
        expect(marker.type).toBe('angle');
        done();
      });

      actionMarker.addAngleMarker(
        'clip-1',
        1.0,
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      );
    });
  });

  describe('addErrorMarker', () => {
    it('should add an error marker with correct properties', () => {
      const clipId = 'test-clip-1';
      const timestamp = 2.0;
      const position: Point = { x: 0.5, y: 0.5 };

      const marker = actionMarker.addErrorMarker(
        clipId,
        timestamp,
        position,
        '膝盖内扣',
        'high',
        { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
        '膝盖向外打开'
      );

      expect(marker.id).toBeDefined();
      expect(marker.type).toBe('error');
      expect(marker.severity).toBe('high');
      expect(marker.description).toBe('膝盖内扣');
      expect(marker.correction).toBe('膝盖向外打开');
      expect(marker.area).toBeDefined();
    });

    it('should use default severity when not provided', () => {
      const marker = actionMarker.addErrorMarker(
        'clip-1',
        1.0,
        { x: 0.5, y: 0.5 },
        '测试错误'
      );

      expect(marker.severity).toBe('medium');
    });
  });

  describe('addKeyframeMarker', () => {
    it('should add a keyframe marker', () => {
      const marker = actionMarker.addKeyframeMarker(
        'clip-1',
        3.0,
        '下蹲最低点',
        'thumbnail.jpg'
      );

      expect(marker.type).toBe('keyframe');
      expect(marker.label).toBe('下蹲最低点');
      expect(marker.thumbnail).toBe('thumbnail.jpg');
    });
  });

  describe('addCorrectionMarker', () => {
    it('should add a correction marker', () => {
      const marker = actionMarker.addCorrectionMarker(
        'clip-1',
        2.5,
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
        '膝盖向外打开'
      );

      expect(marker.type).toBe('correction');
      expect(marker.beforePosition).toEqual({ x: 0.4, y: 0.5 });
      expect(marker.afterPosition).toEqual({ x: 0.6, y: 0.5 });
    });
  });

  describe('getMarkers', () => {
    beforeEach(() => {
      actionMarker.addAngleMarker('clip-1', 1.0, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 });
      actionMarker.addErrorMarker('clip-1', 2.0, { x: 0.5, y: 0.5 }, '错误1');
      actionMarker.addKeyframeMarker('clip-1', 3.0);
      actionMarker.addErrorMarker('clip-2', 1.0, { x: 0.5, y: 0.5 }, '错误2');
    });

    it('should get all markers', () => {
      const markers = actionMarker.getAllMarkers();
      expect(markers.length).toBe(4);
    });

    it('should get markers by clip ID', () => {
      const markers = actionMarker.getMarkersByClip('clip-1');
      expect(markers.length).toBe(3);
    });

    it('should get markers by type', () => {
      const errorMarkers = actionMarker.getMarkersByType('error');
      expect(errorMarkers.length).toBe(2);
      expect(errorMarkers[0].type).toBe('error');
    });

    it('should get markers in time range', () => {
      const markers = actionMarker.getMarkersInTimeRange('clip-1', 0.5, 2.5);
      expect(markers.length).toBe(2);
    });

    it('should get angle markers', () => {
      const angleMarkers = actionMarker.getAngleMarkers();
      expect(angleMarkers.length).toBe(1);
    });

    it('should get error markers', () => {
      const errorMarkers = actionMarker.getErrorMarkers();
      expect(errorMarkers.length).toBe(2);
    });
  });

  describe('updateMarker', () => {
    it('should update an existing marker', () => {
      const marker = actionMarker.addErrorMarker(
        'clip-1',
        1.0,
        { x: 0.5, y: 0.5 },
        '原始描述'
      );

      const updated = actionMarker.updateMarker(marker.id, {
        description: '更新后的描述',
        severity: 'high',
      }) as ErrorMarker;

      expect(updated.description).toBe('更新后的描述');
      expect(updated.severity).toBe('high');
    });

    it('should throw error when marker not found', () => {
      expect(() => {
        actionMarker.updateMarker('non-existent-id', { description: 'test' });
      }).toThrow('Marker not found: non-existent-id');
    });
  });

  describe('removeMarker', () => {
    it('should remove a marker', () => {
      const marker = actionMarker.addErrorMarker(
        'clip-1',
        1.0,
        { x: 0.5, y: 0.5 },
        'test'
      );

      const result = actionMarker.removeMarker(marker.id);
      expect(result).toBe(true);
      expect(actionMarker.getAllMarkers().length).toBe(0);
    });

    it('should return false when marker not found', () => {
      const result = actionMarker.removeMarker('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('clearMarkers', () => {
    beforeEach(() => {
      actionMarker.addErrorMarker('clip-1', 1.0, { x: 0.5, y: 0.5 }, 'test');
      actionMarker.addErrorMarker('clip-2', 1.0, { x: 0.5, y: 0.5 }, 'test');
    });

    it('should clear markers by clip', () => {
      const count = actionMarker.clearMarkersByClip('clip-1');
      expect(count).toBe(1);
      expect(actionMarker.getAllMarkers().length).toBe(1);
    });

    it('should clear all markers', () => {
      actionMarker.clearAllMarkers();
      expect(actionMarker.getAllMarkers().length).toBe(0);
    });
  });
});
