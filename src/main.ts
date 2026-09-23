import {
    AppBase,
    AppOptions,
    Asset,
    CameraComponentSystem,
    Color,
    DEVICETYPE_WEBGPU,
    DEVICETYPE_WEBGL2,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    RESOLUTION_AUTO,
    TextureHandler,
    Vec3,
    XRSPACE_LOCALFLOOR,
    XRTYPE_AR,
    createGraphicsDevice
} from 'playcanvas';
import type { BoundingBox } from 'playcanvas';

import './style.css';
import type { CameraPose, ProductView } from './splat-config';
import { CAMERA_POSE, PRODUCT_VIEWS, SPLAT_URL } from './splat-config';

const canvas = document.querySelector<HTMLCanvasElement>('#app');
const loader = document.querySelector<HTMLDivElement>('#loader');
const loaderMessage = document.querySelector<HTMLDivElement>('#loader-message');
const loaderProgressBar = document.querySelector<HTMLDivElement>('#loader-progress-bar');

if (!canvas) {
    throw new Error('Missing #app canvas');
}

const DEFAULT_FOV = 75;
const DEFAULT_CAMERA_DIRECTION = new Vec3(2, 1, 2).normalize();
const DEFAULT_PITCH = (Math.asin(DEFAULT_CAMERA_DIRECTION.y) * 180) / Math.PI;
const DEFAULT_YAW = (Math.atan2(DEFAULT_CAMERA_DIRECTION.x, DEFAULT_CAMERA_DIRECTION.z) * 180) / Math.PI;
const ORBIT_SENSITIVITY = (18 * 0.5) / 60;
const TRACKPAD_ORBIT_SENSITIVITY = (18 * 0.75) / 60;
const MOVE_SPEED = 4;
const FLY_MOVE_ACCELERATION_DAMPING = 0.992;
const FLY_MOVE_DECELERATION_DAMPING = 0.993;
const WHEEL_ZOOM_SPEED = 0.06 / 60;
const PINCH_ZOOM_SPEED = WHEEL_ZOOM_SPEED * 2;
const MIN_PITCH = 0;
const MAX_PITCH = 90;
const MIN_SCENE_RADIUS = 0.5;

type DragMode = 'orbit' | 'pan' | 'dolly';

const setLoadingState = (message: string, progress?: number, failed = false) => {
    if (loaderMessage) {
        loaderMessage.textContent = message;
    }

    if (loaderProgressBar && progress !== undefined) {
        loaderProgressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
    }

    if (loader) {
        loader.dataset.state = failed ? 'error' : 'loading';
    }
};

const hideLoader = () => {
    if (loader) {
        loader.dataset.hidden = 'true';
    }
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU],

    // Gaussian splats do not benefit from antialiasing and it is expensive.
    antialias: false
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);
console.info('[KTM viewer] graphics device:', device.deviceType);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [CameraComponentSystem, GSplatComponentSystem];
createOptions.resourceHandlers = [TextureHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.start();

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.02, 0.025, 0.035),
    fov: DEFAULT_FOV
});
app.root.addChild(camera);

const target = new Vec3(0, 0, 0);
const cameraPosition = new Vec3();
const forward = new Vec3();
const right = new Vec3();
const up = new Vec3();
const move = new Vec3();
const desiredMove = new Vec3();
const flyVelocity = new Vec3();
const nextTarget = new Vec3();
const worldAabbCenter = new Vec3();
const splatCenter = new Vec3();
const pressedKeys = new Set<string>();
let yaw = DEFAULT_YAW;
let pitch = DEFAULT_PITCH;
let distance = 3;
let fov = DEFAULT_FOV;
let sceneRadius = 1;
let dragMode: DragMode | null = null;
let activePointerId: number | null = null;
let lastPointerX = 0;
let lastPointerY = 0;
const touchPointers = new Map<number, { x: number; y: number }>();
let pinchStartDistance = 0;
let pinchStartCameraDistance = 0;
let pinchLastCenterX = 0;
let pinchLastCenterY = 0;

