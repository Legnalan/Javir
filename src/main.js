import {
  cloneScene,
  createObject,
  findObject,
  initialScene,
  objectTypes,
  serializeScene,
  validScene
} from "./scene-model.js";
import { GestureEngine } from "./gesture-engine.js";
import {
  HAND_CONNECTIONS,
  calculateGestureZoom,
  classifyTwoHandGesture,
  clampScenePosition,
  detectHorizontalSwipe,
  distance2D,
  estimateGripDepth,
  hasTwoHandPinch,
  pickGestureTarget,
  ZOOM_MAX,
  ZOOM_MIN
} from "./gesture-math.js";

const STORAGE_KEY = "javir-scene-v1";
const runtimeConfig = { defaultRepository: "" };
const TWO_HAND_ZOOM_MAX_DISTANCE = 0.28;
const ROTATION_ANCHOR_STEP_LIMIT = 0.022;
const ROTATION_ANCHOR_DRIFT_LIMIT = 0.055;
const ROTATION_STABLE_FRAMES = 6;
const ROTATION_ORIENTATION_DEADZONE = 0.018;
const ROTATION_TRANSLATION_DEADZONE = 0.012;
const DEFAULT_SCENE_ROTATION = { x: -18, y: 28, z: 0 };
const DEFAULT_OBJECT_DEPTH = {
  application: -120,
  api: -55,
  module: 10,
  database: 115,
  external: 115,
  service: 72
};
document.documentElement.dataset.gestureBuild = "orbit-pan-zoom-billboard-v1-project-index-hologram";
const iconPaths = {
  plus: '<path d="M12 5v14M5 12h14" />',
  minus: '<path d="M5 12h14" />',
  menu: '<path d="M4 6h16M4 12h16M4 18h16" />',
  close: '<path d="m6 6 12 12M18 6 6 18" />',
  help: '<circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 4.1 1.7c-.9.8-1.8 1.1-1.8 2.6" /><path d="M12 16.6h.01" />',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.1-1.5h4.8L15.5 6h2A2.5 2.5 0 0 1 20 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5z" /><circle cx="12" cy="12" r="3.2" />',
  "camera-off": '<path d="m4 4 16 16M10.2 6H15l1.1 1.5h1.4A2.5 2.5 0 0 1 20 10v5.5" /><path d="M4 8.5A2.5 2.5 0 0 0 4 9v6.5A2.5 2.5 0 0 0 6.5 18h11" /><path d="M8.8 6H6.5A2.5 2.5 0 0 0 4 8.5" />',
  hand: '<path d="M8 11V6a2 2 0 0 1 4 0v5-1V5a2 2 0 0 1 4 0v6-1V7a2 2 0 0 1 4 0v7a7 7 0 0 1-7 7h-1c-2.2 0-4.3-1.1-5.6-2.9L5 14.6A2 2 0 0 1 8 12l2 1.5" />',
  save: '<path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h8V4M8 20v-6h8v6" />',
  undo: '<path d="M9 8 5 12l4 4" /><path d="M5 12h8a5 5 0 0 1 5 5v1" />',
  center: '<circle cx="12" cy="12" r="3" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" />',
  move: '<path d="m8 5 4-2 4 2M8 19l4 2 4-2M5 8l-2 4 2 4M19 8l2 4-2 4M12 3v18M3 12h18" />',
  node: '<rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 9h6v6H9zM9 12H6M15 12h3M12 9V6M12 15v3" />',
  scan: '<path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" /><path d="M7 12h10M12 7v10" />',
  shield: '<path d="M12 3 19 6v5c0 4.4-2.8 7.5-7 10-4.2-2.5-7-5.6-7-10V6z" /><path d="m9 12 2 2 4-4" />',
  spark: '<path d="m12 3 1.2 5.8L19 10l-5.8 1.2L12 17l-1.2-5.8L5 10l5.8-1.2z" /><path d="m19 16 .5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5z" />',
  mic: '<path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />',
  "arrow-up": '<path d="M12 19V5M6 11l6-6 6 6" />',
  layers: '<path d="m12 4 8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />',
  "arrow-up-small": '<path d="m7 14 5-5 5 5" />',
  "arrow-down-small": '<path d="m7 10 5 5 5-5" />',
  "arrow-left-small": '<path d="m14 7-5 5 5 5" />',
  "arrow-right-small": '<path d="m10 7 5 5-5 5" />'
};

const typeLabels = Object.fromEntries(objectTypes.map((type) => [type.value, type.label]));
const typeIcons = {
  application: "node",
  api: "layers",
  module: "node",
  database: "save",
  external: "arrow-up",
  service: "scan"
};

const elements = {
  manualMenu: document.querySelector("#manual-menu"),
  manualMenuContent: document.querySelector("#manual-menu-content"),
  menuAnchor: document.querySelector("#menu-anchor"),
  manualMenuClose: document.querySelector("#manual-menu-close"),
  topbar: document.querySelector(".topbar"),
  sidebar: document.querySelector(".sidebar"),
  pageHeading: document.querySelector(".page-heading"),
  sceneToolbar: document.querySelector(".scene-toolbar"),
  sceneFooter: document.querySelector(".scene-footer"),
  commandSection: document.querySelector(".command-section"),
  nodes: document.querySelector("#scene-nodes"),
  sceneStage: document.querySelector("#scene-stage"),
  sceneCamera: document.querySelector("#scene-camera"),
  edges: document.querySelector("#scene-edges"),
  viewport: document.querySelector("#scene-viewport"),
  inspector: document.querySelector(".inspector"),
  inspectorContent: document.querySelector("#inspector-content"),
  sceneCount: document.querySelector("#scene-count"),
  sceneName: document.querySelector("#scene-name"),
  sceneFootnote: document.querySelector("#scene-footnote"),
  commandForm: document.querySelector("#command-form"),
  commandInput: document.querySelector("#command-input"),
  commandStatus: document.querySelector("#command-status"),
  cameraState: document.querySelector("#camera-state"),
  cameraLayer: document.querySelector("#camera-layer"),
  cameraPreview: document.querySelector("#camera-preview"),
  cameraToggle: document.querySelector("#camera-toggle"),
  gestureToggle: document.querySelector("#gesture-toggle"),
  gestureCanvas: document.querySelector("#gesture-canvas"),
  gestureOverlay: document.querySelector("#gesture-overlay"),
  gestureStatus: document.querySelector("#gesture-status"),
  gestureHint: document.querySelector("#gesture-hint"),
  gestureDetailButton: document.querySelector("#gesture-detail-button"),
  spatialDepthReadout: document.querySelector("#spatial-depth-readout"),
  spatialRecenter: document.querySelector("#spatial-recenter"),
  voiceButton: document.querySelector("#voice-button"),
  zoomReadout: document.querySelector("#zoom-readout"),
  undoButton: document.querySelector("#undo-button"),
  toastRegion: document.querySelector("#toast-region"),
  objectDialog: document.querySelector("#object-dialog"),
  objectForm: document.querySelector("#object-form"),
  objectName: document.querySelector("#object-name"),
  objectType: document.querySelector("#object-type"),
  analysisDialog: document.querySelector("#analysis-dialog"),
  analysisForm: document.querySelector("#analysis-form"),
  analysisPath: document.querySelector("#analysis-path"),
  sourceDialog: document.querySelector("#source-dialog"),
  sourceMeta: document.querySelector("#source-meta"),
  sourceStatus: document.querySelector("#source-status"),
  sourceContent: document.querySelector("#source-content"),
  sceneEmpty: document.querySelector("#scene-empty")
};

let scene = loadScene();
let selectedId = scene.objects[0]?.id || null;
let history = [];
let zoom = 100;
let cameraStream = null;
let solarDemo = null;
let cameraRequestVersion = 0;
let gestureEngine = null;
let gestureMoveState = null;
let gestureZoomState = null;
let gestureTwoHandState = null;
let gestureMultiMoveState = null;
let sceneSpatialState = null;
let sceneSpatialTransform = { x: 0, y: 0, z: 0 };
let spatialCalibrationVersion = 0;
let gestureDismissState = null;
let gestureRotationState = null;
let gestureHoverId = null;
let gestureSelectionId = null;
let gestureSelectionIds = [null, null];
let sceneRotation = { ...DEFAULT_SCENE_ROTATION };
let gestureMissingFrames = 0;
let gestureUiFrame = 0;
let recognition = null;
let dragState = null;
let draggedId = null;
let manualMenuHoverSince = 0;
let manualMenuLastFocus = null;
let toastTimer;

