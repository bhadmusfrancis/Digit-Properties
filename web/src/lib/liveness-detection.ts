/**
 * Liveness detection helpers using face-api.js (68-point landmarks).
 * Used by LivenessCamera to auto-advance when face is centred, blink x2, head turn, smile.
 */

export type FaceResult = {
  box: { x: number; y: number; width: number; height: number };
  landmarks: { positions: Array<{ x: number; y: number }> };
};

/** Oval in normalized coords (0-1): center cx, cy; semi axes rx, ry. Vertical face oval: narrower width (rx) than height (ry). */
const OVAL_CX = 0.5;
const OVAL_CY = 0.5;
const OVAL_RX = 0.26;
const OVAL_RY = 0.36;

/** Is point (nx,ny) inside ellipse (cx,cy,rx,ry)? */
function insideEllipse(nx: number, ny: number, cx: number, cy: number, rx: number, ry: number): boolean {
  return ((nx - cx) ** 2) / (rx * rx) + ((ny - cy) ** 2) / (ry * ry) <= 1;
}

/** Face box center and size in normalized [0,1] relative to video width/height. */
export function faceNorm(
  box: { x: number; y: number; width: number; height: number },
  videoWidth: number,
  videoHeight: number
) {
  const cx = (box.x + box.width / 2) / videoWidth;
  const cy = (box.y + box.height / 2) / videoHeight;
  const rw = box.width / videoWidth;
  const rh = box.height / videoHeight;
  return { cx, cy, rw, rh };
}

/** Check face is centred and fits inside the guide oval; face should be roughly frontal (not too small). Stricter so green goes off when face drifts. */
export function checkFaceCentred(
  result: FaceResult,
  videoWidth: number,
  videoHeight: number
): boolean {
  const { box } = result;
  const { cx, cy, rw, rh } = faceNorm(box, videoWidth, videoHeight);
  const margin = 0.06;
  if (rw < 0.12 || rh < 0.12) return false;
  if (rw > OVAL_RX * 2.2 || rh > OVAL_RY * 2.2) return false;
  return (
    insideEllipse(cx, cy, OVAL_CX, OVAL_CY, OVAL_RX - margin, OVAL_RY - margin) &&
    Math.abs(cx - OVAL_CX) < 0.12 &&
    Math.abs(cy - OVAL_CY) < 0.12
  );
}

/** How close the face is to the ideal centre/size (0–1). Used for green glow feedback. */
export function getCentreReadiness(
  result: FaceResult,
  videoWidth: number,
  videoHeight: number
): number {
  const { box } = result;
  const { cx, cy, rw, rh } = faceNorm(box, videoWidth, videoHeight);
  if (rw < 0.12 || rh < 0.12) return 0;
  const distX = Math.abs(cx - OVAL_CX);
  const distY = Math.abs(cy - OVAL_CY);
  const positionScore = 1 - Math.min(1, (distX + distY) / 0.25);
  const inSizeRange = rw >= 0.15 && rh >= 0.15 && rw <= OVAL_RX * 2.2 && rh <= OVAL_RY * 2.2;
  const inside = insideEllipse(cx, cy, OVAL_CX, OVAL_CY, OVAL_RX, OVAL_RY);
  const sizeScore = inSizeRange ? 1 : 0.4;
  const fitScore = inside ? 1 : Math.max(0, positionScore * 0.8);
  return Math.min(1, positionScore * sizeScore * (fitScore || 0.5));
}

/** Eye aspect ratio (EAR) for one eye - 6 points in order (dlib 36-41 / 42-47). Lower = more closed. */
function eyeAspectRatio(points: Array<{ x: number; y: number }>): number {
  if (points.length < 6) return 0.25;
  const [p0, p1, p2, p3, p4, p5] = points;
  const v1 = Math.hypot(p1.x - p5.x, p1.y - p5.y);
  const v2 = Math.hypot(p2.x - p4.x, p2.y - p4.y);
  const h = Math.hypot(p0.x - p3.x, p0.y - p3.y);
  if (h < 1e-6) return 0.08;
  const ear = (v1 + v2) / (2 * h);
  return Math.max(0.05, Math.min(0.5, ear));
}

