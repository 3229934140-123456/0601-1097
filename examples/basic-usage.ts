import {
  SportsShortVideoSDK,
  RecordingOptions,
  Point,
  CoverConfig,
  ExportOptions,
} from '../src';

async function main() {
  const sdk = new SportsShortVideoSDK({
    appId: 'your-app-id',
    apiKey: 'your-api-key',
    serverUrl: 'https://api.example.com',
  });

  await sdk.initialize();
  console.log('SDK initialized successfully');

  const project = sdk.createProject('深蹲训练纠错', 'portrait');
  console.log('Project created:', project.id);

  const recordOptions: RecordingOptions = {
    camera: 'back',
    resolution: '1080p',
    fps: 30,
    orientation: 'portrait',
    maxDuration: 60,
    autoSave: true,
  };

  console.log('Starting recording...');
  const clip = await sdk.recording.startRecording(recordOptions);
  console.log('Recording started, clip ID:', clip.id);

  sdk.recording.on('stateChange', ({ state, previousState }) => {
    console.log(`Recording state: ${previousState} -> ${state}`);
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  const keyframe = sdk.recording.captureKeyframe('下蹲最低点');
  console.log('Keyframe captured at:', keyframe.timestamp);

  await new Promise(resolve => setTimeout(resolve, 1000));

  sdk.recording.pauseRecording();
  console.log('Recording paused');

  await new Promise(resolve => setTimeout(resolve, 500));

  sdk.recording.resumeRecording();
  console.log('Recording resumed');

  await new Promise(resolve => setTimeout(resolve, 2000));

  const finalClip = await sdk.recording.stopRecording();
  console.log('Recording stopped, duration:', finalClip.duration.toFixed(2), 's');

  const projectWithClip = sdk.addClipToProject(project, finalClip);

  const kneeAngle: Point = { x: 0.3, y: 0.5 };
  const hipAngle: Point = { x: 0.35, y: 0.3 };
  const ankleAngle: Point = { x: 0.25, y: 0.7 };

  const angleMarker = sdk.actionMarker.addAngleMarker(
    finalClip.id,
    1.5,
    hipAngle,
    kneeAngle,
    ankleAngle,
    '#ff4444',
    '膝关节角度'
  );
  console.log('Angle marker added:', angleMarker.angle.toFixed(1), '°');

  const errorMarker = sdk.actionMarker.addErrorMarker(
    finalClip.id,
    1.5,
    { x: 0.5, y: 0.5 },
    '膝盖内扣',
    'high',
    { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    '保持膝盖与脚尖方向一致'
  );
  console.log('Error marker added:', errorMarker.description);

  const correctionMarker = sdk.actionMarker.addCorrectionMarker(
    finalClip.id,
    2.0,
    { x: 0.45, y: 0.5 },
    { x: 0.55, y: 0.5 },
    '膝盖向外打开'
  );
  console.log('Correction marker added:', correctionMarker.description);

  const slowMotion = sdk.rhythmAligner.addSlowMotion(
    finalClip.id,
    1.0,
    2.0,
    0.25
  );
  console.log('Slow motion segment added:', slowMotion.speed, 'x speed');

  sdk.commentary.setFaceBlurConfig({
    enabled: true,
    blurLevel: 'high',
    tracking: true,
  });
  console.log('Face blur enabled');

  const voiceOverlay = sdk.commentary.addVoiceOverlay(
    'coach_voice.mp3',
    0.5,
    3.0,
    0.8,
    '注意下蹲时保持背部挺直，膝盖不要超过脚尖太多'
  );
  console.log('Voice overlay added:', voiceOverlay.text);

  const countOverlay = sdk.commentary.addTrainingOverlay(
    'count',
    'top-right',
    '第 1 次',
    0,
    finalClip.duration,
    { fontSize: 28, color: '#ffffff' }
  );
  console.log('Training overlay added:', countOverlay.value);

  const coverConfig: CoverConfig = {
    templateId: 'portrait-comparison',
    beforeImagePath: 'before.jpg',
    afterImagePath: 'after.jpg',
    title: '深蹲动作纠错',
    subtitle: '第1次训练 · 15次',
    trainingCount: 15,
    includeTrainingStats: true,
  };

  const coverPath = await sdk.generateCover(coverConfig);
  console.log('Cover generated:', coverPath);

  const markers = sdk.actionMarker.getAllMarkers();
  const summary = sdk.generateSummary(
    '深蹲',
    markers,
    finalClip.duration,
    15
  );
  console.log('Training summary generated:');
  console.log('  Score:', summary.avgScore.toFixed(0));
  console.log('  Correct reps:', summary.correctReps, '/', summary.totalReps);
  console.log('  Errors:', summary.errorCount);
  console.log('  Key errors:', summary.keyErrors);
  console.log('  Suggestions:', summary.suggestions);

  const projectWithMarkers = sdk.addMarkersToProject(projectWithClip, markers);
  const projectWithBlur = sdk.enableFaceBlur(projectWithMarkers, true);
  const finalProject = sdk.setTargetResolutions(projectWithBlur, ['720p', '1080p']);

  const exportOptions: ExportOptions = {
    resolutions: ['720p', '1080p'],
    fps: 30,
    format: 'mp4',
    quality: 'high',
    includeWatermark: true,
  };

  console.log('Exporting video...');
  const exportResults = await sdk.exportProject(
    finalProject,
    exportOptions,
    (progress, resolution) => {
      console.log(`Export ${resolution}: ${progress.toFixed(0)}%`);
    }
  );

  console.log('Export complete:');
  exportResults.forEach(result => {
    console.log(`  ${result.resolution}: ${result.filePath} (${(result.fileSize / 1024 / 1024).toFixed(1)} MB)`);
  });

  const draft = await sdk.saveDraft('深蹲训练 - 未完成', finalProject);
  console.log('Draft saved:', draft.id);

  const drafts = sdk.listDrafts();
  console.log('Total drafts:', drafts.length);

  sdk.shareCallback.on('uploadProgress', (progress) => {
    console.log(`Upload: ${progress.progress.toFixed(1)}% - ${(progress.uploadedBytes / 1024 / 1024).toFixed(1)} MB`);
  });

  sdk.shareCallback.on('playbackEvent', ({ event, state }) => {
    console.log(`Playback ${event}: ${state.currentTime.toFixed(1)}s`);
  });

  sdk.sendPlaybackEvent('play', { currentTime: 0, duration: finalClip.duration, paused: false });

  console.log('All operations completed successfully!');
  sdk.destroy();
}

main().catch(console.error);
