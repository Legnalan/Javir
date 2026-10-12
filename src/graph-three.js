import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WIDTH = 1600, HEIGHT = 700;

export class GraphThree {
  constructor({ viewport, nodes, depth, onZoom, onReset }) {
    Object.assign(this, { viewport, nodes, depth, onZoom, onReset });
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 18000);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'graph-three-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'Mapa 3D: arrastra para orbitar, clic derecho para desplazar, rueda para zoom y WASD para navegar');
    viewport.prepend(this.canvas);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.controls.dampingFactor = .12;
    this.controls.minDistance = 180;
    this.controls.maxDistance = 12000;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener('change', () => {
      this.dirty = true;
      if (this.baseDistance) this.onZoom?.(Math.round(this.baseDistance / this.controls.getDistance() * 100));
    });
    this.records = new Map();
    this.boxGeometry = new THREE.BoxGeometry(148, 96, 22);
    this.edgeGeometry = new THREE.EdgesGeometry(this.boxGeometry);
    this.linkGeometry = new THREE.BufferGeometry();
    this.links = new THREE.LineSegments(this.linkGeometry, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .65 }));
    this.root.add(this.links);
    this.grid = new THREE.GridHelper(1800, 36, 0x38bdf8, 0x17334d);
    this.grid.position.y = -440;
    this.grid.material.transparent = true;
    this.grid.material.opacity = .35;
    this.root.add(this.grid);
    this.keys = new Set();
    this.canvas.addEventListener('pointerdown', () => this.canvas.focus({ preventScroll: true }));
    this.keyDown = event => {
      if (!this.enabled || document.activeElement !== this.canvas || event.ctrlKey || event.metaKey || event.altKey) return;
      if ('wasdqe'.includes(event.key.toLowerCase())) { event.preventDefault(); this.keys.add(event.key.toLowerCase()); }
      if (event.key === 'Shift') this.keys.add('shift');
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); this.focusSelected(); }
      if (event.key.toLowerCase() === 'r') { event.preventDefault(); if (this.onReset) this.onReset(); else this.reset(); }
    };
    this.keyUp = event => this.keys.delete(event.key.toLowerCase());
    this.blur = () => this.keys.clear();
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(viewport);
    this.enabled = true;
    this.resize();
    this.reset();
    viewport.classList.add('three-enabled');
    this.animate = timestamp => {
      this.frame = requestAnimationFrame(this.animate);
      const delta = Math.min(.05, (timestamp - (this.lastTime || timestamp)) / 1000);
      this.lastTime = timestamp;
      if (!this.enabled || document.hidden) return;
      this.navigate(delta);
      this.controls.update();
      if (!this.dirty) return;
      this.root.updateMatrixWorld(true);
      this.camera.updateMatrixWorld();
      this.projectLabels();
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    };
    this.frame = requestAnimationFrame(this.animate);
  }

  resize() {
    const { width, height } = this.viewport.getBoundingClientRect();
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this.dirty = true;
  }

  reset() {
    this.keys.clear();
    const bounds = new THREE.Box3();
    this.root.updateMatrixWorld(true);
    for (const record of this.records.values()) bounds.expandByObject(record.mesh);
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty() ? new THREE.Vector3(WIDTH, HEIGHT, 0) : bounds.getSize(new THREE.Vector3());
    this.controls.target.copy(center);
    this.baseDistance = Math.max(size.x / this.camera.aspect, size.y) / (2 * Math.tan(Math.PI / 8)) * 1.4 + size.z / 2;
    this.camera.position.copy(center).add(new THREE.Vector3(0, 0, this.baseDistance));
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.controls.saveState();
    this.dirty = true;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.controls.enabled = enabled;
    this.canvas.hidden = !enabled;
    this.keys.clear(); this.dirty = true;
  }

  localPosition(object) {
    return new THREE.Vector3((object.x / 100 - .5) * WIDTH, (.5 - object.y / 100) * HEIGHT, this.depth(object));
  }

  sync(data, selectedId, spatial, rotation, zoom, selectedIds = new Set(selectedId ? [selectedId] : [])) {
    this.selectedId = selectedId;
    this.selectedIds = new Set(selectedIds);
    const layout = data.objects.map(object => object.id).join("|");
    const layoutChanged = layout !== this.layout;
    this.layout = layout;
    const ids = new Set(data.objects.map(object => object.id));
    for (const [id, record] of this.records) if (!ids.has(id)) {
      this.root.remove(record.mesh); record.mesh.material.dispose(); record.outline.material.dispose(); this.records.delete(id);
    }
    for (const object of data.objects) {
      let record = this.records.get(object.id);
      if (!record) {
        const mesh = new THREE.Mesh(this.boxGeometry, new THREE.MeshBasicMaterial({ color: 0x0c405a, transparent: true, opacity: .16 }));
        const outline = new THREE.LineSegments(this.edgeGeometry, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .6 }));
        mesh.add(outline); this.root.add(mesh);
        record = { mesh, outline }; this.records.set(object.id, record);
      }
      record.object = object;
      record.mesh.position.copy(this.localPosition(object));
      record.outline.material.color.set(selectedIds.has(object.id) ? 0xfbbf24 : 0x38bdf8);
      record.label = this.nodes.querySelector(`[data-id="${CSS.escape(object.id)}"]`)?.closest('.scene-node-anchor');
    }
    const positions = [];
    for (const relation of data.relations) {
      const a = this.records.get(relation.from), b = this.records.get(relation.to);
      if (a && b) positions.push(...a.mesh.position.toArray(), ...b.mesh.position.toArray());
    }
    this.linkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.linkGeometry.computeBoundingSphere();
    this.root.rotation.set(THREE.MathUtils.degToRad(rotation.x), THREE.MathUtils.degToRad(rotation.y), THREE.MathUtils.degToRad(rotation.z));
    this.root.scale.setScalar(zoom / 100);
    const unit = this.worldPerPixel();
    this.root.position.copy(new THREE.Vector3(spatial.x * unit, -spatial.y * unit, spatial.z).applyQuaternion(this.camera.quaternion));
    this.dirty = true;
    this.root.updateMatrixWorld(true);
    if (layoutChanged) this.reset();
    this.camera.updateMatrixWorld(); this.projectLabels();
  }

  zoomPercent(modelZoom = 100) {
    return Math.round(modelZoom * this.baseDistance / this.controls.getDistance());
  }

  worldPerPixel() {
    return 2 * this.controls.getDistance() * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / this.height;
  }

  projectLabels() {
    for (const record of this.records.values()) {
      if (!record.label) continue;
      const world = record.mesh.getWorldPosition(new THREE.Vector3());
      const point = world.clone().project(this.camera);
      record.label.hidden = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.3 || Math.abs(point.y) > 1.3;
      const scale = THREE.MathUtils.clamp(this.height / (2 * Math.tan(Math.PI / 8) * this.camera.position.distanceTo(world)) * this.root.scale.x, .85, 1.8);
      record.label.style.left = `${(point.x + 1) * this.width / 2}px`;
      record.label.style.top = `${(1 - point.y) * this.height / 2}px`;
      record.label.style.transform = `translate(-50%, -50%) scale(${scale})`;
      record.label.style.zIndex = String(Math.round((1 - point.z) * 10000));
    }
  }

  dragPosition(object, start, end, startX = object.x, startY = object.y) {
    this.root.updateMatrixWorld(true); this.camera.updateMatrixWorld();
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, this.root.localToWorld(new THREE.Vector3(0, 0, this.depth(object))));
    const intersect = point => {
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(point.x * 2 - 1, 1 - point.y * 2), this.camera);
      const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
      return hit ? this.root.worldToLocal(hit) : null;
    };
    const a = intersect(start), b = intersect(end);
    return a && b ? { x: startX + (b.x - a.x) / WIDTH * 100, y: startY - (b.y - a.y) / HEIGHT * 100 } : { x: startX, y: startY };
  }

  navigate(delta) {
    if (!this.keys.size) return;
    const speed = this.controls.getDistance() * delta * (this.keys.has('shift') ? 1.2 : .45);
    const axis = (positive, negative) => Number(this.keys.has(positive)) - Number(this.keys.has(negative));
    const displacement = new THREE.Vector3(axis('d', 'a'), axis('e', 'q'), axis('s', 'w')).applyQuaternion(this.camera.quaternion).multiplyScalar(speed);
    this.camera.position.add(displacement); this.controls.target.add(displacement); this.dirty = true;
  }

  stopInertia() {
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = damping;
  }

  orbitBy(dx, dy) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= dx * Math.PI * 2;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - dy * Math.PI, .06, Math.PI - .06);
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(spherical));
    this.controls.update(); this.dirty = true;
  }

  dollyTo(distance) {
    const offset = this.camera.position.clone().sub(this.controls.target).normalize();
    const bounded = THREE.MathUtils.clamp(distance, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.multiplyScalar(bounded));
    this.controls.update(); this.dirty = true;
  }

  focusSelected() {
    const records = [...(this.selectedIds || [this.selectedId])].map(id => this.records.get(id)).filter(Boolean);
    if (!records.length) return;
    this.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    for (const record of records) bounds.expandByObject(record.mesh);
    const target = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const distance = records.length === 1 ? 500 : Math.max(500, Math.max(size.x / this.camera.aspect, size.y) / (2 * Math.tan(Math.PI / 8)) * 1.4 + size.z);
    const offset = this.camera.position.clone().sub(this.controls.target).normalize().multiplyScalar(distance);
    this.controls.target.copy(target); this.camera.position.copy(target).add(offset); this.controls.update(); this.dirty = true;
  }

  topView() {
    const distance = this.controls.getDistance();
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3(0, distance, .01));
    this.controls.update(); this.dirty = true;
  }

  destroy() {
    cancelAnimationFrame(this.frame); this.resizeObserver.disconnect(); this.controls.dispose();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur);
    this.scene.traverse(object => { if (object.material) object.material.dispose(); });
    this.boxGeometry.dispose(); this.edgeGeometry.dispose(); this.linkGeometry.dispose(); this.grid.geometry.dispose();
    this.renderer.dispose(); this.canvas.remove();
  }
}
