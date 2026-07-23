import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const videoDirectory = process.env.CHEAPLIVE_MOTION_VIDEO_DIR;
const evidenceDirectory = process.env.CHEAPLIVE_MOTION_EVIDENCE_DIR;
if (!videoDirectory || !evidenceDirectory) throw new Error('motion-video test environment is incomplete');
const extensions = new Set(['.mp4', '.mov', '.webm', '.m4v']);
const videos = fs.readdirSync(videoDirectory)
  .filter((name) => extensions.has(path.extname(name).toLowerCase()))
  .sort();

test.describe('licensed local motion-video acceptance', () => {
  for (const localFileName of videos) {
    test(localFileName, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.goto('/black-screen/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'cheaplive-motion-video-input';
        input.accept = 'video/*';
        document.body.appendChild(input);
      });
      await page.setInputFiles('#cheaplive-motion-video-input', path.join(videoDirectory, localFileName));

      const metrics = await page.evaluate(async () => {
        const percentile = (values, fraction) => {
          if (!values.length) return 0;
          const sorted = [...values].sort((a, b) => a - b);
          return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
        };
        const input = document.getElementById('cheaplive-motion-video-input');
        const file = input.files?.[0];
        if (!file) throw new Error('video file input is empty');
        const [{ PoseWorkerClient }, { PoseState }] = await Promise.all([
          import('/web/shared/motion/pose-worker-client.js'),
          import('/web/shared/motion/pose-state.js'),
        ]);
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = objectUrl;
        const waitFor = (event) => new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`video ${event} timeout`)), 15_000);
          video.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
          video.addEventListener('error', () => { clearTimeout(timer); reject(new Error('video decode error')); }, { once: true });
        });
        await waitFor('loadedmetadata');

        const poseState = new PoseState({ aspectRatio: video.videoWidth / Math.max(1, video.videoHeight) });
        const inferenceSamples = [];
        const confidenceSamples = [];
        const missing = { shoulder: 0, elbow: 0, wrist: 0 };
        let decodedFrames = 0;
        let inferenceFrames = 0;
        let trackingFrames = 0;
        let trackingLostCount = 0;
        let trackingRecoverCount = 0;
        let rejectedFrames = 0;
        let staleFrames = 0;
        let nanCount = 0;
        let infinityCount = 0;
        let workerErrors = 0;
        let lastTracking = false;
        let lastLandmarks = null;
        let lastTimestamp = null;
        let maxJointSpeed = 0;
        let maxSingleFrameJump = 0;

        function inspectFinite(value) {
          if (typeof value === 'number') {
            if (Number.isNaN(value)) nanCount++;
            else if (!Number.isFinite(value)) infinityCount++;
            return;
          }
          if (value && typeof value === 'object') Object.values(value).forEach(inspectFinite);
        }

        let resolveDone;
        let rejectDone;
        const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
        const client = new PoseWorkerClient({
          workerFactory: () => new Worker('/web/shared/motion/pose-worker-bootstrap.js'),
          createBitmap: (source, options) => createImageBitmap(source, options),
          timeoutMs: 15_000,
          onFrame: (frame) => {
            inferenceFrames++;
            inspectFinite(frame);
            const applied = poseState.apply(frame, frame?.timestampMs ?? performance.now());
            if (!applied.accepted) {
              rejectedFrames++;
              if (String(applied.reason).startsWith('stale') || applied.reason === 'duplicate') staleFrames++;
            }
            const tracking = applied.state?.tracking === true;
            if (tracking) trackingFrames++;
            if (lastTracking && !tracking) trackingLostCount++;
            if (!lastTracking && tracking) trackingRecoverCount++;
            lastTracking = tracking;
            if (Number.isFinite(frame?.confidence)) confidenceSamples.push(frame.confidence);
            const landmarks = frame?.landmarks || {};
            if (!landmarks.leftShoulder || !landmarks.rightShoulder) missing.shoulder++;
            if (!landmarks.leftElbow || !landmarks.rightElbow) missing.elbow++;
            if (!landmarks.leftWrist || !landmarks.rightWrist) missing.wrist++;
            if (lastLandmarks && Number.isFinite(lastTimestamp)) {
              const elapsedSeconds = Math.max(0.001, (frame.timestampMs - lastTimestamp) / 1000);
              for (const [name, point] of Object.entries(landmarks)) {
                const previous = lastLandmarks[name];
                if (!previous || !point) continue;
                const jump = Math.hypot(point.x - previous.x, point.y - previous.y, (point.z || 0) - (previous.z || 0));
                maxSingleFrameJump = Math.max(maxSingleFrameJump, jump);
                maxJointSpeed = Math.max(maxJointSpeed, jump / elapsedSeconds);
              }
            }
            lastLandmarks = landmarks;
            lastTimestamp = frame?.timestampMs;
          },
          onStats: (stats) => {
            if (Number.isFinite(stats.poseInferenceMs)) inferenceSamples.push(stats.poseInferenceMs);
          },
          onStatus: (status, detail) => {
            if (status === 'error') {
              workerErrors++;
              rejectDone(new Error(detail || 'pose worker error'));
            }
          },
        });

        try {
          client.enable({ profile: 'balanced', mirrored: true });
          const readyDeadline = performance.now() + 20_000;
          while (!client.ready && performance.now() < readyDeadline) await new Promise((resolve) => setTimeout(resolve, 25));
          if (!client.ready) throw new Error(client.lastError || 'pose worker ready timeout');
          const startedAt = performance.now();
          video.addEventListener('ended', resolveDone, { once: true });
          video.addEventListener('error', () => rejectDone(new Error('video playback error')), { once: true });
          const submitFrame = (_now, metadata) => {
            if (video.ended) return;
            decodedFrames++;
            void client.process(video, metadata.mediaTime * 1000);
            video.requestVideoFrameCallback(submitFrame);
          };
          video.requestVideoFrameCallback(submitFrame);
          await video.play();
          await done;
          const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            input: {
              width: video.videoWidth,
              height: video.videoHeight,
              durationSeconds: video.duration,
              nominalFps: decodedFrames / Math.max(0.001, video.duration),
            },
            decodedFrames,
            inferenceFrames,
            effectivePoseFps: inferenceFrames / elapsedSeconds,
            averageInferenceMs: inferenceSamples.length ? inferenceSamples.reduce((a, b) => a + b, 0) / inferenceSamples.length : 0,
            p50InferenceMs: percentile(inferenceSamples, 0.5),
            p95InferenceMs: percentile(inferenceSamples, 0.95),
            trackingSuccessRate: inferenceFrames ? trackingFrames / inferenceFrames : 0,
            averageConfidence: confidenceSamples.length ? confidenceSamples.reduce((a, b) => a + b, 0) / confidenceSamples.length : 0,
            trackingLostCount,
            trackingRecoverCount,
            missingShoulderRatio: inferenceFrames ? missing.shoulder / inferenceFrames : 1,
            missingElbowRatio: inferenceFrames ? missing.elbow / inferenceFrames : 1,
            missingWristRatio: inferenceFrames ? missing.wrist / inferenceFrames : 1,
            nanCount,
            infinityCount,
            staleFrames,
            rejectedFrames,
            maxJointSpeed,
            maxSingleFrameJump,
            workerErrors,
          };
        } finally {
          client.disable();
          video.pause();
          video.removeAttribute('src');
          video.load();
          URL.revokeObjectURL(objectUrl);
          input.remove();
        }
      });

      const record = { videoId: path.parse(localFileName).name, localFileName, ...metrics, pageErrors };
      fs.mkdirSync(evidenceDirectory, { recursive: true });
      fs.writeFileSync(path.join(evidenceDirectory, `${path.parse(localFileName).name}.json`), `${JSON.stringify(record, null, 2)}\n`);
      expect(metrics.inferenceFrames).toBeGreaterThan(0);
      expect(metrics.nanCount).toBe(0);
      expect(metrics.infinityCount).toBe(0);
      expect(metrics.workerErrors).toBe(0);
      expect(pageErrors).toEqual([]);
    });
  }
});
