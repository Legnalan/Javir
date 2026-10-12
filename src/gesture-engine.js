import { FilesetResolver, HandLandmarker } from "/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
import { HandTracking } from "./hand-tracking.js";

const WASM_ROOT = "/node_modules/@mediapipe/tasks-vision/wasm";
const MODEL_PATH = "/public/models/hand_landmarker.task";

export class GestureEngine {
  constructor({ video, onFrame, onStatus, targetFps = 15, allowSingleHand = () => false }) {
    this.video = video;
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.allowSingleHand = allowSingleHand;
    this.frameInterval = 1000 / targetFps;
    this.landmarker = null;
    this.active = false;
    this.frameRequest = null;
    this.lastInferenceAt = 0;
    this.lastVideoTime = -1;
    this.previousPoints = [];
    this.previousPointerPoints = [];
    this.previousCenters = [];
    this.wasPinching = [];
    this.tracking = new HandTracking();
  }

  async initialize() {
    if (this.landmarker) return;
    this.onStatus?.("loading", "Preparando seguimiento de mano");
    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const options = {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 6,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, options);
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" }
      });
    }
    this.onStatus?.("ready", "Seguimiento listo para seis manos; muestra tus palmas para tomar control");
  }

  start() {
    if (!this.landmarker || this.active) return;
    this.active = true;
    this.lastInferenceAt = 0;
    this.lastVideoTime = -1;
    this.frameRequest = requestAnimationFrame((timestamp) => this.processFrame(timestamp));
  }

  stop() {
    this.tracking.reset();
    this.active = false;
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = null;
    this.previousPoints = [];
    this.previousPointerPoints = [];
    this.previousCenters = [];
    this.wasPinching = [];
    this.onFrame?.({ detected: false, pinching: false, threeFingersUp: false, thumbIsCurled: false, openPalm: false, pointing: false, fist: false, point: null, pointerPoint: null, center: null, orientation: null, palmScale: null, landmarks: [], hands: [] });
  }

  close() {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }

  processFrame(timestamp) {
    if (!this.active) return;

    const videoReady = this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    const frameIsNew = this.video.currentTime !== this.lastVideoTime;
    if (videoReady && frameIsNew && timestamp - this.lastInferenceAt >= this.frameInterval) {
      this.lastInferenceAt = timestamp;
      this.lastVideoTime = this.video.currentTime;
      try {
        const result = this.landmarker.detectForVideo(this.video, timestamp);
        const {hands,allHands,controlStatus,missingOwner,pendingZoom}=this.tracking.update(result.landmarks||[],result.handedness,timestamp,{allowSingleHand:this.allowSingleHand()});
        const primary = hands[0] || { detected: false, pinching: false, threeFingersUp: false, thumbIsCurled: false, openPalm: false, pointing: false, fist: false, point: null, pointerPoint: null, center: null, orientation: null, palmScale: null, landmarks: [] };
        this.previousPoints = hands.map((hand) => hand.point);
        this.previousPointerPoints = hands.map((hand) => hand.pointerPoint);
        this.previousCenters = hands.map((hand) => hand.center);
        this.wasPinching = hands.map((hand) => hand.pinching);
        this.onFrame?.({
          ...primary,
          allHands,
          controlStatus,
          missingOwner,
          pendingZoom,
          detected: hands.length > 0,
          landmarks: primary.landmarks,
          hands
        });
      } catch (error) {
        this.onStatus?.("error", error.message || "No fue posible procesar la cámara");
      }
    }

    this.frameRequest = requestAnimationFrame((nextTimestamp) => this.processFrame(nextTimestamp));
  }
}
