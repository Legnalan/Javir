import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeHands,
  analyzeHandLandmarks,
  calculateGestureZoom,
  classifyTwoHandGesture,
  clampScenePosition,
  detectHorizontalSwipe,
  estimateHandOrientation,
  estimateGripDepth,
  hasTwoHandPinch,
  pickGestureTarget,
  smoothPoint,
  ZOOM_MAX,
  ZOOM_MIN
} from "../src/gesture-math.js";

function handWithTips(thumbTip, indexTip) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[0] = { x: 0.5, y: 0.8, z: 0 };
  landmarks[9] = { x: 0.5, y: 0.5, z: 0 };
  landmarks[4] = thumbTip;
  landmarks[8] = indexTip;
  return landmarks;
}

function pinchingHand(thumbTip, indexTip) {
  const landmarks = handWithTips(thumbTip, indexTip);
  landmarks[11] = { x: 0.5, y: 0.3, z: 0 };
  landmarks[12] = { x: 0.5, y: 0.1, z: 0 };
  landmarks[13] = { x: 0.65, y: 0.55, z: 0 };
  landmarks[15] = { x: 0.72, y: 0.3, z: 0 };
  landmarks[16] = { x: 0.74, y: 0.1, z: 0 };
  landmarks[17] = { x: 0.8, y: 0.6, z: 0 };
  landmarks[19] = { x: 0.86, y: 0.35, z: 0 };
  landmarks[20] = { x: 0.88, y: 0.12, z: 0 };
  return landmarks;
}

function pointingHand() {
  const landmarks = handWithTips({ x: 0.35, y: 0.55 }, { x: 0.5, y: 0.1 });
  landmarks[5] = { x: 0.5, y: 0.5, z: 0 };
  landmarks[7] = { x: 0.5, y: 0.25, z: 0 };
  return landmarks;
}

function openHand() {
  const landmarks = handWithTips({ x: 0.2, y: 0.58 }, { x: 0.25, y: 0.05 });
  landmarks[5] = { x: 0.35, y: 0.55, z: 0 };
  landmarks[6] = { x: 0.3, y: 0.35, z: 0 };
  landmarks[7] = { x: 0.28, y: 0.18, z: 0 };
  landmarks[9] = { x: 0.5, y: 0.5, z: 0 };
  landmarks[10] = { x: 0.5, y: 0.35, z: 0 };
  landmarks[11] = { x: 0.5, y: 0.2, z: 0 };
  landmarks[12] = { x: 0.5, y: 0.05, z: 0 };
  landmarks[13] = { x: 0.65, y: 0.55, z: 0 };
  landmarks[14] = { x: 0.7, y: 0.35, z: 0 };
  landmarks[15] = { x: 0.72, y: 0.18, z: 0 };
  landmarks[16] = { x: 0.74, y: 0.05, z: 0 };
  landmarks[17] = { x: 0.8, y: 0.6, z: 0 };
  landmarks[18] = { x: 0.85, y: 0.4, z: 0 };
  landmarks[19] = { x: 0.88, y: 0.22, z: 0 };
  landmarks[20] = { x: 0.9, y: 0.08, z: 0 };
  return landmarks;
}

test("detecta una pinza y refleja la coordenada horizontal como espejo", () => {
  const result = analyzeHandLandmarks(pinchingHand({ x: 0.2, y: 0.3 }, { x: 0.22, y: 0.31 }));
  assert.equal(result.detected, true);
  assert.equal(result.pinching, true);
  assert.equal(result.threeFingersUp, true);
  assert.equal(result.thumbIsCurled, false);
  assert.equal(result.fist, false);
  assert.equal(result.point.x > 0.75, true);
  assert.equal(result.pointing, false);
  assert.equal(result.center.x, 0.5);
  assert.equal(Number.isFinite(result.palmScale), true);
});

test("detecta el índice extendido sin confundirlo con una pinza", () => {
  const result = analyzeHandLandmarks(pointingHand());
  assert.equal(result.pointing, true);
  assert.equal(result.pinching, false);
  assert.equal(result.pointerPoint.x, 0.5);
});

test("detecta un puño cerrado como gesto distinto de la mano abierta", () => {
  const result = analyzeHandLandmarks(handWithTips({ x: 0.35, y: 0.65 }, { x: 0.5, y: 0.55 }));
  assert.equal(result.fist, true);
  assert.equal(result.thumbIsCurled, true);
  assert.equal(result.openPalm, false);
  assert.equal(result.pointing, false);
  assert.equal(result.pinching, false);
});

test("identifica la mano abierta y calcula orientación estable desde la palma", () => {
  const result = analyzeHandLandmarks(openHand());
  assert.equal(result.openPalm, true);
  assert.equal(result.pointing, false);
  assert.equal(Number.isFinite(result.orientation.roll), true);
  assert.equal(Number.isFinite(result.orientation.pitch), true);
  assert.deepEqual(result.orientation, estimateHandOrientation(openHand()));
});

test("separa pitch, yaw y roll con la base tridimensional de la palma", () => {
  const tiltedHand = openHand();
  tiltedHand[5].z = 0.08;
  tiltedHand[9].z = -0.04;
  tiltedHand[17].z = -0.24;
  tiltedHand[12].z = -0.08;
  const flat = estimateHandOrientation(openHand());
  const tilted = estimateHandOrientation(tiltedHand);
  assert.notEqual(Math.round(tilted.pitch * 100), Math.round(flat.pitch * 100));
  assert.notEqual(Math.round(tilted.yaw * 100), Math.round(flat.yaw * 100));
  assert.equal(Number.isFinite(tilted.roll), true);
});