let splatPivot: Entity | null = null;
let modelYaw = 0;
let isControlKeyDown = false;
let activeView = 0;
let transition: { start: number; duration: number; from: CameraPose; to: CameraPose } | null = null;
let splatEntity: Entity | null = null;
let splatBounds: BoundingBox | undefined;
const CAMERA_STORAGE_KEY = 'ktm-camera-views-v7';

const isFinitePose = (pose: Partial<CameraPose> | null | undefined): pose is CameraPose =>
    !!pose &&
    Array.isArray(pose.position) &&
    pose.position.length === 3 &&
    pose.position.every(Number.isFinite) &&
    Array.isArray(pose.target) &&
    pose.target.length === 3 &&
    pose.target.every(Number.isFinite) &&
    Number.isFinite(pose.fov);

const loadSavedViews = (): ProductView[] => {
    try {
        const raw = localStorage.getItem(CAMERA_STORAGE_KEY);
        if (!raw) return PRODUCT_VIEWS.map((view) => ({ ...view }));
        const saved = JSON.parse(raw) as ProductView[];
        if (!Array.isArray(saved)) return PRODUCT_VIEWS.map((view) => ({ ...view }));

        return PRODUCT_VIEWS.map((base) => {
            const override = saved.find((item) => item?.id === base.id);
            return override && isFinitePose(override)
                ? { ...base, position: [...override.position] as [number, number, number], target: [...override.target] as [number, number, number], fov: override.fov }
                : { ...base };
        });
    } catch {
        return PRODUCT_VIEWS.map((view) => ({ ...view }));
    }
};

let views: ProductView[] = loadSavedViews();

const updateCameraPosition = () => {
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const cosPitch = Math.cos(pitchRad);

    cameraPosition.set(
        target.x + distance * Math.sin(yawRad) * cosPitch,
        target.y + distance * Math.sin(pitchRad),
        target.z + distance * Math.cos(yawRad) * cosPitch
    );
};

const updateCamera = () => {
    updateCameraPosition();
    camera.setPosition(cameraPosition);
    camera.lookAt(target);
};

const getFrameDistance = (radius: number) => {
    const halfFovRad = (fov * Math.PI) / 360;
    return radius / Math.sin(halfFovRad);
};

const clampDistance = (value: number) => {
    const minDistance = Math.max(sceneRadius * 0.02, 0.02);
    const maxDistance = Math.max(sceneRadius * 40, 30);
    return Math.max(minDistance, Math.min(maxDistance, value));
};

const damp = (damping: number, dt: number) => 1 - Math.pow(damping, dt * 1000);

const setDefaultFrame = () => {
    target.set(0, 0, 0);
    sceneRadius = 1;
    yaw = DEFAULT_YAW;
    pitch = DEFAULT_PITCH;
    distance = getFrameDistance(sceneRadius);
    updateCamera();
};

const applyCameraPose = (pose: CameraPose) => {
    const dx = pose.position[0] - pose.target[0];
    const dy = pose.position[1] - pose.target[1];
    const dz = pose.position[2] - pose.target[2];
    const poseDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // a pose looking at its own position has no view direction
    if (!Number.isFinite(poseDistance) || poseDistance < 1e-6) {
        return false;
    }

    target.set(pose.target[0], pose.target[1], pose.target[2]);
    yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
    pitch = Math.max(MIN_PITCH, (Math.asin(Math.max(-1, Math.min(1, dy / poseDistance))) * 180) / Math.PI);
    distance = poseDistance;
    fov = pose.fov;

    if (camera.camera) {
        camera.camera.fov = fov;
    }

    updateCamera();
    return true;
};