function icon(name, className = "") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.node}</svg>`;
}

function mountManualMenu() {
  const content = elements.manualMenuContent;
  if (!content) return;
  [elements.topbar, elements.sidebar, elements.pageHeading, elements.sceneToolbar, elements.commandSection, elements.sceneFooter, elements.inspector]
    .filter(Boolean)
    .forEach((element) => content.append(element));
}

function setManualMenuOpen(open, { focus = false } = {}) {
  if (!elements.manualMenu || !elements.menuAnchor) return;
  const nextOpen = Boolean(open);
  if (nextOpen && !elements.manualMenu.hidden) return;
  if (nextOpen) manualMenuLastFocus = document.activeElement;
  elements.manualMenu.hidden = !nextOpen;
  elements.manualMenu.setAttribute("aria-hidden", String(!nextOpen));
  elements.menuAnchor.setAttribute("aria-expanded", String(nextOpen));
  elements.manualMenu.classList.toggle("is-open", nextOpen);
  if (nextOpen && focus) elements.manualMenuClose?.focus({ preventScroll: true });
  if (!nextOpen && manualMenuLastFocus?.focus) {
    manualMenuLastFocus.focus({ preventScroll: true });
    manualMenuLastFocus = null;
  }
}

function clearManualMenuGestureTarget() {
  manualMenuHoverSince = 0;
  elements.menuAnchor?.classList.remove("is-gesture-target");
}

function updateManualMenuGestureTarget(point) {
  if (!point || !elements.menuAnchor || !elements.viewport || !elements.manualMenu.hidden) {
    clearManualMenuGestureTarget();
    return false;
  }
  const viewportRect = elements.viewport.getBoundingClientRect();
  const cursor = {
    x: viewportRect.left + point.x * viewportRect.width,
    y: viewportRect.top + point.y * viewportRect.height
  };
  const anchorRect = elements.menuAnchor.getBoundingClientRect();
  const inside = cursor.x >= anchorRect.left && cursor.x <= anchorRect.right && cursor.y >= anchorRect.top && cursor.y <= anchorRect.bottom;
  elements.menuAnchor.classList.toggle("is-gesture-target", inside);
  if (!inside) {
    manualMenuHoverSince = 0;
    return false;
  }
  manualMenuHoverSince ||= performance.now();
  if (performance.now() - manualMenuHoverSince >= 360) {
    setManualMenuOpen(true);
    clearManualMenuGestureTarget();
  }
  return true;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return value.toLocaleLowerCase("es-MX").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function loadScene() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return validScene(saved) ? saved : cloneScene(initialScene);
  } catch {
    return cloneScene(initialScene);
  }
}

function pushHistory(sceneSnapshot = scene, rotationSnapshot = sceneRotation, spatialSnapshot = sceneSpatialTransform) {
  history.push({
    scene: cloneScene(sceneSnapshot),
    rotation: { ...rotationSnapshot },
    spatial: { ...spatialSnapshot }
  });
}

function findObjectByText(text) {
  const query = normalizeText(text);
  return scene.objects.find((object) => normalizeText(object.title).includes(query) || query.includes(normalizeText(object.title))) || null;
}

function getMetadata(object) {
  return objectTypes.find((type) => type.value === object.type) || objectTypes[2];
}

function updateSceneSummary() {
  elements.sceneCount.textContent = `${String(scene.objects.length).padStart(2, "0")} objetos · ${String(scene.relations.length).padStart(2, "0")} relaciones`;
  elements.sceneName.textContent = scene.name || "Escena sin nombre";
  elements.undoButton.disabled = history.length === 0;
  elements.sceneEmpty.hidden = scene.objects.length > 0;
}

function getSceneDepth(object) {
  const savedDepth = Number(object?.z);
  if (Number.isFinite(savedDepth)) return Math.max(-180, Math.min(180, savedDepth));
  const signature = String(object?.id || object?.title || "scene").split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const spread = (signature % 5 - 2) * 26;
  return Math.max(-180, Math.min(180, (DEFAULT_OBJECT_DEPTH[object?.type] ?? DEFAULT_OBJECT_DEPTH.module) + spread));
}

function renderEdges() {
  const viewportRect = elements.viewport.getBoundingClientRect();
  const lines = scene.relations.map((relation) => {
    const from = findObject(scene, relation.from);
    const to = findObject(scene, relation.to);
    if (!from || !to) return "";
    const fromDepth = getSceneDepth(from);
    const toDepth = getSceneDepth(to);
    const fromX = (from.x / 100) * viewportRect.width;
    const fromY = (from.y / 100) * viewportRect.height;
    const toX = (to.x / 100) * viewportRect.width;
    const toY = (to.y / 100) * viewportRect.height;
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const deltaZ = toDepth - fromDepth;
    const planarLength = Math.hypot(deltaX, deltaY) || 1;
    const length = Math.hypot(planarLength, deltaZ);
    const angleZ = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    const angleY = Math.atan2(deltaZ, planarLength) * 180 / Math.PI;
    const midpointX = (from.x + to.x) / 2;
    const midpointY = (from.y + to.y) / 2;
    const midpointZ = (fromDepth + toDepth) / 2;
    return `<span class="scene-edge-line" aria-hidden="true" style="left:${from.x}%;top:${from.y}%;width:${length}px;transform:translate3d(0,0,${fromDepth}px) rotateZ(${angleZ}deg) rotateY(${angleY}deg)"></span><span class="scene-edge-dot" aria-hidden="true" style="left:${midpointX}%;top:${midpointY}%;transform:translate3d(-50%,-50%,${midpointZ}px)"></span>`;
  }).join("");
  elements.edges.innerHTML = lines;
}

function updateVisualPositions() {
  scene.objects.forEach((object) => {
    const node = elements.nodes.querySelector(`[data-id="${CSS.escape(object.id)}"]`);
    if (!node) return;
    const anchor = node.closest(".scene-node-anchor") || node;
    anchor.style.setProperty("--x", `${object.x}%`);
    anchor.style.setProperty("--y", `${object.y}%`);
    anchor.style.setProperty("--node-z", `${getSceneDepth(object)}px`);
  });
  updateSceneRotation();
}

function updateSceneRotation() {
  const camera = elements.sceneCamera || elements.sceneStage;
  if (!camera || !elements.sceneStage) return;
  camera.style.setProperty("--scene-rotate-x", `${sceneRotation.x}deg`);
  camera.style.setProperty("--scene-rotate-y", `${sceneRotation.y}deg`);
  camera.style.setProperty("--scene-rotate-z", `${sceneRotation.z}deg`);
  camera.style.setProperty("--scene-counter-rotate-x", `${-sceneRotation.x}deg`);
  camera.style.setProperty("--scene-counter-rotate-y", `${-sceneRotation.y}deg`);
  camera.style.setProperty("--scene-counter-rotate-z", `${-sceneRotation.z}deg`);
  updateSceneBillboards(camera);
  elements.sceneStage.style.setProperty("--scene-translate-x", `${sceneSpatialTransform.x}px`);
  elements.sceneStage.style.setProperty("--scene-translate-y", `${sceneSpatialTransform.y}px`);
  elements.sceneStage.style.setProperty("--scene-depth", `${sceneSpatialTransform.z}px`);
  elements.sceneStage.style.setProperty("--scene-scale", String(zoom / 100));
  camera.classList.toggle("is-gesture-rotating", Boolean(gestureRotationState));
  elements.sceneStage.classList.toggle("is-spatial-controlled", Boolean(sceneSpatialState?.active || gestureRotationState));
  updateSpatialDepthReadout();
  renderEdges();
}

function updateSceneBillboards(camera) {
  const fallback = `rotateZ(var(--scene-counter-rotate-z, 0deg)) rotateY(var(--scene-counter-rotate-y, 0deg)) rotateX(var(--scene-counter-rotate-x, 0deg))`;
  let billboardTransform = fallback;
  if (typeof DOMMatrix === "function") {
    try {
      const cameraTransform = getComputedStyle(camera).transform;
      if (cameraTransform && cameraTransform !== "none") {
        const inverse = new DOMMatrix(cameraTransform).inverse();
        billboardTransform = `matrix3d(${Array.from(inverse.toFloat64Array()).join(",")})`;
      }
    } catch {
      billboardTransform = fallback;
    }
  }
  elements.nodes?.querySelectorAll(".scene-node").forEach((node) => {
    node.style.setProperty("--scene-billboard-transform", billboardTransform);
  });
}

function renderNodes() {
  elements.nodes.classList.toggle("is-dense", scene.objects.length > 10);
  elements.nodes.innerHTML = scene.objects.map((object) => {
    const metadata = getMetadata(object);
    const selected = object.id === selectedId;
    return `<span class="scene-node-anchor" style="--x:${object.x}%;--y:${object.y}%;--node-z:${getSceneDepth(object)}px">
      <button class="scene-node${selected ? " is-selected" : ""}" type="button" data-id="${escapeHTML(object.id)}" aria-pressed="${selected}" aria-label="${escapeHTML(`${object.title}, ${metadata.label}`)}" style="--node-color:var(--color-hologram-bright);--node-type-color:var(--color-${metadata.color})">
        <span class="node-topline"><span class="node-kind">${escapeHTML(metadata.label)}</span><span class="node-status" aria-hidden="true"></span></span>
        <span class="node-title-line"><span class="node-title">${escapeHTML(object.title)}</span></span>
        <span class="node-subtitle">${escapeHTML(object.subtitle)}</span>
        <span class="node-origin">${escapeHTML(object.sourceRefs[0] || "sin referencia")}</span>
      </button>
    </span>`;
  }).join("");

  elements.nodes.querySelectorAll(".scene-node").forEach((node) => {
    node.addEventListener("click", () => {
      if (draggedId === node.dataset.id) {
        draggedId = null;
        return;
      }
      selectObject(node.dataset.id);
    });
    node.addEventListener("pointerdown", (event) => beginDrag(event, node.dataset.id));
    node.addEventListener("keydown", (event) => {
      if (!selectedId || node.dataset.id !== selectedId) return;
      const step = event.shiftKey ? 5 : 2;
      const moves = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
      if (moves[event.key]) {
        event.preventDefault();
        moveObject(node.dataset.id, ...moves[event.key], "Movimiento por teclado");
      }
    });
  });
}

function renderInspector() {
  const object = selectedId ? findObject(scene, selectedId) : null;
  if (!object) {
    elements.inspectorContent.innerHTML = `<div class="empty-inspector"><span class="empty-icon">${icon("node")}</span><p>Selecciona un objeto de la escena para ver su identidad, origen y relaciones.</p></div>`;
    return;
  }

  const metadata = getMetadata(object);
  const incoming = scene.relations.filter((relation) => relation.to === object.id).map((relation) => ({ relation, object: findObject(scene, relation.from) })).filter((entry) => entry.object);
  const outgoing = scene.relations.filter((relation) => relation.from === object.id).map((relation) => ({ relation, object: findObject(scene, relation.to) })).filter((entry) => entry.object);
  const relationMarkup = [...incoming.map(({ relation, object: related }) => `<div class="relation-row"><span>← <strong>${escapeHTML(related.title)}</strong></span><span>${escapeHTML(relation.label)}</span></div>`), ...outgoing.map(({ relation, object: related }) => `<div class="relation-row"><span>→ <strong>${escapeHTML(related.title)}</strong></span><span>${escapeHTML(relation.label)}</span></div>`)].join("");

  const analysisMarkup = scene.analysis ? `<section class="inspector-block"><span class="inspector-label">Análisis local</span><p class="inspector-description">${escapeHTML(scene.analysis.fileCount)} archivos revisados · ${escapeHTML(scene.analysis.excludedCount)} excluidos · ${escapeHTML(scene.analysis.samples?.length || 0)} muestras.</p><p class="inspector-description">${escapeHTML(scene.analysis.symbolCount || 0)} símbolos · ${escapeHTML(scene.analysis.importCount || 0)} imports observados · ${scene.analysis.truncated ? "Límite alcanzado." : "Límite no alcanzado."}</p><ul class="source-list">${scene.analysis.excludedPaths?.slice(0, 4).map((entry) => `<li><code>${escapeHTML(entry.path)} · ${escapeHTML(entry.reason)}</code></li>`).join("") || "<li><code>Sin exclusiones registradas</code></li>"}</ul></section>` : "";
  const structureMarkup = object.symbols?.length || object.imports?.length ? `<section class="inspector-block"><span class="inspector-label">Estructura observada</span>${object.symbols?.length ? `<p class="inspector-description">${object.symbols.length} símbolos detectados</p><ul class="source-list compact-list">${object.symbols.slice(0, 8).map((symbol) => `<li><code>${escapeHTML(symbol.name)} · ${escapeHTML(symbol.source)}</code></li>`).join("")}</ul>` : ""}${object.imports?.length ? `<p class="inspector-description structure-subheading">${object.imports.length} imports locales detectados</p>` : ""}</section>` : "";

  elements.inspectorContent.innerHTML = `<div class="inspector-body">
    <section class="selected-object-card" style="--node-color:var(--color-${metadata.color})">
      <div class="selected-object-title"><span class="object-symbol">${icon(typeIcons[object.type] || "node")}</span><div><h3>${escapeHTML(object.title)}</h3><p>${escapeHTML(object.subtitle)}</p></div></div>
      <div class="inspector-tag-row"><span class="inspector-tag">${escapeHTML(metadata.label)}</span><span class="inspector-tag">ID: ${escapeHTML(object.id)}</span></div>
    </section>
    <section class="inspector-block"><span class="inspector-label">Estado y posición</span><div class="inspector-meta"><span class="status-label" style="--node-color:var(--color-${metadata.color})">${escapeHTML(statusLabel(object.status))}</span><code>${Math.round(object.x)}%, ${Math.round(object.y)}% · Z ${Math.round(getSceneDepth(object))}</code></div><div class="move-controls" aria-label="Mover objeto seleccionado"><button type="button" data-move="0,-5" aria-label="Mover arriba" title="Mover arriba">${icon("arrow-up-small")}</button><button type="button" data-move="-5,0" aria-label="Mover a la izquierda" title="Mover a la izquierda">${icon("arrow-left-small")}</button><button type="button" data-move="0,5" aria-label="Mover abajo" title="Mover abajo">${icon("arrow-down-small")}</button><button type="button" data-move="5,0" aria-label="Mover a la derecha" title="Mover a la derecha">${icon("arrow-right-small")}</button></div></section>
    <section class="inspector-block"><span class="inspector-label">Descripción</span><p class="inspector-description">${escapeHTML(object.description)}</p></section>
    <section class="inspector-block"><span class="inspector-label">Relaciones (${incoming.length + outgoing.length})</span><div class="relation-list">${relationMarkup || "<span class=\"muted-text\">Sin relaciones registradas.</span>"}</div></section>
    ${structureMarkup}
    <section class="inspector-block"><span class="source-label">Referencias de origen</span><ul class="source-list">${object.sourceRefs.map((source) => `<li>${renderSourceReference(source)}</li>`).join("")}</ul></section>
    ${analysisMarkup}
  </div>`;

  elements.inspectorContent.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const [x, y] = button.dataset.move.split(",").map(Number);
      moveObject(object.id, x, y, "Movimiento desde inspector");
    });
  });
  elements.inspectorContent.querySelectorAll("[data-source-file]").forEach((button) => {
    button.addEventListener("click", () => openSourceViewer(button.dataset.sourceFile));
  });
}

function isInspectableSource(source) {
  return Boolean(scene.analysis && source && source !== "." && !source.startsWith("demo://") && !source.startsWith("local://") && !source.startsWith("heuristic://"));
}

function renderSourceReference(source) {
  const label = `<code>${escapeHTML(source)}</code>`;
  return isInspectableSource(source) ? `<button class="source-link" type="button" data-source-file="${escapeHTML(source)}" aria-label="Abrir ${escapeHTML(source)} en solo lectura">${icon("scan")}${label}</button>` : label;
}

function statusLabel(status) {
  return { active: "Activo", attention: "Revisar", external: "Externo", new: "Nuevo" }[status] || "Sin estado";
}

function render() {
  updateSceneSummary();
  renderNodes();
  renderInspector();
  updateSceneRotation();
  elements.zoomReadout.textContent = `${zoom}%`;
}

function selectObject(id, { focus = true } = {}) {
  if (!findObject(scene, id)) return;
  selectedId = id;
  renderNodes();
  renderInspector();
  elements.inspector.classList.add("is-open");
  const selectedNode = elements.nodes.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (focus) selectedNode?.focus({ preventScroll: true });
}

function commit(mutator, message, nextSelectedId = selectedId) {
  pushHistory();
  scene = cloneScene(scene);
  mutator(scene);
  selectedId = nextSelectedId;
  render();
  if (message) showToast(message);
}

function moveObject(id, deltaX, deltaY, message) {
  const object = findObject(scene, id);
  if (!object) return;
  commit((draft) => {
    const target = findObject(draft, id);
    target.x = Math.max(6, Math.min(94, target.x + deltaX));
    target.y = Math.max(8, Math.min(92, target.y + deltaY));
  }, message);
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  scene = previous.scene || previous;
  sceneRotation = previous.rotation ? { ...previous.rotation } : { ...DEFAULT_SCENE_ROTATION };
  sceneSpatialTransform = previous.spatial ? { ...previous.spatial } : { x: 0, y: 0, z: 0 };
  if (!findObject(scene, selectedId)) selectedId = scene.objects[0]?.id || null;
  render();
  showToast("Se deshizo el último cambio");
}

function saveScene() {
  localStorage.setItem(STORAGE_KEY, serializeScene(scene));
  elements.sceneFootnote.textContent = `Guardado local · ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
  showToast("Escena guardada en este dispositivo");
}