/** Left eye indices 36-41, right 42-47 in 68-point model. */
export function getEyeEAR(landmarks: { positions: Array<{ x: number; y: number }> }): {
  left: number;
  right: number;
} {
  const p = landmarks.positions;
  if (!p || p.length < 48) return { left: 0.25, right: 0.25 };
  const left = eyeAspectRatio([p[36], p[37], p[38], p[39], p[40], p[41]]);
  const right = eyeAspectRatio([p[42], p[43], p[44], p[45], p[46], p[47]]);
  return { left, right };
}

/** Blink state with optional cooldown to avoid double-count. */
export type BlinkState = {
  count: number;
  wasClosed: boolean;
  maxEAR?: number;
  cooldownFrames?: number;
};

const BLINK_CLOSED_THRESHOLD = 0.08;
const BLINK_OPEN_THRESHOLD = 0.12;
const BLINK_COOLDOWN_FRAMES = 12;

/** Count blinks: eyes go closed (min EAR below threshold) then open (avg above threshold) = 1 blink. */
export function updateBlinkState(
  ear: { left: number; right: number },
  state: BlinkState
): number {
  const minEAR = Math.min(ear.left, ear.right);
  const avgEAR = (ear.left + ear.right) / 2;

  if (state.cooldownFrames !== undefined && state.cooldownFrames > 0) {
    state.cooldownFrames -= 1;
    return state.count;
  }

  const eyesClosed = minEAR < BLINK_CLOSED_THRESHOLD;
  const eyesOpen = avgEAR > BLINK_OPEN_THRESHOLD && ear.left > 0.1 && ear.right > 0.1;

  if (eyesClosed) state.wasClosed = true;
  else if (eyesOpen && state.wasClosed) {
    state.count += 1;
    state.wasClosed = false;
    state.cooldownFrames = BLINK_COOLDOWN_FRAMES;
  }
  return state.count;
}

/** Mouth openness / smile: use upper and lower lip points. 68-model: 48-67 mouth. Simple: mid upper (51) to mid lower (57) distance. */
export function getMouthOpenness(landmarks: { positions: Array<{ x: number; y: number }> }): number {
  const p = landmarks.positions;
  if (!p || p.length < 58) return 0;
  const upper = p[51];
  const lower = p[57];
  const left = p[48];
  const right = p[54];
  const width = Math.hypot(right.x - left.x, right.y - left.y);
  if (width < 1e-6) return 0;
  const height = Math.hypot(lower.x - upper.x, lower.y - upper.y);
  return height / width;
}

const SMILE_THRESHOLD = 0.2;

export function checkSmile(landmarks: { positions: Array<{ x: number; y: number }> }): boolean {
  return getMouthOpenness(landmarks) >= SMILE_THRESHOLD;
}

/** Head turn: face box center x in video (0–1). Left = face left in frame (user turned right), right = face right (user turned left). */
export function getHeadTurnPhase(
  box: { x: number; width: number },
  videoWidth: number
): 'left' | 'centre' | 'right' {
  const cx = (box.x + box.width / 2) / videoWidth;
  if (cx < 0.44) return 'left';
  if (cx > 0.56) return 'right';
  return 'centre';
}

/** Sequence: centre → right (user) → centre → left (user) → centre. Phases: 'left' = face left = user turned right, 'right' = face right = user turned left. */
export function updateHeadTurnState(
  phase: 'left' | 'centre' | 'right',
  state: { step: number; lastPhase: string }
): boolean {
  const steps: ('left' | 'centre' | 'right')[] = ['centre', 'left', 'centre', 'right', 'centre'];
  const next = steps[state.step];
  if (phase === next) {
    if (phase !== state.lastPhase) state.step += 1;
    state.lastPhase = phase;
  } else state.lastPhase = phase;
  return state.step >= steps.length;
}