const focusMotorcycle = (frame = false) => {
    updateCameraPosition();
    const dx = cameraPosition.x - splatCenter.x;
    const dy = cameraPosition.y - splatCenter.y;
    const dz = cameraPosition.z - splatCenter.z;
    target.copy(splatCenter);
    distance = frame ? clampDistance(getFrameDistance(sceneRadius)) : clampDistance(Math.sqrt(dx * dx + dy * dy + dz * dz));
    yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
    pitch = (Math.asin(Math.max(-1, Math.min(1, dy / Math.max(distance, 1e-6)))) * 180) / Math.PI;
    updateCamera();
};

const currentPose = (): CameraPose => {
    updateCameraPosition();
    return {
        position: [cameraPosition.x, cameraPosition.y, cameraPosition.z],
        target: [target.x, target.y, target.z],
        fov
    };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const startViewTransition = (index: number) => {
    activeView = index;
    const view = views[index];

    // Presets are absolute world-space poses. Clear any residual navigation
    // state so the destination never depends on where the user was before.
    flyVelocity.set(0, 0, 0);
    desiredMove.set(0, 0, 0);
    pressedKeys.clear();
    dragMode = null;

    resetMotorcycleRotation();
    transition = { start: performance.now(), duration: 700, from: currentPose(), to: view };
    document.querySelectorAll<HTMLButtonElement>('.view-button').forEach((button, i) => button.classList.toggle('active', i === index));
    document.querySelector('#view-kicker')!.textContent = `${String(view.number).padStart(2, '0')} · EXPLORAR`;
    document.querySelector('#view-title')!.textContent = view.title;
    document.querySelector('#view-description')!.textContent = view.description;
    updateEditorLabel();
};

const viewNav = document.querySelector<HTMLElement>('#view-nav');
views.forEach((view, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `view-button${index === 0 ? ' active' : ''}`;
    button.innerHTML = `<span>${view.number}</span><small>${view.title}</small>`;
    button.addEventListener('click', () => startViewTransition(index));
    viewNav?.appendChild(button);
});

let editorOpen = false;
const headerActions = document.querySelector<HTMLElement>('.header-actions');
const editorToggle = document.createElement('button');
editorToggle.id = 'camera-editor-toggle';
editorToggle.type = 'button';
editorToggle.textContent = 'Ajustar vistas';
// Camera editor retired from the public viewer.

const editorPanel = document.createElement('div');
editorPanel.id = 'camera-editor';
editorPanel.innerHTML = `
    <div id="camera-editor-label"></div>
    <div class="camera-editor-actions">
        <button id="camera-save-view" type="button">Guardar esta vista</button>
        <button id="camera-copy-views" type="button">Copiar poses</button>
        <button id="camera-reset-views" type="button">Restaurar</button>
        <button id="camera-editor-done" type="button">Listo</button>
    </div>
    <div id="camera-editor-note">Mueve la cámara, selecciona una vista y guarda su posición. En móvil: arrastra para orbitar y pellizca con dos dedos para acercar o alejar.</div>
`;
// Editor panel intentionally not mounted.

const editorStyle = document.createElement('style');
editorStyle.textContent = `
#camera-editor-toggle {
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 999px;
    padding: 10px 15px;
    background: rgb(10 12 15 / 72%);
    color: #fff;
    cursor: pointer;
}
#camera-editor {
    position: fixed;
    z-index: 20;
    left: 50%;
    top: 76px;
    display: none;
    width: min(680px, calc(100vw - 28px));
    transform: translateX(-50%);
    box-sizing: border-box;
    padding: 14px;
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 14px;
    background: rgb(8 10 14 / 90%);
    backdrop-filter: blur(18px);
}
body.camera-editing #camera-editor { display: block; }
#camera-editor-label { margin-bottom: 10px; font-weight: 800; }
.camera-editor-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.camera-editor-actions button {
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 999px;
    padding: 10px 13px;
    background: rgb(255 255 255 / 8%);
    color: #fff;
}
#camera-save-view, #camera-editor-done { background: #ff5a18; color: #111; font-weight: 850; }
#camera-editor-note { margin-top: 9px; color: rgb(255 255 255 / 62%); font-size: 12px; line-height: 1.35; }
body.camera-editing #view-copy { opacity: .28; }
@media (max-width: 520px) {
    #camera-editor-toggle { padding: 9px 11px; font-size: 11px; }
    #camera-editor {
        top: 62px;
        bottom: auto;
        padding: 10px;
    }
    #camera-editor-label { margin-bottom: 7px; font-size: 12px; }
    .camera-editor-actions { gap: 6px; }
    .camera-editor-actions button { flex: 1 1 44%; padding: 8px 10px; font-size: 11px; }
    #camera-editor-note { margin-top: 6px; font-size: 10px; }
}
`;
document.head.appendChild(editorStyle);

const editorLabel = editorPanel.querySelector<HTMLDivElement>('#camera-editor-label');
const updateEditorLabel = () => {
    if (editorLabel) {
        const view = views[activeView];
        editorLabel.textContent = `Editando ${String(view.number).padStart(2, '0')} · ${view.title}`;
    }
};

const saveViews = () => {
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(views));
};