function addSceneObject(title, type) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return;
  const idBase = normalizeText(normalizedTitle).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "objeto";
  let id = idBase;
  let suffix = 2;
  while (findObject(scene, id)) id = `${idBase}-${suffix++}`;
  const selected = selectedId ? findObject(scene, selectedId) : null;
  const x = selected ? Math.min(84, selected.x + 10) : 52;
  const y = selected ? Math.min(88, selected.y + 14) : 78;
  const object = createObject({ id, title: normalizedTitle, type, x, y });
  commit((draft) => {
    draft.objects.push(object);
    if (selected) draft.relations.push({ id: `${selected.id}-${object.id}`, from: selected.id, to: object.id, label: "explora" });
  }, `${normalizedTitle} se agregó a la escena`, object.id);
}

function openObjectDialog() {
  elements.objectForm.reset();
  elements.objectDialog.showModal();
  requestAnimationFrame(() => elements.objectName.focus());
}

function openAnalysisDialog() {
  elements.analysisPath.value = runtimeConfig.defaultRepository;
  elements.analysisDialog.showModal();
  requestAnimationFrame(() => {
    elements.analysisPath.focus();
    elements.analysisPath.select();
  });
}

function startNewSession() {
  const shouldReset = scene.objects.length <= initialScene.objects.length || window.confirm("¿Crear una nueva escena y descartar los cambios no guardados?");
  if (!shouldReset) return;
  commit((draft) => Object.assign(draft, cloneScene(initialScene)), "Nueva sesión creada", "billing");
  elements.sceneFootnote.textContent = "Fuente: escena de demostración · relaciones verificables pendientes";
}

function showHelp() {
  showToast("Gestos: índice selecciona; pinza = índice y pulgar juntos con los otros tres dedos arriba para mover una card; dos manos abiertas hacen paneo; puño + palma abierta fija orbitan y desplazan el diagrama; barrido lateral retira.");
  elements.commandInput.focus();
}

