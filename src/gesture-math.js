export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
];

export const ZOOM_MIN = 10;
export const ZOOM_MAX = 500;

export function distance2D(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function estimateHandOrientation(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return null;
  const wrist = landmarks[0];
  const indexBase = landmarks[5];
  const middleBase = landmarks[9];
  const pinkyBase = landmarks[17];
  const across = {
    x: pinkyBase.x - indexBase.x,
    y: pinkyBase.y - indexBase.y,
    z: (pinkyBase.z || 0) - (indexBase.z || 0)
  };
  const towardMiddle = {
    x: middleBase.x - wrist.x,
    y: middleBase.y - wrist.y,
    z: (middleBase.z || 0) - (wrist.z || 0)
  };
  const palmNormal = {
    x: across.y * towardMiddle.z - across.z * towardMiddle.y,
    y: across.z * towardMiddle.x - across.x * towardMiddle.z,
    z: across.x * towardMiddle.y - across.y * towardMiddle.x
  };
  const normalDepth = Math.max(Math.abs(palmNormal.z), 0.001);
  return {
    // La normal de la palma separa la inclinación vertical y horizontal.
    pitch: Math.atan2(-palmNormal.y, normalDepth),
    yaw: Math.atan2(palmNormal.x, normalDepth),
    // Rotación de la palma en el plano de la cámara.
    roll: Math.atan2(across.y, across.x)
  };
}

export function smoothPoint(previous, next, alpha = 0.34) {
  if (!previous) return { ...next };
  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha
  };
}