const saveCurrentView = () => {
    const pose = currentPose();
    const current = views[activeView];
    views[activeView] = {
        ...current,
        position: [...pose.position] as [number, number, number],
        target: [...pose.target] as [number, number, number],
        fov: pose.fov
    };
    saveViews();
    applyCameraPose(views[activeView]);
    updateEditorLabel();
    const note = editorPanel.querySelector<HTMLDivElement>('#camera-editor-note');
    if (note) note.textContent = `Vista ${String(current.number).padStart(2, '0')} guardada exactamente en esta posición.`;
};

editorToggle.addEventListener('click', () => {
    editorOpen = !editorOpen;
    document.body.classList.toggle('camera-editing', editorOpen);
    editorToggle.textContent = editorOpen ? 'Cerrar edición' : 'Ajustar vistas';
    updateEditorLabel();
});

editorPanel.querySelector<HTMLButtonElement>('#camera-save-view')?.addEventListener('click', saveCurrentView);

editorPanel.querySelector<HTMLButtonElement>('#camera-editor-done')?.addEventListener('click', () => {
    saveCurrentView();
    editorOpen = false;
    document.body.classList.remove('camera-editing');
    editorToggle.textContent = 'Ajustar vistas';
});

editorPanel.querySelector<HTMLButtonElement>('#camera-reset-views')?.addEventListener('click', () => {
    localStorage.removeItem(CAMERA_STORAGE_KEY);
    views = PRODUCT_VIEWS.map((view) => ({ ...view }));
    applyCameraPose(views[activeView]);
    updateEditorLabel();
    const note = editorPanel.querySelector<HTMLDivElement>('#camera-editor-note');
    if (note) note.textContent = 'Poses restauradas a los valores publicados.';
});

editorPanel.querySelector<HTMLButtonElement>('#camera-copy-views')?.addEventListener('click', async () => {
    const payload = JSON.stringify(views, null, 2);
    try {
        await navigator.clipboard.writeText(payload);
        const note = editorPanel.querySelector<HTMLDivElement>('#camera-editor-note');
        if (note) note.textContent = 'Poses copiadas. Puedes pegármelas para dejarlas publicadas para todos los dispositivos.';
    } catch {
        console.log(payload);
        const note = editorPanel.querySelector<HTMLDivElement>('#camera-editor-note');
        if (note) note.textContent = 'No pude copiar automáticamente; las poses quedaron impresas en la consola.';
    }
});

updateEditorLabel();

const xrButton = document.querySelector<HTMLButtonElement>('#xr-button');
const setArTransform = () => {
    if (!splatEntity || !splatBounds) return;
    const size = splatBounds.halfExtents.clone().mulScalar(2);
    const capturedLength = Math.max(size.x, size.y, size.z);
    const realLengthMeters = 2.05;
    const scale = realLengthMeters / capturedLength;
    const groundY = splatCenter.y - splatBounds.halfExtents.y;
    splatEntity.setLocalScale(scale, scale, scale);
    splatEntity.setLocalPosition(
        -splatCenter.x * scale,
        -groundY * scale,
        -1.65 - splatCenter.z * scale
    );
};