async function openSourceViewer(source) {
  if (!isInspectableSource(source)) {
    showToast("Esta referencia es informativa; analiza un repositorio para abrir archivos reales", true);
    return;
  }
  elements.sourceDialog.showModal();
  elements.sourceMeta.textContent = `${source} · cargando…`;
  elements.sourceStatus.textContent = "Solo lectura";
  elements.sourceContent.textContent = "Cargando evidencia local…";
  try {
    const response = await fetch(`/api/source?path=${encodeURIComponent(scene.analysis.repoPath)}&file=${encodeURIComponent(source)}`, { headers: { accept: "application/json" } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No fue posible leer el archivo");
    elements.sourceMeta.textContent = `${result.file} · líneas ${result.startLine}-${result.endLine} de ${result.totalLines}`;
    elements.sourceStatus.textContent = "Solo lectura · origen local";
    elements.sourceContent.textContent = result.content;
  } catch (error) {
    elements.sourceMeta.textContent = source;
    elements.sourceStatus.textContent = "No disponible";
    elements.sourceContent.textContent = error.message || "No fue posible leer el archivo";
    showToast(error.message || "No fue posible leer el archivo", true);
  }
}

async function analyzeRepository(repositoryPath) {
  const path = repositoryPath.trim();
  if (!path) return;
  setCommandStatus("Mapeando repositorio", true);
  elements.sceneFootnote.textContent = "Leyendo estructura · modo solo lectura";
  try {
    const response = await fetch(`/api/analyze?path=${encodeURIComponent(path)}`, { headers: { accept: "application/json" } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No fue posible analizar el repositorio");
    if (!validScene(result.scene)) throw new Error("El adaptador devolvió una escena inválida");
    pushHistory();
    scene = result.scene;
    selectedId = scene.objects[0]?.id || null;
    render();
    const { files, excluded, sampleFiles } = result.summary;
    elements.sceneFootnote.textContent = `Fuente: ${path} · ${files} archivos · ${excluded} excluidos · ${sampleFiles} muestras`;
    showToast(`Mapa listo: ${files} archivos revisados, sin modificar el repositorio`);
  } catch (error) {
    elements.sceneFootnote.textContent = "No se pudo completar el análisis · la escena anterior se conserva";
    showToast(error.message || "No fue posible analizar el repositorio", true);
  } finally {
    setCommandStatus("Listo para recibir", false);
  }
}

function executeCommand(rawCommand) {
  const command = rawCommand.trim();
  if (!command) return;
  const normalized = normalizeText(command);
  setCommandStatus("Procesando comando", true);
  window.setTimeout(async () => {
    if (normalized.includes("analiza") || normalized.includes("mapea el repositorio")) {
      await analyzeRepository(runtimeConfig.defaultRepository);
    } else if (normalized.includes("ayuda") || normalized === "help") {
      showHelp();
    } else if (normalized.includes("guarda") || normalized.includes("guardar") || normalized.includes("save")) {
      saveScene();
    } else if (normalized.includes("deshace") || normalized.includes("deshacer") || normalized.includes("undo")) {
      undo();
    } else if (normalized.includes("gesto")) {
      if (normalized.includes("apaga") || normalized.includes("desactiva")) {
        if (gestureEngine?.active) stopGestureControl();
        else showToast("Los gestos ya están apagados");
      } else if (gestureEngine?.active) {
        showToast("Los gestos ya están activos");
      } else {
        await startGestureControl();
      }
    } else if (normalized.includes("camara")) {
      if (normalized.includes("oculta") || normalized.includes("apaga")) {
        if (cameraStream) stopCamera();
        else showToast("La cámara ya está apagada");
      } else if (cameraStream) {
        showToast("La cámara ya está activa");
      } else {
        await startCamera();
      }
    } else if ((normalized.includes("agrega") || normalized.includes("crea") || normalized.includes("anade")) && normalized.includes("reporte")) {
      const existing = findObjectByText("reportes");
      if (existing) selectObject(existing.id);
      else addSceneObject("Reportes", "service");
    } else if (normalized.includes("dependencia") || normalized.includes("relacion")) {
      const target = normalized.includes("facturacion") ? findObjectByText("facturacion") : findObject(scene, selectedId);
      if (target) {
        selectObject(target.id);
        showToast(`Mostrando las dependencias de ${target.title}`);
      } else {
        showToast("Selecciona un objeto para mostrar sus dependencias", true);
      }
    } else if (normalized.includes("selecciona") || normalized.includes("select")) {
      const target = scene.objects.find((object) => normalized.includes(normalizeText(object.title)));
      if (target) selectObject(target.id);
      else showToast("No encontré ese objeto en la escena", true);
    } else if (normalized.includes("mueve") || normalized.includes("mover")) {
      const direction = normalized.includes("arriba") ? [0, -5] : normalized.includes("abajo") ? [0, 5] : normalized.includes("izquierda") ? [-5, 0] : normalized.includes("derecha") ? [5, 0] : null;
      if (direction && selectedId) moveObject(selectedId, ...direction, "Objeto movido por comando");
      else showToast("Indica arriba, abajo, izquierda o derecha", true);
    } else {
      showToast("Todavía no reconozco ese comando. Escribe “Ayuda” para ver ejemplos.", true);
    }
    setCommandStatus("Listo para recibir", false);
  }, 260);
}

function setCommandStatus(label, working) {
  elements.commandStatus.lastChild.textContent = label;
  elements.commandStatus.classList.toggle("is-working", working);
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  elements.toastRegion.innerHTML = `<div class="toast${isError ? " is-error" : ""}">${escapeHTML(message)}</div>`;
  toastTimer = window.setTimeout(() => { elements.toastRegion.innerHTML = ""; }, 4200);
}

function setGestureDetailTarget(id) {
  const object = id ? findObject(scene, id) : null;
  if (!elements.gestureDetailButton) return;
  if (!object) {
    elements.gestureDetailButton.hidden = true;
    elements.gestureDetailButton.removeAttribute("data-object-id");
    elements.gestureDetailButton.removeAttribute("aria-label");
    return;
  }
  elements.gestureDetailButton.hidden = false;
  elements.gestureDetailButton.dataset.objectId = object.id;
  elements.gestureDetailButton.setAttribute("aria-label", `Mostrar detalle de ${object.title}`);
}

function openGestureDetail() {
  const object = findObject(scene, elements.gestureDetailButton?.dataset.objectId);
  if (!object) {
    setGestureDetailTarget(null);
    return;
  }
  gestureSelectionId = object.id;
  selectObject(object.id, { focus: false });
  elements.inspector.classList.add("is-open");
  showToast(`Detalle abierto: ${object.title}`);
}

function setGestureUi(mode, status, hint) {
  elements.gestureOverlay.dataset.state = mode;
  elements.gestureStatus.textContent = status;
  elements.gestureHint.textContent = hint;
  const active = Boolean(gestureEngine?.active);
  elements.gestureToggle.classList.toggle("is-on", active);
  elements.gestureToggle.setAttribute("aria-pressed", String(active));
  elements.gestureToggle.setAttribute("aria-label", active ? "Desactivar control por gestos" : "Activar control por gestos");
}

function formatEstimatedDepth(depth) {
  if (Math.abs(depth) < 4) return "Plano estimado";
  return depth > 0 ? `Delante · +${Math.round(depth)}` : `Detrás · ${Math.round(depth)}`;
}

function updateSpatialDepthReadout() {
  if (!elements.spatialDepthReadout) return;
  elements.spatialDepthReadout.textContent = formatEstimatedDepth(sceneSpatialTransform.z);
  elements.spatialDepthReadout.title = "Profundidad aproximada por el tamaño relativo de las manos; no es una medición física.";
}

function clampSceneSpatialTransform(transform) {
  return {
    x: Math.max(-320, Math.min(320, transform.x)),
    y: Math.max(-240, Math.min(240, transform.y)),
    z: Math.max(-160, Math.min(160, transform.z))
  };
}

function spatialGripPose(hands) {
  if (!Array.isArray(hands) || hands.length < 2) return null;
  const gripHands = hands.slice(0, 2)
    .filter((hand) => hand?.openPalm && hand.center && Number.isFinite(hand.palmScale) && hand.orientation)
    .sort((first, second) => first.center.x - second.center.x);
  if (gripHands.length !== 2) return null;

  const [left, right] = gripHands;
  const vector = { x: right.center.x - left.center.x, y: right.center.y - left.center.y };
  const span = Math.hypot(vector.x, vector.y);
  if (span < 0.14 || span > 0.78) return null;
  return {
    midpoint: { x: (left.center.x + right.center.x) / 2, y: (left.center.y + right.center.y) / 2 },
    vector,
    span,
    angle: Math.atan2(vector.y, vector.x),
    palmScale: (left.palmScale + right.palmScale) / 2,
    scaleDifference: right.palmScale - left.palmScale
  };
}

function smoothSpatialGripPose(previous, next, alpha = 0.28) {
  if (!previous) return next;
  const smoothPoint = (previousPoint, nextPoint) => ({
    x: previousPoint.x + (nextPoint.x - previousPoint.x) * alpha,
    y: previousPoint.y + (nextPoint.y - previousPoint.y) * alpha
  });
  const smoothNumber = (previousNumber, nextNumber) => previousNumber + (nextNumber - previousNumber) * alpha;
  return {
    midpoint: smoothPoint(previous.midpoint, next.midpoint),
    vector: smoothPoint(previous.vector, next.vector),
    span: smoothNumber(previous.span, next.span),
    angle: previous.angle + angleDifference(next.angle, previous.angle) * alpha,
    palmScale: smoothNumber(previous.palmScale, next.palmScale),
    scaleDifference: smoothNumber(previous.scaleDifference, next.scaleDifference)
  };
}

function calibrateSceneSpatialState(state, pose) {
  state.baseMidpoint = { ...pose.midpoint };
  state.baseVector = { ...pose.vector };
  state.baseSpan = pose.span;
  state.baseAngle = pose.angle;
  state.basePalmScale = pose.palmScale;
  state.baseScaleDifference = pose.scaleDifference;
  state.startTranslation = { ...sceneSpatialTransform };
  state.startRotation = { ...sceneRotation };
  state.startZoom = zoom;
  state.smoothedPose = pose;
  state.lastPose = pose;
  state.calibrationVersion = spatialCalibrationVersion;
}

function updateSceneSpatialManipulator(hands) {
  const pose = spatialGripPose(hands);
  if (!pose) return { candidate: false, active: false, waiting: false };

  if (!sceneSpatialState) {
    sceneSpatialState = {
      original: cloneScene(scene),
      originalRotation: { ...sceneRotation },
      originalSpatial: { ...sceneSpatialTransform },
      stableFrames: 1,
      active: false,
      moved: false,
      lastPose: pose,
      calibrationVersion: spatialCalibrationVersion
    };
    return { candidate: true, active: false, waiting: true, depth: 0 };
  }

  if (sceneSpatialState.calibrationVersion !== spatialCalibrationVersion) {
    calibrateSceneSpatialState(sceneSpatialState, pose);
    sceneSpatialState.active = true;
  }

  if (!sceneSpatialState.active) {
    const centerMovement = distance2D(pose.midpoint, sceneSpatialState.lastPose.midpoint);
    const spanMovement = Math.abs(pose.span - sceneSpatialState.lastPose.span);
    if (centerMovement <= 0.025 && spanMovement <= 0.04) {
      sceneSpatialState.stableFrames += 1;
    } else {
      sceneSpatialState.stableFrames = 1;
      sceneSpatialState.lastPose = pose;
    }
    if (sceneSpatialState.stableFrames < 5) return { candidate: true, active: false, waiting: true, depth: 0 };
    calibrateSceneSpatialState(sceneSpatialState, pose);
    sceneSpatialState.active = true;
  }

  const smoothedPose = smoothSpatialGripPose(sceneSpatialState.smoothedPose, pose);
  sceneSpatialState.smoothedPose = smoothedPose;
  const viewportRect = elements.viewport.getBoundingClientRect();
  const nextTranslation = clampSceneSpatialTransform({
    x: sceneSpatialState.startTranslation.x + (smoothedPose.midpoint.x - sceneSpatialState.baseMidpoint.x) * viewportRect.width,
    y: sceneSpatialState.startTranslation.y + (smoothedPose.midpoint.y - sceneSpatialState.baseMidpoint.y) * viewportRect.height,
    z: sceneSpatialState.startTranslation.z
  });
  const changed = Math.max(
    Math.abs(nextTranslation.x - sceneSpatialTransform.x),
    Math.abs(nextTranslation.y - sceneSpatialTransform.y)
  );
  sceneSpatialTransform = nextTranslation;
  sceneSpatialState.moved ||= changed > 0.5;
  updateSceneRotation();
  return { candidate: true, active: true, waiting: false, depth: sceneSpatialTransform.z, zoom };
}

function finalizeSceneSpatialManipulation(announce = true) {
  if (!sceneSpatialState) return;
  const changed = sceneSpatialState.moved;
  const original = sceneSpatialState.original;
  const originalRotation = sceneSpatialState.originalRotation;
  const originalSpatial = sceneSpatialState.originalSpatial;
  sceneSpatialState = null;
  updateSceneRotation();
  if (changed) {
    pushHistory(original, originalRotation, originalSpatial);
    updateSceneSummary();
    if (announce) showToast("Manipulación espacial completada; puedes deshacerla");
  }
}

function recenterSceneManipulator() {
  spatialCalibrationVersion += 1;
  if (sceneSpatialState?.active && sceneSpatialState.smoothedPose) {
    calibrateSceneSpatialState(sceneSpatialState, sceneSpatialState.smoothedPose);
  }
  showToast("Manipulador espacial recentrado; la profundidad sigue siendo estimada");
}

function setCameraUi(active) {
  elements.cameraLayer.classList.toggle("is-on", active);
  elements.cameraToggle.setAttribute("aria-pressed", String(active));
  elements.cameraToggle.setAttribute("aria-label", active ? "Apagar cámara" : "Activar cámara");
  elements.cameraState.innerHTML = `${icon(active ? "camera" : "camera-off")}Cámara ${active ? "activa" : "apagada"}`;
  elements.cameraState.classList.toggle("is-on", active);
}

async function startCamera() {
  if (cameraStream) return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Este navegador no expone una cámara local en este contexto", true);
    return false;
  }

  elements.cameraToggle.disabled = true;
  const requestVersion = ++cameraRequestVersion;
  const mediaPromise = navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });
  let timeoutId;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        const timeoutError = new Error("La solicitud de cámara tardó demasiado");
        timeoutError.name = "TimeoutError";
        reject(timeoutError);
      }, 20000);
    });
    const stream = await Promise.race([mediaPromise, timeoutPromise]);
    if (requestVersion !== cameraRequestVersion) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    cameraStream = stream;
    elements.cameraPreview.srcObject = cameraStream;
    await elements.cameraPreview.play();
    setCameraUi(true);
    if (solarDemo?.active) solarDemo.startBodies();
    showToast("Cámara activa solo en esta ventana");
    return true;
  } catch (error) {
    if (error.name === "TimeoutError") {
      cameraRequestVersion += 1;
      mediaPromise.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
    }
    cameraStream = null;
    elements.cameraPreview.srcObject = null;
    setCameraUi(false);
    const cameraErrors = {
      NotAllowedError: "Permiso de cámara no concedido",
      NotFoundError: "No se encontró una cámara disponible",
      NotReadableError: "La cámara está ocupada por otra aplicación",
      TimeoutError: "La cámara sigue esperando permiso; vuelve a intentarlo"
    };
    showToast(cameraErrors[error.name] ?? "No fue posible activar la cámara", true);
    return false;
  } finally {
    window.clearTimeout(timeoutId);
    elements.cameraToggle.disabled = false;
  }
}