export function analyzeHandLandmarks(landmarks, options = {}) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) {
    return { detected: false, peace: false, thumbsUp: false, claw: false, pinching: false, threeFingersUp: false, thumbIsCurled: false, openPalm: false, pointing: false, fist: false, pinchRatio: null, palmScale: null, point: null, pointerPoint: null, center: null, orientation: null };
  }

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const middleKnuckle = landmarks[9];
  const palmScale = Math.max(distance2D(wrist, middleKnuckle), 0.001);
  const pinchRatio = distance2D(thumbTip, indexTip) / palmScale;
  const wasPinching = Boolean(options.wasPinching);
  const pinchContact = wasPinching ? pinchRatio <= 0.58 : pinchRatio <= 0.4;
  // El pulgar puede quedar cruzado hacia un borde de la palma en perspectiva;
  // conservamos margen para esa pose, pero no aceptamos un pulgar extendido.
  const thumbIsCurled = distance2D(thumbTip, middleKnuckle) <= palmScale * 1.15;
  const fingerIsExtended = (tipIndex, pipIndex, mcpIndex) => {
    const tipDistance = distance2D(landmarks[tipIndex], wrist);
    const pipDistance = distance2D(landmarks[pipIndex], wrist);
    const mcpDistance = distance2D(landmarks[mcpIndex], wrist);
    return tipDistance > pipDistance * 1.12 && tipDistance - mcpDistance > palmScale * 0.22;
  };
  const indexExtended = fingerIsExtended(8, 7, 5);
  const middleExtended = fingerIsExtended(12, 11, 9);
  const ringExtended = fingerIsExtended(16, 15, 13);
  const pinkyExtended = fingerIsExtended(20, 19, 17);
  const otherFingersCurled = [
    [12, 11, 9],
    [16, 15, 13],
    [20, 19, 17]
  ].every(([tipIndex, pipIndex, mcpIndex]) => !fingerIsExtended(tipIndex, pipIndex, mcpIndex));
  const threeFingersUp = [
    [12, 11, 9],
    [16, 15, 13],
    [20, 19, 17]
  ].every(([tipIndex, pipIndex, mcpIndex]) => fingerIsExtended(tipIndex, pipIndex, mcpIndex));
  const pinching = pinchContact;
  const peace = !pinching && indexExtended && middleExtended && !ringExtended && !pinkyExtended
    && distance2D(indexTip, landmarks[12]) > palmScale * .25;
  const thumbsUp = !indexExtended && otherFingersCurled
    && distance2D(thumbTip, wrist) > distance2D(landmarks[3], wrist) * 1.1
    && distance2D(thumbTip, landmarks[2]) > palmScale * .45
    && thumbTip.y < landmarks[3].y - palmScale * .18
    && thumbTip.y < Math.min(indexTip.y, landmarks[12].y, landmarks[16].y, landmarks[20].y) - palmScale * .25
    && Math.abs(thumbTip.x - landmarks[3].x) < palmScale * .75;
  // De frente, las puntas dobladas pueden proyectarse casi sobre la misma
  // línea que sus nudillos: un ángulo muy cerrado también es una garra.
  const wasClaw = Boolean(options.wasClaw);
  const partiallyBent = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]].map(([base, joint, tip]) => {
    const vector = (from, to) => [to.x - from.x, to.y - from.y, (to.z || 0) - (from.z || 0)];
    const first = vector(landmarks[joint], landmarks[base]);
    const second = vector(landmarks[joint], landmarks[tip]);
    const lengths = Math.hypot(...first) * Math.hypot(...second);
    if (!lengths) return false;
    const cosine = first.reduce((sum, value, i) => sum + value * second[i], 0) / lengths;
    const gap = Math.hypot(...vector(landmarks[base], landmarks[tip])) / palmScale;
    return cosine > (wasClaw ? -0.94 : -0.85) && gap > (wasClaw ? 0.25 : 0.35) && gap < 2.4;
  });
  const claw = !thumbsUp && !peace && !pinching && !indexExtended && !threeFingersUp && partiallyBent[0] && partiallyBent.filter(Boolean).length >= (wasClaw ? 2 : 3);
  const openPalm = !pinching && !claw && [
    [8, 7, 5],
    [12, 11, 9],
    [16, 15, 13],
    [20, 19, 17]
  ].every(([tipIndex, pipIndex, mcpIndex]) => fingerIsExtended(tipIndex, pipIndex, mcpIndex));
  // Los dedos juntos vistos de canto se evalúan en 3D, sin exigir pulgar abierto.
  const straightFingers = [[5,6,8],[9,10,12],[13,14,16],[17,18,20]].filter(([base,joint,tip]) => {
    const vector=(a,b)=>[b.x-a.x,b.y-a.y,(b.z||0)-(a.z||0)];
    const u=vector(landmarks[joint],landmarks[base]),v=vector(landmarks[joint],landmarks[tip]);
    const length=Math.hypot(...u)*Math.hypot(...v);
    if(!length)return false;
    return u.reduce((sum,n,i)=>sum+n*v[i],0)/length < -.88
      && Math.hypot(...vector(wrist,landmarks[tip])) > Math.hypot(...vector(wrist,landmarks[joint]))*1.08;
  }).length;
  const swipePalm = !pinching && !claw && !peace && straightFingers >= 3;
  const pointing = !pinching && !claw && indexExtended && otherFingersCurled;
  const fist = !thumbsUp && !peace && !pinching && !claw && !openPalm && !swipePalm && !pointing && !indexExtended && otherFingersCurled && thumbIsCurled;
  const rawPoint = {
    x: 1 - (thumbTip.x + indexTip.x) / 2,
    y: (thumbTip.y + indexTip.y) / 2
  };
  const rawPointerPoint = {
    x: 1 - indexTip.x,
    y: indexTip.y
  };
  const rawCenter = {
    x: 1 - (wrist.x + middleKnuckle.x) / 2,
    y: (wrist.y + middleKnuckle.y) / 2
  };
  const smoothing = options.smoothing ?? 0.34;

  return {
    detected: true,
    peace,
    thumbsUp,
    claw,
    pinching,
    threeFingersUp,
    thumbIsCurled,
    openPalm,
    swipePalm,
    rawCenter,
    pointing,
    fist,
    pinchRatio,
    palmScale,
    point: smoothPoint(options.previousPoint || null, rawPoint, smoothing),
    pointerPoint: smoothPoint(options.previousPointerPoint || null, rawPointerPoint, smoothing),
    center: smoothPoint(options.previousCenter || null, rawCenter, smoothing),
    orientation: estimateHandOrientation(landmarks)
  };
}