xrButton?.addEventListener('click', () => {
    window.location.href = './ar.html';
});

app.xr?.on('start', () => document.body.classList.add('xr-active'));
app.xr?.on('end', () => {
    document.body.classList.remove('xr-active');
    if (camera.camera) camera.camera.clearColor = new Color(0.02, 0.025, 0.035, 1);
    if (splatEntity) {
        splatEntity.setLocalScale(1, 1, 1);
        splatEntity.setLocalPosition(0, 0, 0);
    }
    applyCameraPose(views[activeView] ?? CAMERA_POSE!);
});

const frameSplat = (splat: Entity, aabb?: BoundingBox) => {
    if (aabb) {
        splat.getWorldTransform().transformPoint(aabb.center, worldAabbCenter);
        target.copy(worldAabbCenter);
        sceneRadius = Math.max(aabb.halfExtents.length(), MIN_SCENE_RADIUS);
    } else {
        target.set(0, 0, 0);
        sceneRadius = 1;
    }

    yaw = DEFAULT_YAW;
    pitch = DEFAULT_PITCH;
    distance = clampDistance(getFrameDistance(sceneRadius));
    updateCamera();
};

const updateBasis = () => {
    updateCameraPosition();
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const cosPitch = Math.cos(pitchRad);

    forward.set(-Math.sin(yawRad) * cosPitch, -Math.sin(pitchRad), -Math.cos(yawRad) * cosPitch).normalize();
    right.set(Math.cos(yawRad), 0, -Math.sin(yawRad)).normalize();
    up.cross(right, forward).normalize();
};

const panTarget = (deltaX: number, deltaY: number) => {
    updateBasis();

    const height = canvas.clientHeight || window.innerHeight;
    const width = canvas.clientWidth || window.innerWidth;
    const halfHeight = distance * Math.tan((fov * Math.PI) / 360);
    const halfWidth = halfHeight * (width / height);

    nextTarget
        .copy(right)
        .mulScalar((-deltaX / width) * halfWidth * 2)
        .add(up.clone().mulScalar((deltaY / height) * halfHeight * 2));

    target.add(nextTarget);
    updateCamera();
};

// Manual rotation is model-only. The camera never orbits around an arbitrary
// target: the motorcycle spins around a pivot located at its own physical center.
const rotateMotorcycle = (deltaX: number) => {
    if (!splatPivot) return;
    modelYaw -= deltaX * ORBIT_SENSITIVITY;
    splatPivot.setLocalEulerAngles(0, modelYaw, 0);
};

const resetMotorcycleRotation = () => {
    modelYaw = 0;
    splatPivot?.setLocalEulerAngles(0, 0, 0);
};