function stopCamera() {
  solarDemo?.stopBodies();
  cameraRequestVersion += 1;
  if (gestureEngine?.active) stopGestureControl(false);
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  elements.cameraPreview.srcObject = null;
  setCameraUi(false);
  showToast("Cámara apagada; la escena sigue disponible");
}

async function toggleCamera() {
  if (cameraStream) stopCamera();
  else await startCamera();
}

function sizeGestureCanvas() {
  const rect = elements.viewport.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * scale));
  const height = Math.max(1, Math.round(rect.height * scale));
  if (elements.gestureCanvas.width !== width || elements.gestureCanvas.height !== height) {
    elements.gestureCanvas.width = width;
    elements.gestureCanvas.height = height;
  }
  return { width: rect.width, height: rect.height, scale };
}

function clearGestureCanvas() {
  const context = elements.gestureCanvas.getContext("2d");
  context?.clearRect(0, 0, elements.gestureCanvas.width, elements.gestureCanvas.height);
}

function drawHandOverlay(sample) {
  const context = elements.gestureCanvas.getContext("2d");
  if (!context) return;
  const { width, height, scale } = sizeGestureCanvas();
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  const hands = sample.allHands ?? (sample.hands?.length ? sample.hands : sample.detected ? [sample] : []);
  if (!hands.length) return;

  const pointFor = (landmark) => ({ x: (1 - landmark.x) * width, y: landmark.y * height });
  const colors = ["#38bdf8", "#a78bfa"];
  hands.forEach((hand, handIndex) => {
    if (!hand.landmarks?.length) return;
    const color = colors[handIndex % colors.length];
    context.lineWidth = hand.pinching || hand.pointing ? 3 : 2;
    context.strokeStyle = hand.pinching ? "rgba(34, 197, 94, 0.92)" : `${color}bb`;
    context.beginPath();
    HAND_CONNECTIONS.forEach(([fromIndex, toIndex]) => {
      const from = pointFor(hand.landmarks[fromIndex]);
      const to = pointFor(hand.landmarks[toIndex]);
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
    });
    context.stroke();

    hand.landmarks.forEach((landmark, index) => {
      const point = pointFor(landmark);
      context.beginPath();
      context.arc(point.x, point.y, index === 4 || index === 8 ? 5 : 2.6, 0, Math.PI * 2);
      context.fillStyle = index === 4 || index === 8 ? "#f8fafc" : color;
      context.fill();
    });

    const cursor = hand.pointing ? hand.pointerPoint : hand.point;
    if (cursor) {
      const cursorX = cursor.x * width;
      const cursorY = cursor.y * height;
      context.beginPath();
      context.arc(cursorX, cursorY, hand.pinching ? 18 : hand.pointing ? 16 : 12, 0, Math.PI * 2);
      context.strokeStyle = hand.pinching ? "#22c55e" : hand.pointing ? "#fbbf24" : color;
      context.lineWidth = 3;
      context.stroke();
    }
  });

  const anchors = hands.map((hand) => hand.point || hand.center).filter(Boolean);
  if (anchors.length >= 2) {
    const first = { x: anchors[0].x * width, y: anchors[0].y * height };
    const second = { x: anchors[1].x * width, y: anchors[1].y * height };
    context.beginPath();
    context.setLineDash([7, 7]);
    context.moveTo(first.x, first.y);
    context.lineTo(second.x, second.y);
    context.strokeStyle = "rgba(226, 232, 240, 0.78)";
    context.lineWidth = 2;
    context.stroke();
    context.setLineDash([]);
  }
}

function finalizeGestureMove(announce = true) {
  if (!gestureMoveState) return;
  const controlledNode = elements.nodes.querySelector(`[data-id="${CSS.escape(gestureMoveState.objectId)}"]`);
  controlledNode?.classList.remove("is-gesture-controlled");
  if (gestureMoveState.moved) {
    pushHistory(gestureMoveState.original);
    updateSceneSummary();
    if (announce) showToast("Movimiento por gesto completado; puedes deshacerlo");
  }
  gestureMoveState = null;
}

function finalizeGestureMultiMove(announce = true) {
  if (!gestureMultiMoveState) return;
  gestureMultiMoveState.entries.forEach((entry) => {
    elements.nodes.querySelector(`[data-id="${CSS.escape(entry.objectId)}"]`)?.classList.remove("is-gesture-controlled");
  });
  if (gestureMultiMoveState.moved) {
    pushHistory(gestureMultiMoveState.original);
    updateSceneSummary();
    if (announce) showToast("Movimiento de dos cards completado; puedes deshacerlo");
  }
  gestureMultiMoveState = null;
}

function finalizeTwoHandGesture(announce = false) {
  finalizeGestureZoom(announce);
  finalizeGestureMultiMove(announce);
  gestureTwoHandState = null;
}

function startGestureMultiMove(hands) {
  const entries = hands.slice(0, 2).map((hand) => {
    const selectedObject = gestureSelectionIds[hand.handIndex] ? findObject(scene, gestureSelectionIds[hand.handIndex]) : null;
    const object = findGestureTarget(hand.point) || selectedObject;
    if (!object || !hand.point) return null;
    return {
      handIndex: hand.handIndex,
      objectId: object.id,
      startPoint: { ...hand.point },
      startX: object.x,
      startY: object.y
    };
  });
  if (entries.length !== 2 || entries.some((entry) => !entry) || new Set(entries.map((entry) => entry.objectId)).size !== 2) return false;
  gestureMultiMoveState = { original: cloneScene(scene), entries, moved: false };
  entries.forEach((entry) => {
    gestureSelectionIds[entry.handIndex] = entry.objectId;
    gestureSelectionId = entry.objectId;
    elements.nodes.querySelector(`[data-id="${CSS.escape(entry.objectId)}"]`)?.classList.add("is-gesture-controlled");
  });
  return true;
}

function updateGestureMultiMove(hands) {
  if (!gestureMultiMoveState) return null;
  const movedObjects = [];
  gestureMultiMoveState.entries.forEach((entry) => {
    const hand = hands.find((candidate) => candidate.handIndex === entry.handIndex);
    const object = findObject(scene, entry.objectId);
    if (!hand?.point || !object) return;
    const nextPosition = clampScenePosition({
      x: entry.startX + (hand.point.x - entry.startPoint.x) * 100,
      y: entry.startY + (hand.point.y - entry.startPoint.y) * 100
    });
    const movedDistance = Math.hypot(nextPosition.x - object.x, nextPosition.y - object.y);
    object.x = nextPosition.x;
    object.y = nextPosition.y;
    gestureMultiMoveState.moved ||= movedDistance > 0.15;
    movedObjects.push(object);
  });
  if (movedObjects.length) {
    updateVisualPositions();
    if (gestureUiFrame % 3 === 0) renderInspector();
  }
  return movedObjects;
}

function finalizeGestureZoom(announce = false) {
  if (!gestureZoomState) return;
  const changed = gestureZoomState.moved;
  gestureZoomState = null;
  if (announce && changed) showToast(`Zoom por gesto completado · ${Math.round(zoom)}%`);
}

function finalizeGestureRotation(announce = true) {
  if (!gestureRotationState) return;
  const changed = gestureRotationState.moved;
  const original = gestureRotationState.original;
  const originalRotation = gestureRotationState.startRotation;
  const originalSpatial = gestureRotationState.startSpatial;
  gestureRotationState = null;
  updateSceneRotation();
  if (changed) {
    pushHistory(original, originalRotation, originalSpatial);
    updateSceneSummary();
    if (announce) showToast("Manipulación 3D con referencia fija completada; puedes deshacerla");
  }
}

function resetGestureDismiss() {
  gestureDismissState = null;
}