export function analyzeHands(landmarksCollection, options = {}) {
  if (!Array.isArray(landmarksCollection)) return [];

  return landmarksCollection.map((landmarks, index) => ({
    ...analyzeHandLandmarks(landmarks, {
      previousPoint: options.previousPoints?.[index] || null,
      previousPointerPoint: options.previousPointerPoints?.[index] || null,
      previousCenter: options.previousCenters?.[index] || null,
      wasPinching: options.wasPinching?.[index] || false,
      smoothing: options.smoothing
    }),
    landmarks,
    handIndex: index,
    handedness: options.handedness?.[index]?.[0]?.categoryName || null
  }));
}

export function hasTwoHandPinch(hands) {
  return Array.isArray(hands) && hands.length >= 2 && hands.slice(0, 2).every((hand) => hand?.detected && hand.pinching && hand.point);
}

export function classifyTwoHandGesture(distance, maxZoomDistance = 0.28) {
  if (!Number.isFinite(distance) || distance <= 0.02) return "idle";
  return distance <= maxZoomDistance ? "zoom" : "move";
}

export function calculateGestureZoom(startZoom, startDistance, currentDistance, options = {}) {
  const minimum = options.min ?? ZOOM_MIN;
  const maximum = options.max ?? ZOOM_MAX;
  if (!Number.isFinite(startZoom) || !Number.isFinite(startDistance) || startDistance <= 0 || !Number.isFinite(currentDistance)) {
    return Math.max(minimum, Math.min(maximum, startZoom));
  }
  const nextZoom = startZoom * (currentDistance / startDistance);
  return Math.max(minimum, Math.min(maximum, nextZoom));
}

export function estimateGripDepth(basePalmScale, currentPalmScale, options = {}) {
  const gain = options.gain ?? 420;
  const minimum = options.min ?? -160;
  const maximum = options.max ?? 160;
  if (!Number.isFinite(basePalmScale) || basePalmScale <= 0 || !Number.isFinite(currentPalmScale)) return 0;
  const estimatedDepth = ((currentPalmScale / basePalmScale) - 1) * gain;
  return Math.max(minimum, Math.min(maximum, estimatedDepth));
}

export function detectHorizontalSwipe(points, options = {}) {
  const minPoints = options.minPoints ?? 3;
  const minDistance = options.minDistance ?? 0.2;
  const maxDuration = options.maxDuration ?? 650;
  const minDuration = options.minDuration ?? 80;
  const maxVerticalDrift = options.maxVerticalDrift ?? 0.14;
  const minStep = options.minStep ?? 0.008;
  const maxReverseTravel = options.maxReverseTravel ?? 0.06;
  if (!Array.isArray(points) || points.length < minPoints) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const duration = last.time - first.time;
  const deltaX = last.x - first.x;
  const deltaY = last.y - first.y;
  const direction = Math.sign(deltaX);
  if (!direction || duration < minDuration || duration > maxDuration) return null;
  if (Math.abs(deltaX) < minDistance || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return null;
  if (Math.abs(deltaY) > maxVerticalDrift) return null;

  let reverseTravel = 0;
  for (let index = 1; index < points.length; index += 1) {
    const delta = points[index].x - points[index - 1].x;
    if (Math.abs(delta) >= minStep && Math.sign(delta) !== direction) reverseTravel += Math.abs(delta);
  }
  if (reverseTravel > maxReverseTravel) return null;

  return { direction: direction > 0 ? "right" : "left", distance: Math.abs(deltaX), duration };
}

export function clampScenePosition(position) {
  return {
    x: Math.max(6, Math.min(94, position.x)),
    y: Math.max(8, Math.min(92, position.y))
  };
}

export function pickGestureTarget(point, targets, padding = 22) {
  if (!point || !Array.isArray(targets)) return null;

  let nearest = null;
  for (const target of targets) {
    const horizontalGap = Math.max(target.left - point.x, 0, point.x - target.right);
    const verticalGap = Math.max(target.top - point.y, 0, point.y - target.bottom);
    const distance = Math.hypot(horizontalGap, verticalGap);
    if (distance > padding) continue;
    if (!nearest || distance < nearest.distance) nearest = { target, distance };
  }

  return nearest?.target ?? null;
}