const getTouchPinchDistance = () => {
    const points = Array.from(touchPointers.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
};

canvas.addEventListener('pointerdown', (event) => {
    transition = null;

    if (event.pointerType === 'touch') {
        touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        canvas.setPointerCapture(event.pointerId);

        if (touchPointers.size === 1) {
            activePointerId = event.pointerId;
            dragMode = 'orbit';
            lastPointerX = event.clientX;
            lastPointerY = event.clientY;
        } else if (touchPointers.size === 2) {
            // Two fingers: pinch changes distance while centroid drag pans.
            dragMode = null;
            activePointerId = null;
            pinchStartDistance = getTouchPinchDistance();
            pinchStartCameraDistance = distance;
            const points = Array.from(touchPointers.values());
            pinchLastCenterX = (points[0].x + points[1].x) * 0.5;
            pinchLastCenterY = (points[0].y + points[1].y) * 0.5;
        }
        return;
    }

    if (activePointerId !== null) return;

    dragMode = event.button === 0
        ? 'orbit'
        : event.button === 1 || (event.button === 2 && (event.altKey || event.metaKey))
          ? 'dolly'
          : event.button === 2 && (event.shiftKey || event.ctrlKey)
            ? 'orbit'
            : 'pan';
    activePointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' && touchPointers.has(event.pointerId)) {
        touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (touchPointers.size >= 2) {
            const points = Array.from(touchPointers.values());
            const currentCenterX = (points[0].x + points[1].x) * 0.5;
            const currentCenterY = (points[0].y + points[1].y) * 0.5;
            const currentPinchDistance = getTouchPinchDistance();

            if (pinchStartDistance > 0 && currentPinchDistance > 0) {
                distance = clampDistance(pinchStartCameraDistance * (pinchStartDistance / currentPinchDistance));
                updateCamera();
            }

            const panX = currentCenterX - pinchLastCenterX;
            const panY = currentCenterY - pinchLastCenterY;
            if (Math.abs(panX) > 0.01 || Math.abs(panY) > 0.01) {
                panTarget(panX, panY);
            }

            pinchLastCenterX = currentCenterX;
            pinchLastCenterY = currentCenterY;
            return;
        }
    }

    if (activePointerId !== event.pointerId || !dragMode) return;

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    if (dragMode === 'pan') {
        panTarget(deltaX, deltaY);
    } else if (dragMode === 'dolly') {
        distance = clampDistance(distance * (1 + deltaY * 0.012));
        updateCamera();
    } else {
        rotateMotorcycle(deltaX);
    }
});

const endPointerDrag = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
        touchPointers.delete(event.pointerId);

        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }

        if (touchPointers.size === 1) {
            const [remainingId, point] = Array.from(touchPointers.entries())[0];
            activePointerId = remainingId;
            dragMode = 'orbit';
            lastPointerX = point.x;
            lastPointerY = point.y;
        } else if (touchPointers.size === 0) {
            activePointerId = null;
            dragMode = null;
        }

        pinchStartDistance = 0;
        pinchStartCameraDistance = distance;
        pinchLastCenterX = 0;
        pinchLastCenterY = 0;
        return;
    }

    if (activePointerId !== event.pointerId) return;

    dragMode = null;
    activePointerId = null;

    if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
    }
};

canvas.addEventListener('pointerup', endPointerDrag);
canvas.addEventListener('pointercancel', endPointerDrag);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener(
    'wheel',
    (event) => {
        event.preventDefault();
        transition = null;

        if (event.shiftKey) {
            panTarget(event.deltaX, event.deltaY);
            return;
        }

        const zoomSpeed = event.ctrlKey ? PINCH_ZOOM_SPEED : WHEEL_ZOOM_SPEED;
        distance = clampDistance(distance * (1 + event.deltaY * zoomSpeed));
        updateCamera();
    },
    { passive: false }
);

window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.altKey) {
        return;
    }

    transition = null;
    pressedKeys.add(event.code);

    if (event.code === 'KeyF') {
        event.preventDefault();
        focusMotorcycle(true);
    }

    if (event.code === 'ControlLeft' || event.code === 'ControlRight') {
        isControlKeyDown = true;
    }
});

window.addEventListener('keyup', (event) => {
    pressedKeys.delete(event.code);

    if (event.code === 'ControlLeft' || event.code === 'ControlRight') {
        isControlKeyDown = false;
    }
});

window.addEventListener('blur', () => {
    pressedKeys.clear();
    isControlKeyDown = false;
});

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const initialPose = views[0] ?? CAMERA_POSE;
if (!initialPose || !applyCameraPose(initialPose)) {
    setDefaultFrame();
}