function removeSceneObject(id) {
  const object = findObject(scene, id);
  if (!object) return false;
  const nextSelectedId = selectedId === id ? scene.objects.find((entry) => entry.id !== id)?.id || null : selectedId;
  commit((draft) => {
    draft.objects = draft.objects.filter((entry) => entry.id !== id);
    draft.relations = draft.relations.filter((relation) => relation.from !== id && relation.to !== id);
  }, `${object.title} se retiró de la escena; puedes deshacerlo`, nextSelectedId);
  if (gestureSelectionId === id) gestureSelectionId = null;
  if (elements.gestureDetailButton?.dataset.objectId === id) setGestureDetailTarget(null);
  return true;
}

function trackGestureDismiss(hand) {
  if (!hand.openPalm || !hand.center) {
    gestureDismissState = null;
    return { detected: false, target: null };
  }
  const center = hand.center;
  const now = performance.now();
  gestureDismissState ||= { points: [] };
  gestureDismissState.points = [...gestureDismissState.points.filter((point) => now - point.time < 700), { ...center, time: now }];
  const swipe = detectHorizontalSwipe(gestureDismissState.points);
  if (!swipe) return { detected: false, target: null };

  const target = (gestureHoverId && findObject(scene, gestureHoverId)) || findGestureTarget(hand.point);
  gestureDismissState.points = [];
  if (!target) return { detected: true, target: null, swipe };
  setGestureHoverTarget(target.id);
  return { detected: true, target, swipe };
}