test("analiza dos manos y conserva un centro para el zoom", () => {
  const secondHand = handWithTips({ x: 0.7, y: 0.4 }, { x: 0.72, y: 0.41 });
  secondHand[0] = { x: 0.2, y: 0.8, z: 0 };
  secondHand[9] = { x: 0.2, y: 0.5, z: 0 };
  const result = analyzeHands([
    pinchingHand({ x: 0.2, y: 0.3 }, { x: 0.22, y: 0.31 }),
    secondHand
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].detected, true);
  assert.equal(result[1].center.x, 0.8);
});

test("mantiene histéresis y libera la pinza cuando los dedos se separan", () => {
  const nearRelease = analyzeHandLandmarks(pinchingHand({ x: 0.3, y: 0.3 }, { x: 0.45, y: 0.3 }), { wasPinching: true });
  const released = analyzeHandLandmarks(pinchingHand({ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.3 }), { wasPinching: true });
  assert.equal(nearRelease.pinching, true);
  assert.equal(released.pinching, false);
});

test("no confunde una pinza sin los tres dedos arriba con un puño válido", () => {
  const result = analyzeHandLandmarks(handWithTips({ x: 0.35, y: 0.65 }, { x: 0.36, y: 0.64 }));
  assert.equal(result.pinching, false);
  assert.equal(result.threeFingersUp, false);
  assert.equal(result.fist, true);
});

test("no activa el puño si el pulgar permanece fuera de la palma", () => {
  const landmarks = handWithTips({ x: 0.08, y: 0.8 }, { x: 0.5, y: 0.55 });
  const result = analyzeHandLandmarks(landmarks);
  assert.equal(result.thumbIsCurled, false);
  assert.equal(result.fist, false);
});

test("suaviza puntos y limita posiciones a la zona segura de la escena", () => {
  assert.deepEqual(smoothPoint({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.25), { x: 0.25, y: 0.25 });
  assert.deepEqual(clampScenePosition({ x: -10, y: 140 }), { x: 6, y: 92 });
});

test("elige la card bajo el cursor aunque otra estuviera seleccionada", () => {
  const targets = [
    { id: "billing", left: 10, right: 110, top: 10, bottom: 80 },
    { id: "reports", left: 180, right: 280, top: 120, bottom: 190 }
  ];

  assert.equal(pickGestureTarget({ x: 220, y: 150 }, targets)?.id, "reports");
});

test("usa una zona magnética pequeña y no toma cards lejanas", () => {
  const targets = [{ id: "api", left: 100, right: 180, top: 100, bottom: 160 }];

  assert.equal(pickGestureTarget({ x: 192, y: 130 }, targets, 22)?.id, "api");
  assert.equal(pickGestureTarget({ x: 220, y: 130 }, targets, 22), null);
});

test("calcula zoom proporcional entre los centros de dos manos y respeta un rango amplio", () => {
  assert.equal(calculateGestureZoom(100, 0.25, 0.5), 200);
  assert.equal(calculateGestureZoom(100, 0.5, 0.01), ZOOM_MIN);
  assert.equal(calculateGestureZoom(100, 0.25, 2), ZOOM_MAX);
  assert.equal(calculateGestureZoom(100, 0.25, 0.3), 120);
});

test("estima profundidad relativa sin presentarla como medición física", () => {
  assert.equal(Math.round(estimateGripDepth(0.1, 0.12)), 84);
  assert.equal(Math.round(estimateGripDepth(0.1, 0.08)), -84);
  assert.equal(estimateGripDepth(0.1, 0.2), 160);
});

test("solo habilita el zoom cuando las dos manos están haciendo pinza", () => {
  const pinchingHands = [
    { detected: true, pinching: true, point: { x: 0.2, y: 0.5 } },
    { detected: true, pinching: true, point: { x: 0.8, y: 0.5 } }
  ];
  assert.equal(hasTwoHandPinch(pinchingHands), true);
  assert.equal(hasTwoHandPinch([{ detected: true, pinching: false, point: { x: 0.2, y: 0.5 } }, pinchingHands[1]]), false);
});

test("distingue zoom general de movimiento doble por la distancia inicial", () => {
  assert.equal(classifyTwoHandGesture(0.18), "zoom");
  assert.equal(classifyTwoHandGesture(0.28), "zoom");
  assert.equal(classifyTwoHandGesture(0.42), "move");
  assert.equal(classifyTwoHandGesture(0.01), "idle");
});

test("detecta un barrido horizontal corto, de una sola dirección", () => {
  const points = [
    { x: 0.2, y: 0.5, time: 0 },
    { x: 0.28, y: 0.51, time: 120 },
    { x: 0.38, y: 0.5, time: 240 },
    { x: 0.46, y: 0.51, time: 340 }
  ];
  assert.equal(detectHorizontalSwipe(points)?.direction, "right");
  assert.equal(detectHorizontalSwipe([{ x: 0.2, y: 0.5, time: 0 }, { x: 0.42, y: 0.5, time: 800 }]), null);
  assert.equal(detectHorizontalSwipe([{ x: 0.2, y: 0.5, time: 0 }, { x: 0.36, y: 0.5, time: 120 }, { x: 0.24, y: 0.5, time: 240 }, { x: 0.5, y: 0.5, time: 360 }]), null);
  assert.equal(detectHorizontalSwipe([{ x: 0.2, y: 0.2, time: 0 }, { x: 0.32, y: 0.38, time: 140 }, { x: 0.45, y: 0.4, time: 280 }]), null);
});