app.on('update', (dt) => {
    if (transition) {
        const raw = Math.min(1, (performance.now() - transition.start) / transition.duration);
        const t = raw * raw * (3 - 2 * raw);
        const from = transition.from;
        const to = transition.to;
        applyCameraPose({
            position: [lerp(from.position[0], to.position[0], t), lerp(from.position[1], to.position[1], t), lerp(from.position[2], to.position[2], t)],
            target: [lerp(from.target[0], to.target[0], t), lerp(from.target[1], to.target[1], t), lerp(from.target[2], to.target[2], t)],
            fov: lerp(from.fov, to.fov, t)
        });
        if (raw >= 1) {
            applyCameraPose(to);
            transition = null;
        }
        return;
    }
    desiredMove.set(0, 0, 0);

    const strafe =
        Number(pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) -
        Number(pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft'));
    const lift = Number(pressedKeys.has('KeyE')) - Number(pressedKeys.has('KeyQ'));
    const advance =
        Number(pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) -
        Number(pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown'));

    if (strafe !== 0 || lift !== 0 || advance !== 0) {
        updateBasis();

        desiredMove.addScaled(right, strafe).addScaled(up, lift).addScaled(forward, advance);

        if (desiredMove.lengthSq() > 0) {
            const speedMultiplier =
                pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight')
                    ? 4
                    : pressedKeys.has('ControlLeft') || pressedKeys.has('ControlRight')
                      ? 0.25
                      : 1;

            desiredMove.normalize().mulScalar(MOVE_SPEED * speedMultiplier);
        }
    }

    const damping =
        desiredMove.lengthSq() > flyVelocity.lengthSq() ? FLY_MOVE_ACCELERATION_DAMPING : FLY_MOVE_DECELERATION_DAMPING;
    flyVelocity.lerp(flyVelocity, desiredMove, damp(damping, dt));

    if (desiredMove.lengthSq() === 0 && flyVelocity.lengthSq() < 1e-4) {
        flyVelocity.set(0, 0, 0);
    }

    if (flyVelocity.lengthSq() === 0) {
        return;
    }

    move.copy(flyVelocity).mulScalar(dt);
    target.add(move);
    updateCamera();
});

const filename = SPLAT_URL.split('/').pop() || 'splat';
const splatAsset = new Asset('SuperSplat', 'gsplat', {
    url: SPLAT_URL,
    filename
});

splatAsset.on('load', () => {
    const splat = new Entity('Splat');
    splatEntity = splat;
    splat.setLocalEulerAngles(0, 0, 180);
    splat.addComponent('gsplat', {
        asset: splatAsset
    });
    const resource = splatAsset.resource as { aabb?: BoundingBox } | null;
    const aabb = resource?.aabb;
    splatBounds = aabb;

    app.root.addChild(splat);
    if (aabb) splat.getWorldTransform().transformPoint(aabb.center, splatCenter);
    else splatCenter.set(0, 0, 0);

    // Put the Gaussian under a pivot at its actual center. Rotating this parent
    // keeps the motorcycle center fixed in world space, so it can only spin on
    // its own vertical axis and can never trace a circle around another pivot.
    const pivot = new Entity('SplatPivot');
    pivot.setPosition(splatCenter);
    app.root.addChild(pivot);
    splat.reparent(pivot);
    splat.setLocalPosition(-splatCenter.x, -splatCenter.y, -splatCenter.z);
    splatPivot = pivot;
    modelYaw = 0;

    // scene radius scales zoom/pan limits even when the authored pose wins
    if (aabb) {
        sceneRadius = Math.max(aabb.halfExtents.length(), MIN_SCENE_RADIUS);
    }

    const initialPose = views[0] ?? CAMERA_POSE;
    if (!initialPose || !applyCameraPose(initialPose)) {
        frameSplat(splat, aabb);
    }
    hideLoader();
});

splatAsset.on('progress', (received: number, length: number) => {
    if (length > 0) {
        const progress = Math.max(0, Math.min(1, received / length));
        setLoadingState(`Loading KTM 390 ${Math.floor(progress * 100)}%`, progress);
    }
});

splatAsset.on('error', (error: unknown) => {
    console.error(error);
    setLoadingState('Failed to load KTM 390.', 1, true);
});

app.assets.add(splatAsset);
app.assets.load(splatAsset);