function angleDifference(current, baseline) {
  let difference = current - baseline;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

function clampRotation(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function isFistSpatialHand(hand) {
  return Boolean(
    hand?.fist
    && hand.center
    && hand.orientation
    && hand.center.y >= 0.08
    && hand.center.y <= 0.92
  );
}

function isRotationAnchorHand(hand) {
  return Boolean(
    hand?.openPalm
    && hand.center
    && hand.orientation
    && hand.center.y >= 0.08
    && hand.center.y <= 0.92
  );
}

function findFistOpenRotationPair(hands) {
  if (!Array.isArray(hands) || hands.length < 2) return null;
  const fist = hands.find((hand) => isFistSpatialHand(hand));
  const anchor = hands.find((hand) => isRotationAnchorHand(hand) && hand !== fist);
  return fist && anchor ? { fist, anchor } : null;
}

function applyGestureDeadzone(value, threshold) {
  if (Math.abs(value) <= threshold) return 0;
  return value - Math.sign(value) * threshold;
}

function updateFistSpatialManipulator(fistHand, anchorHand) {
  if (!isFistSpatialHand(fistHand) || !isRotationAnchorHand(anchorHand)) {
    if (gestureRotationState?.mode === "fist-open-pair") finalizeGestureRotation(false);
    return { candidate: false, active: false, waiting: false };
  }

  const samePair = gestureRotationState?.mode === "fist-open-pair"
    && gestureRotationState.fistHandIndex === fistHand.handIndex
    && gestureRotationState.anchorHandIndex === anchorHand.handIndex;

  if (!samePair) {
    if (gestureRotationState) finalizeGestureRotation(false);
    gestureRotationState = {
      mode: "fist-open-pair",
      objectId: null,
      fistHandIndex: fistHand.handIndex,
      anchorHandIndex: anchorHand.handIndex,
      original: cloneScene(scene),
      startRotation: { ...sceneRotation },
      startSpatial: { ...sceneSpatialTransform },
      baseCenter: { ...fistHand.center },
      basePalmScale: fistHand.palmScale,
      lastCenter: { ...fistHand.center },
      lastOrientation: { ...fistHand.orientation },
      smoothedCenter: { ...fistHand.center },
      anchorCenter: { ...anchorHand.center },
      lastAnchorCenter: { ...anchorHand.center },
      anchorStableFrames: 1,
      stableFrames: 1,
      moved: false
    };
    updateSceneRotation();
    return { candidate: true, active: false, waiting: true, anchorDrift: false };
  }

  const anchorStep = distance2D(anchorHand.center, gestureRotationState.lastAnchorCenter);
  const anchorDrift = distance2D(anchorHand.center, gestureRotationState.anchorCenter);
  gestureRotationState.lastAnchorCenter = { ...anchorHand.center };
  if (anchorStep > ROTATION_ANCHOR_STEP_LIMIT || anchorDrift > ROTATION_ANCHOR_DRIFT_LIMIT) {
    gestureRotationState.anchorStableFrames = 0;
    gestureRotationState.stableFrames = 0;
    gestureRotationState.anchorCenter = { ...anchorHand.center };
    gestureRotationState.baseCenter = { ...fistHand.center };
    gestureRotationState.basePalmScale = fistHand.palmScale;
    gestureRotationState.lastCenter = { ...fistHand.center };
    gestureRotationState.lastOrientation = { ...fistHand.orientation };
    gestureRotationState.smoothedCenter = { ...fistHand.center };
    gestureRotationState.startRotation = { ...sceneRotation };
    gestureRotationState.startSpatial = { ...sceneSpatialTransform };
    return { candidate: true, active: false, waiting: true, anchorDrift: true };
  }
  gestureRotationState.anchorStableFrames = Math.min(ROTATION_STABLE_FRAMES, gestureRotationState.anchorStableFrames + 1);
  if (gestureRotationState.anchorStableFrames < ROTATION_STABLE_FRAMES) {
    return { candidate: true, active: false, waiting: true, anchorDrift: false };
  }

  const centerMovement = distance2D(fistHand.center, gestureRotationState.lastCenter);
  gestureRotationState.lastCenter = { ...fistHand.center };
  if (gestureRotationState.stableFrames < ROTATION_STABLE_FRAMES) {
    if (centerMovement <= 0.018) {
      gestureRotationState.stableFrames += 1;
    } else {
      gestureRotationState.stableFrames = 1;
      gestureRotationState.startRotation = { ...sceneRotation };
      gestureRotationState.startSpatial = { ...sceneSpatialTransform };
      gestureRotationState.baseCenter = { ...fistHand.center };
      gestureRotationState.basePalmScale = fistHand.palmScale;
      gestureRotationState.lastOrientation = { ...fistHand.orientation };
      gestureRotationState.smoothedCenter = { ...fistHand.center };
    }
    if (gestureRotationState.stableFrames < ROTATION_STABLE_FRAMES) {
      return { candidate: true, active: false, waiting: true, anchorDrift: false };
    }
  }

  const smoothing = 0.32;
  const smoothedCenter = {
    x: gestureRotationState.smoothedCenter.x + (fistHand.center.x - gestureRotationState.smoothedCenter.x) * smoothing,
    y: gestureRotationState.smoothedCenter.y + (fistHand.center.y - gestureRotationState.smoothedCenter.y) * smoothing
  };
  const smoothedOrientation = {
    pitch: gestureRotationState.lastOrientation.pitch + angleDifference(fistHand.orientation.pitch, gestureRotationState.lastOrientation.pitch) * smoothing,
    yaw: gestureRotationState.lastOrientation.yaw + angleDifference(fistHand.orientation.yaw, gestureRotationState.lastOrientation.yaw) * smoothing,
    roll: gestureRotationState.lastOrientation.roll + angleDifference(fistHand.orientation.roll, gestureRotationState.lastOrientation.roll) * smoothing
  };
  const pitchDelta = applyGestureDeadzone(angleDifference(smoothedOrientation.pitch, gestureRotationState.lastOrientation.pitch), ROTATION_ORIENTATION_DEADZONE);
  const yawDelta = applyGestureDeadzone(angleDifference(smoothedOrientation.yaw, gestureRotationState.lastOrientation.yaw), ROTATION_ORIENTATION_DEADZONE);
  const rollDelta = applyGestureDeadzone(angleDifference(smoothedOrientation.roll, gestureRotationState.lastOrientation.roll), ROTATION_ORIENTATION_DEADZONE);
  const rotationDelta = {
    x: pitchDelta * 62,
    y: yawDelta * 54,
    z: rollDelta * 72
  };
  const viewportRect = elements.viewport.getBoundingClientRect();
  const translationX = applyGestureDeadzone(smoothedCenter.x - gestureRotationState.baseCenter.x, ROTATION_TRANSLATION_DEADZONE);
  const translationY = applyGestureDeadzone(smoothedCenter.y - gestureRotationState.baseCenter.y, ROTATION_TRANSLATION_DEADZONE);
  const nextTranslation = clampSceneSpatialTransform({
    x: gestureRotationState.startSpatial.x + translationX * viewportRect.width,
    y: gestureRotationState.startSpatial.y + translationY * viewportRect.height,
    z: gestureRotationState.startSpatial.z + estimateGripDepth(gestureRotationState.basePalmScale, fistHand.palmScale)
  });
  const spatialDelta = {
    x: nextTranslation.x - sceneSpatialTransform.x,
    y: nextTranslation.y - sceneSpatialTransform.y,
    z: nextTranslation.z - sceneSpatialTransform.z
  };
  const changed = Math.max(
    Math.abs(rotationDelta.x),
    Math.abs(rotationDelta.y),
    Math.abs(rotationDelta.z),
    Math.abs(spatialDelta.x),
    Math.abs(spatialDelta.y),
    Math.abs(spatialDelta.z)
  );
  sceneRotation = {
    x: sceneRotation.x + rotationDelta.x,
    y: sceneRotation.y + rotationDelta.y,
    z: sceneRotation.z + rotationDelta.z
  };
  sceneSpatialTransform = nextTranslation;
  gestureRotationState.smoothedCenter = smoothedCenter;
  gestureRotationState.lastOrientation = smoothedOrientation;
  gestureRotationState.moved ||= changed > 0.35;
  updateSceneRotation();
  return { candidate: true, active: true, waiting: false, anchorDrift: false, rotation: sceneRotation, spatial: sceneSpatialTransform };
}

function findGestureTarget(point) {
  if (!point) return null;
  const viewportRect = elements.viewport.getBoundingClientRect();
  const cursor = {
    x: viewportRect.left + point.x * viewportRect.width,
    y: viewportRect.top + point.y * viewportRect.height
  };
  const directNode = document.elementsFromPoint(cursor.x, cursor.y)
    .map((element) => element.closest?.(".scene-node"))
    .find((node) => node && elements.nodes.contains(node));
  if (directNode?.dataset.id) return findObject(scene, directNode.dataset.id);

  const targets = [...elements.nodes.querySelectorAll(".scene-node")].map((node) => {
    const rect = node.getBoundingClientRect();
    return { id: node.dataset.id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
  const target = pickGestureTarget(cursor, targets);
  return target ? findObject(scene, target.id) : null;
}

function setGestureHoverTarget(id) {
  if (gestureHoverId && gestureHoverId !== id) {
    elements.nodes.querySelector(`[data-id="${CSS.escape(gestureHoverId)}"]`)?.classList.remove("is-gesture-target");
  }
  gestureHoverId = id;
  if (id) elements.nodes.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add("is-gesture-target");
}

function handleGestureFrame(sample) {
  solarDemo?.trackingStatus(sample.controlStatus, sample.allHands?.length || 0);
  drawHandOverlay(sample);
  if (!gestureEngine?.active) return;

  gestureUiFrame += 1;
  const hands = (sample.hands?.length ? sample.hands : sample.detected ? [sample] : []).filter((hand) => hand?.detected);
  if (!hands.length) {
    if (solarDemo?.active) solarDemo.handleHands([]);
    gestureMissingFrames += 1;
    if (gestureMissingFrames > 5) {
      finalizeGestureMove(false);
      finalizeSceneSpatialManipulation(false);
      finalizeTwoHandGesture();
      finalizeGestureRotation(false);
      resetGestureDismiss();
    }
    setGestureHoverTarget(null);
    clearManualMenuGestureTarget();
    setGestureUi("searching", "Control por manos", sample.controlStatus || "Muestra tus palmas abiertas frente a la cámara.");
    return;
  }

  gestureMissingFrames = 0;
  if (solarDemo?.active) {
    const menuHand = hands.find(hand => hand.pointing && hand.pointerPoint);
    if (menuHand && updateManualMenuGestureTarget(menuHand.pointerPoint)) {
      solarDemo.handleHands([]);
      return;
    }
    if (!menuHand) clearManualMenuGestureTarget();
    solarDemo.handleHands(hands);
    return;
  }
  const rotationPair = findFistOpenRotationPair(hands);
  if (rotationPair) {
    finalizeGestureMove(false);
    finalizeSceneSpatialManipulation(false);
    finalizeTwoHandGesture();
    resetGestureDismiss();
    setGestureHoverTarget(null);
    clearManualMenuGestureTarget();
    const rotation = updateFistSpatialManipulator(rotationPair.fist, rotationPair.anchor);
    if (rotation.waiting) {
      const status = rotation.anchorDrift ? "Mantén fija la palma abierta" : "Preparando órbita de dos manos";
      const hint = rotation.anchorDrift
        ? "La palma abierta se movió; déjala quieta y usa solo el puño para controlar el grafo."
        : "Deja una mano abierta y quieta como referencia; cierra la otra para mover y rotar el grafo.";
      setGestureUi("rotating", status, hint);
    } else {
      setGestureUi("rotating", "Órbita con referencia fija", `El puño controla el grafo; la palma abierta permanece fija · Z ${Math.round(rotation.rotation.z)}° acumulados.`);
    }
    return;
  }
  if (gestureRotationState?.mode === "fist-open-pair") finalizeGestureRotation(false);
  const spatial = updateSceneSpatialManipulator(hands);
  if (spatial.candidate) {
    finalizeGestureMove(false);
    finalizeTwoHandGesture();
    finalizeGestureRotation(false);
    resetGestureDismiss();
    setGestureHoverTarget(null);
    clearManualMenuGestureTarget();
    if (spatial.waiting) {
      setGestureUi("spatial", "Preparando volumen espacial", "Mantén las dos manos abiertas como si sujetaras una pelota para calibrar el lienzo.");
    } else {
      setGestureUi("spatial", "Paneo del diagrama", "Mueve las dos manos abiertas para desplazarte por el grafo; la órbita se controla con un puño y la otra palma abierta fija.");
    }
    return;
  }
  finalizeSceneSpatialManipulation();
  const fistHand = hands.find((hand) => hand.fist) || null;
  const pinchingHand = hands.find((hand) => hand.pinching) || fistHand || hands[0];
  const pinchHands = hands.slice(0, 2);
  const pinchAnchors = pinchHands.map((hand) => hand.point);
  if (hasTwoHandPinch(hands) && pinchAnchors.length === 2 && pinchAnchors.every(Boolean)) {
    finalizeGestureMove(false);
    resetGestureDismiss();
    finalizeGestureRotation(false);
    setGestureHoverTarget(null);
    clearManualMenuGestureTarget();
    const distance = distance2D(pinchAnchors[0], pinchAnchors[1]);
    if (!gestureTwoHandState) {
      const mode = classifyTwoHandGesture(distance, TWO_HAND_ZOOM_MAX_DISTANCE);
      gestureTwoHandState = { mode };
      if (mode === "zoom") {
        gestureZoomState = { startDistance: distance, startZoom: zoom, moved: false };
      }
    }
    if (gestureTwoHandState.mode === "zoom" && gestureZoomState) {
      const nextZoom = calculateGestureZoom(gestureZoomState.startZoom, gestureZoomState.startDistance, distance);
      gestureZoomState.moved ||= Math.abs(nextZoom - gestureZoomState.startZoom) > 0.5;
      zoom = nextZoom;
      elements.zoomReadout.textContent = `${Math.round(zoom)}%`;
      updateVisualPositions();
      setGestureUi("zooming", "Zoom general", `Escena completa · separa o acerca las pinzas · ${Math.round(zoom)}%`);
    } else if (gestureTwoHandState.mode === "move") {
      finalizeGestureZoom();
      if (!gestureMultiMoveState) startGestureMultiMove(pinchHands);
      const movedObjects = updateGestureMultiMove(pinchHands);
      if (movedObjects?.length === 2) {
        setGestureUi("multi-moving", "Dos cards en movimiento", `${movedObjects[0].title} · ${movedObjects[1].title}. Abre las pinzas para soltar.`);
      } else {
        setGestureUi("pinching", "Dos pinzas separadas", "Coloca cada pinza sobre una card distinta para moverlas juntas.");
      }
    } else {
      setGestureUi("pinching", "Dos pinzas muy juntas", "Mantén las pinzas visibles y sepáralas para hacer zoom general.");
    }
    return;
  }

  finalizeTwoHandGesture();
  const pointingHands = hands.filter((hand) => hand.pointing && hand.pointerPoint);
  if (pointingHands.length) {
    finalizeGestureMove();
    finalizeGestureRotation();
    resetGestureDismiss();
    const pointingAtMenu = pointingHands.some((hand) => updateManualMenuGestureTarget(hand.pointerPoint));
    if (pointingAtMenu) {
      setGestureHoverTarget(null);
      setGestureUi(
        "pointing",
        elements.manualMenu.hidden ? "Apunta a Controles" : "Controles abiertos",
        elements.manualMenu.hidden ? "Mantén el índice sobre el lanzador para abrir la paleta manual." : "La paleta manual está disponible. Apunta a una card para volver al diagrama."
      );
      return;
    }
    if (pointingHands.length > 1) {
      let lastTarget = null;
      pointingHands.forEach((hand) => {
        const target = findGestureTarget(hand.pointerPoint);
        if (!target) return;
        lastTarget = target;
        gestureSelectionIds[hand.handIndex] = target.id;
        gestureSelectionId = target.id;
        if (selectedId !== target.id) selectObject(target.id, { focus: false });
      });
      setGestureDetailTarget(lastTarget?.id ?? null);
      setGestureHoverTarget(null);
      setGestureUi("pointing", "Dos índices activos", "Selecciona una card y usa Detalle; cierra dos pinzas separadas para mover dos cards.");
      return;
    }

    const pointingHand = pointingHands[0];
    updateManualMenuGestureTarget(pointingHand.pointerPoint);
    const target = findGestureTarget(pointingHand.pointerPoint);
    if (!target) {
      setGestureHoverTarget(null);
      setGestureUi("pointing", "Índice detectado", "Apunta directamente a una card para seleccionarla.");
      return;
    }

    gestureSelectionIds[pointingHand.handIndex] = target.id;
    gestureSelectionId = target.id;
    if (selectedId !== target.id) selectObject(target.id, { focus: false });
    setGestureDetailTarget(target.id);
    setGestureHoverTarget(target.id);
    setGestureUi("pointing", `Índice: ${target.title}`, "Card seleccionada. Usa Detalle para abrir su inspector; haz pinza para moverla.");
    return;
  }

  if (!pinchingHand.pinching) {
    finalizeGestureMove();
    clearManualMenuGestureTarget();
    if (pinchingHand.fist) {
      finalizeGestureRotation(false);
      setGestureHoverTarget(null);
      setGestureUi("detected", "Puño en espera", "Para orbitar, muestra la otra mano abierta y déjala fija; el puño será el único controlador.");
      return;
    }
    const dismiss = trackGestureDismiss(pinchingHand);
    if (dismiss.detected) {
      if (dismiss.target) {
        finalizeGestureRotation(false);
        removeSceneObject(dismiss.target.id);
        setGestureHoverTarget(null);
        setGestureUi("dismissed", "Barrido completado", `Retiraste ${dismiss.target.title}. Puedes deshacerlo.`);
      } else {
        setGestureUi("detected", "Barrido detectado", "Haz el barrido sobre una card para retirarla.");
      }
      return;
    }
    finalizeGestureRotation();
    const target = findGestureTarget(pinchingHand.point);
    setGestureHoverTarget(target?.id ?? null);
    setGestureUi(
      "detected",
      target ? `Objetivo: ${target.title}` : "Mano detectada",
      target ? "Barrido lateral para retirarla · índice para seleccionarla." : "Extiende el índice para seleccionar; para orbitar, muestra un puño y deja la otra palma abierta y fija."
    );
    return;
  }

  resetGestureDismiss();
  finalizeGestureRotation(false);
  const selectedObject = gestureSelectionId ? findObject(scene, gestureSelectionId) : null;
  if (!selectedObject || !pinchingHand.point) {
    finalizeGestureMove();
    setGestureHoverTarget(null);
      setGestureUi("pinching", "Pinza sin selección", "Selecciona primero una card con el índice; después une índice y pulgar con los otros 3 dedos arriba para moverla.");
    return;
  }

  if (gestureMoveState && gestureMoveState.objectId !== selectedObject.id) finalizeGestureMove();
  if (!gestureMoveState) {
    gestureMoveState = {
      objectId: selectedObject.id,
      handIndex: pinchingHand.handIndex,
      original: cloneScene(scene),
      startPoint: { ...pinchingHand.point },
      startX: selectedObject.x,
      startY: selectedObject.y,
      moved: false
    };
  }

  const nextPosition = clampScenePosition({
    x: gestureMoveState.startX + (pinchingHand.point.x - gestureMoveState.startPoint.x) * 100,
    y: gestureMoveState.startY + (pinchingHand.point.y - gestureMoveState.startPoint.y) * 100
  });
  const movedDistance = Math.hypot(nextPosition.x - selectedObject.x, nextPosition.y - selectedObject.y);
  selectedObject.x = nextPosition.x;
  selectedObject.y = nextPosition.y;
  gestureMoveState.moved ||= movedDistance > 0.15;
  elements.nodes.querySelector(`[data-id="${CSS.escape(selectedObject.id)}"]`)?.classList.add("is-gesture-controlled");
  updateVisualPositions();
  if (gestureUiFrame % 3 === 0) renderInspector();
  setGestureHoverTarget(null);
  setGestureUi("pinching", "Pinza activa", `Moviendo ${selectedObject.title}. Índice + pulgar juntos y 3 dedos arriba; abre los dedos para soltar.`);
}

function handleGestureEngineStatus(mode, message) {
  if (mode === "error") {
    setGestureUi("error", "Seguimiento detenido", message);
    showToast(message, true);
  } else if (mode === "loading") {
    setGestureUi("loading", "Cargando seguimiento", "El modelo se prepara localmente en el navegador.");
  }
}

async function startGestureControl() {
  elements.gestureToggle.disabled = true;
  setGestureUi("loading", "Preparando gestos", "Solicitando cámara y cargando el modelo local.");
  const cameraReady = await startCamera();
  if (!cameraReady) {
    elements.gestureToggle.disabled = false;
    setGestureUi("error", "Cámara no disponible", "Concede permiso de cámara para probar los gestos.");
    return;
  }

  try {
    gestureEngine ||= new GestureEngine({
      video: elements.cameraPreview,
      onFrame: handleGestureFrame,
      onStatus: handleGestureEngineStatus,
      targetFps: 15
    });
    await gestureEngine.initialize();
    gestureEngine.start();
    setGestureUi("searching", "Buscando manos", "Muestra una o dos manos completas frente a la cámara.");
    showToast("Gestos activos: índice selecciona · pinza = índice + pulgar juntos y 3 dedos arriba · puño + palma abierta fija = órbita y desplazamiento · dos manos abiertas = paneo · dos pinzas hacen zoom general");
  } catch (error) {
    setGestureUi("error", "No se pudo iniciar", error.message || "Error al cargar el seguimiento de mano");
    showToast("No fue posible iniciar el seguimiento de mano", true);
  } finally {
    elements.gestureToggle.disabled = false;
  }
}

function stopGestureControl(announce = true) {
  finalizeGestureMove(false);
  finalizeSceneSpatialManipulation(false);
  finalizeTwoHandGesture();
  finalizeGestureRotation(false);
  resetGestureDismiss();
  gestureSelectionId = null;
  gestureSelectionIds = [null, null];
  setGestureDetailTarget(null);
  setGestureHoverTarget(null);
  gestureEngine?.stop();
  clearGestureCanvas();
  setGestureUi("idle", "Gestos apagados", "Activa Gestos para seleccionar con el índice, mover cards con pinza de 2 dedos + 3 arriba, hacer paneo con dos manos abiertas o orbitar con un puño y la otra palma abierta fija.");
  if (announce) showToast("Control por gestos desactivado");
}

async function toggleGestureControl() {
  if (gestureEngine?.active) stopGestureControl();
  else await startGestureControl();
}

function toggleVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("El reconocimiento de voz no está disponible en este navegador", true);
    return;
  }
  if (recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "es-MX";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    elements.voiceButton.classList.add("is-listening");
    elements.voiceButton.setAttribute("aria-pressed", "true");
    elements.commandInput.placeholder = "Escuchando…";
    setCommandStatus("Escuchando", true);
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    elements.commandInput.value = transcript;
    executeCommand(transcript);
  };
  recognition.onerror = () => showToast("No pude entender el comando de voz", true);
  recognition.onend = () => {
    recognition = null;
    elements.voiceButton.classList.remove("is-listening");
    elements.voiceButton.setAttribute("aria-pressed", "false");
    elements.commandInput.placeholder = "Ej. “Agrega el servicio de reportes”";
    setCommandStatus("Listo para recibir", false);
  };
  recognition.start();
}

function beginDrag(event, id) {
  if (event.button !== 0) return;
  const object = findObject(scene, id);
  if (!object) return;
  dragState = { id, startX: event.clientX, startY: event.clientY, original: cloneScene(scene), moved: false };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  selectObject(id);
  const onMove = (moveEvent) => {
    if (!dragState) return;
    const distance = Math.hypot(moveEvent.clientX - dragState.startX, moveEvent.clientY - dragState.startY);
    if (distance < 4 && !dragState.moved) return;
    dragState.moved = true;
    const rect = elements.viewport.getBoundingClientRect();
    const target = findObject(scene, id);
    target.x = Math.max(6, Math.min(94, target.x + ((moveEvent.clientX - dragState.startX) / rect.width) * 100));
    target.y = Math.max(8, Math.min(92, target.y + ((moveEvent.clientY - dragState.startY) / rect.height) * 100));
    dragState.startX = moveEvent.clientX;
    dragState.startY = moveEvent.clientY;
    updateVisualPositions();
    renderInspector();
  };
  const onUp = () => {
    if (!dragState) return;
    if (dragState.moved) {
      pushHistory(dragState.original);
      draggedId = id;
      updateSceneSummary();
      showToast("Objeto reposicionado; puedes deshacerlo");
    }
    dragState = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function updateZoom(delta) {
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
  elements.zoomReadout.textContent = `${zoom}%`;
  updateVisualPositions();
}

mountManualMenu();

document.querySelector('#solar-launcher').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (solarDemo?.active) return;
  button.disabled = true;
  try {
    const { SolarDemo } = await import('/public/generated/solar-demo.js');
    solarDemo ||= new SolarDemo({viewport:elements.viewport, video:elements.cameraPreview,
      onCamera:startGestureControl, onClaim:()=>gestureEngine?.tracking.release(), onExit:()=>{button.hidden=false;}});
    finalizeGestureMove(false); finalizeGestureRotation(false); finalizeSceneSpatialManipulation(false); finalizeTwoHandGesture();
    setManualMenuOpen(false);
    button.hidden = true;
    await solarDemo.open();
  } catch(error) {
    button.hidden=false;
    showToast('No se pudo abrir la maqueta: '+error.message,true);
  } finally { button.disabled=false; }
});

document.querySelectorAll("[data-icon]").forEach((target) => {
  target.innerHTML = icon(target.dataset.icon);
});

elements.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = elements.commandInput.value;
  elements.commandInput.value = "";
  executeCommand(command);
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.commandInput.value = button.dataset.command;
    executeCommand(button.dataset.command);
  });
});

document.querySelector("#add-object-button").addEventListener("click", openObjectDialog);
document.querySelector("#new-session").addEventListener("click", startNewSession);
document.querySelector("#save-button").addEventListener("click", saveScene);
document.querySelector("#analyze-button").addEventListener("click", openAnalysisDialog);
elements.cameraToggle.addEventListener("click", toggleCamera);
elements.gestureToggle.addEventListener("click", toggleGestureControl);
elements.voiceButton.addEventListener("click", toggleVoice);
elements.gestureDetailButton.addEventListener("click", openGestureDetail);
elements.undoButton.addEventListener("click", undo);
elements.menuAnchor.addEventListener("click", () => setManualMenuOpen(true, { focus: true }));
elements.manualMenuClose.addEventListener("click", () => setManualMenuOpen(false));
elements.manualMenu.addEventListener("click", (event) => {
  if (event.target === elements.manualMenu) setManualMenuOpen(false);
});
document.querySelector("#zoom-in").addEventListener("click", () => updateZoom(10));
document.querySelector("#zoom-out").addEventListener("click", () => updateZoom(-10));
elements.spatialRecenter.addEventListener("click", recenterSceneManipulator);
document.querySelector("#reset-scene").addEventListener("click", () => {
  finalizeGestureMove(false);
  finalizeSceneSpatialManipulation(false);
  finalizeTwoHandGesture();
  finalizeGestureRotation(false);
  zoom = 100;
  sceneRotation = { ...DEFAULT_SCENE_ROTATION };
  sceneSpatialTransform = { x: 0, y: 0, z: 0 };
  render();
  showToast("Vista restablecida");
});
document.querySelector("#help-button").addEventListener("click", showHelp);
document.querySelector("#close-inspector").addEventListener("click", () => elements.inspector.classList.remove("is-open"));

elements.objectForm.addEventListener("submit", (event) => {
  if (event.submitter?.value !== "default") return;
  event.preventDefault();
  addSceneObject(elements.objectName.value, elements.objectType.value);
  elements.objectDialog.close();
});

elements.analysisForm.addEventListener("submit", (event) => {
  if (event.submitter?.value !== "default") return;
  event.preventDefault();
  const repositoryPath = elements.analysisPath.value;
  elements.analysisDialog.close();
  analyzeRepository(repositoryPath);
});

window.addEventListener("keydown", (event) => {
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveScene();
  } else if (modifier && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.commandInput.focus();
  } else if (modifier && event.key.toLowerCase() === "n") {
    event.preventDefault();
    openObjectDialog();
  } else if (event.key === "Escape" && !elements.manualMenu.hidden) {
    setManualMenuOpen(false);
  } else if (event.key === "Escape" && elements.inspector.classList.contains("is-open")) {
    elements.inspector.classList.remove("is-open");
  }
});

window.addEventListener("beforeunload", () => {
  solarDemo?.close();
  gestureEngine?.close();
  cameraStream?.getTracks().forEach((track) => track.stop());
});

async function loadRuntimeConfig() {
  try {
    const response = await fetch("/api/config", { headers: { accept: "application/json" } });
    const result = await response.json();
    if (!response.ok || !result.defaultRepository) throw new Error("No fue posible cargar la configuración local");
    runtimeConfig.defaultRepository = result.defaultRepository;
    elements.analysisPath.value = runtimeConfig.defaultRepository;
  } catch (error) {
    showToast("No fue posible determinar el repositorio local predeterminado", true);
  }
}

async function initialize() {
  await loadRuntimeConfig();
  render();
  if (runtimeConfig.defaultRepository && (!scene.analysis || scene.analysis.repoPath !== runtimeConfig.defaultRepository)) {
    window.setTimeout(() => analyzeRepository(runtimeConfig.defaultRepository), 220);
  }
}

initialize();
