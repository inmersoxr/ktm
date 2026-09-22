import {
    AppBase,
    AppOptions,
    Asset,
    CameraComponentSystem,
    Color,
    DEVICETYPE_WEBGL2,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    RenderComponentSystem,
    RESOLUTION_AUTO,
    StandardMaterial,
    TextureHandler,
    XRSPACE_LOCAL,
    XRSPACE_VIEWER,
    XRTRACKABLE_PLANE,
    XRTRACKABLE_POINT,
    XRTARGETRAY_SCREEN,
    XRTYPE_AR,
    XrManager,
    createGraphicsDevice
} from 'playcanvas';
import type { BoundingBox, Quat, Vec3 } from 'playcanvas';

import { SPLAT_URL } from './splat-config';
import { createArDiagnostics } from './ar-diagnostics';

const canvas = document.querySelector<HTMLCanvasElement>('#ar-canvas');
const startButton = document.querySelector<HTMLButtonElement>('#ar-start');
const backButton = document.querySelector<HTMLButtonElement>('#ar-back');
const status = document.querySelector<HTMLDivElement>('#ar-status');
const arUi = document.querySelector<HTMLElement>('#ar-ui');

if (!canvas || !startButton || !backButton || !status || !arUi) {
    throw new Error('Missing AR interface');
}

const setStatus = (message: string) => {
    status.textContent = message;
};

let returnToViewerRequested = false;

const returnToViewer = () => {
    window.location.replace('./');
};

backButton.addEventListener('click', () => {
    const xr = arApp?.xr;

    if (!xr?.active) {
        returnToViewer();
        return;
    }

    if (returnToViewerRequested) return;

    returnToViewerRequested = true;
    backButton.disabled = true;
    setStatus('Saliendo de RA…');

    // End the XR session first. Navigation happens from the manager's 'end'
    // event, after PlayCanvas has completed its own WebXR teardown.
    xr.end((error) => {
        if (!error) return;

        console.error(error);
        returnToViewerRequested = false;
        backButton.disabled = false;
        setStatus('No se pudo cerrar la sesión RA. Intenta nuevamente.');
    });
});

// Register the user-action handler before graphics/model initialization.
// This keeps the button alive even if the AR renderer fails during startup.
let arApp: AppBase | null = null;
let arCamera: Entity | null = null;
let bootstrapError: string | null = null;

const diagnostics = createArDiagnostics(
    startButton,
    status,
    document.querySelector<HTMLElement>('#ar-guide')!
);
const nativeXr = (navigator as any).xr;

// Keep the session request within the actual button tap. An asynchronous
// capability check inside this handler would lose WebXR's user activation.
const startAr = () => {
    if (diagnostics.needsChrome) {
        diagnostics.openChrome();
        return;
    }
    if (bootstrapError) {
        diagnostics.showInitError(bootstrapError);
        return;
    }
    if (!diagnostics.canAttempt) {
        void diagnostics.check();
        return;
    }
    if (!arApp || !arCamera?.camera || !arApp.xr) {
        setStatus('Preparando RA. Espera un momento y vuelve a intentar.');
        return;
    }

    diagnostics.requesting();
    // PlayCanvas availability can lag behind navigator.xr on Android. Only
    // update its cached flag when the native API is actually present.
    const xr = arApp.xr as any;
    if (nativeXr?.requestSession && xr._available) {
        xr._available[XRTYPE_AR] = true;
    }

    xr.start(arCamera.camera, XRTYPE_AR, XRSPACE_LOCAL, {
        anchors: diagnostics.useAnchors,
        callback: (error: Error | null) => {
            if (error) diagnostics.handleError(error);
            else startButton.disabled = false;
        }
    });
};

startButton.addEventListener('click', startAr);

window.addEventListener('error', (event) => {
    bootstrapError = event.message || 'Error de inicialización';
    diagnostics.showInitError(bootstrapError);
});

window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    // Only report uncaught startup failures. Session errors are handled by
    // their callback and must not disable subsequent recovery attempts.
    if (!arApp?.xr?.active) {
        bootstrapError = reason;
        diagnostics.showInitError(reason);
    }
});

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [DEVICETYPE_WEBGL2],
    antialias: false,
    xrCompatible: true
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const options = new AppOptions();
options.graphicsDevice = device;
options.xr = XrManager;
options.componentSystems = [CameraComponentSystem, GSplatComponentSystem, RenderComponentSystem];
options.resourceHandlers = [TextureHandler, GSplatHandler];

const app = new AppBase(canvas);
arApp = app;
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.start();

if (app.xr) {
    app.xr.domOverlay.root = arUi;
}

const camera = new Entity('AR Camera');
arCamera = camera;
camera.addComponent('camera', {
    clearColor: new Color(0, 0, 0, 0),
    fov: 70
});
app.root.addChild(camera);

const modelRoot = new Entity('KTM Placement');
app.root.addChild(modelRoot);
modelRoot.enabled = false;

const reticle = new Entity('Surface Reticle');
reticle.addComponent('render', {
    type: 'torus',
    castShadows: false,
    receiveShadows: false
});
reticle.setLocalScale(0.10, 0.012, 0.10);
const reticleMaterial = new StandardMaterial();
reticleMaterial.diffuse = new Color(1, 0.22, 0);
reticleMaterial.emissive = new Color(1, 0.12, 0);
reticleMaterial.update();
if (reticle.render) {
    reticle.render.material = reticleMaterial;
}
reticle.enabled = false;
app.root.addChild(reticle);

let splatEntity: Entity | null = null;
let splatBounds: BoundingBox | undefined;
let placed = false;
let latestPosition: Vec3 | null = null;
let latestRotation: Quat | null = null;
let latestHitResult: any = null;
let activeAnchor: any = null;
let activeHitTestSource: any = null;
let userScale = 1;
let pinchStartDistance: number | null = null;
let pinchStartScale = 1;

const touchDistance = (touches: TouchList) => {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
};

arUi.style.touchAction = 'none';

arUi.addEventListener('touchstart', (event) => {
    if (!placed || event.touches.length !== 2) return;
    pinchStartDistance = touchDistance(event.touches);
    pinchStartScale = userScale;
    event.preventDefault();
}, { passive: false });

arUi.addEventListener('touchmove', (event) => {
    if (!placed || event.touches.length !== 2 || pinchStartDistance === null) return;

    const distance = touchDistance(event.touches);
    const ratio = distance / Math.max(pinchStartDistance, 1);
    userScale = Math.min(4, Math.max(0.15, pinchStartScale * ratio));
    modelRoot.setLocalScale(userScale, userScale, userScale);
    setStatus(`Tamaño: ${Math.round(userScale * 100)}%. Pellizca con dos dedos para ajustarlo.`);
    event.preventDefault();
}, { passive: false });

const endPinch = (event: TouchEvent) => {
    if (event.touches.length < 2) {
        pinchStartDistance = null;
    }
};

arUi.addEventListener('touchend', endPinch, { passive: true });
arUi.addEventListener('touchcancel', endPinch, { passive: true });

const filename = SPLAT_URL.split('/').pop() || 'splat';
const splatAsset = new Asset('KTM Duke 390', 'gsplat', {
    url: SPLAT_URL,
    filename
});

splatAsset.on('load', () => {
    const splat = new Entity('KTM Splat');
    splat.setLocalEulerAngles(0, 0, 180);
    splat.addComponent('gsplat', { asset: splatAsset });

    const resource = splatAsset.resource as { aabb?: BoundingBox } | null;
    splatBounds = resource?.aabb;

    if (splatBounds) {
        const size = splatBounds.halfExtents.clone().mulScalar(2);
        const capturedLength = Math.max(size.x, size.y, size.z);
        const scale = 2.05 / Math.max(capturedLength, 0.001);
        const center = splatBounds.center;
        // The splat is rotated 180° around Z below. That flips its Y axis.
        // Therefore the original +Y bound becomes the physical bottom after
        // rotation. Align that exact contact point with modelRoot origin.
        const contactY = center.y + splatBounds.halfExtents.y;

        splat.setLocalScale(scale, scale, scale);
        splat.setLocalPosition(
            center.x * scale,
            contactY * scale,
            -center.z * scale
        );
    }

    modelRoot.addChild(splat);
    splatEntity = splat;
    diagnostics.modelReady();
});

splatAsset.on('error', (error: unknown) => {
    console.error(error);
    setStatus('No se pudo cargar la motocicleta.');
    startButton.disabled = true;
});

app.assets.add(splatAsset);
app.assets.load(splatAsset);

const applyPlacementPose = (position: Vec3, rotation: Quat | null) => {
    modelRoot.setPosition(position);
    if (rotation) {
        modelRoot.setRotation(rotation);
    }
};

const placeAtLatestHit = () => {
    if (placed || !latestPosition || !splatEntity || !latestHitResult) return;

    // Freeze the exact hit pose represented by the visible reticle.
    const position = latestPosition.clone();
    const rotation = latestRotation?.clone() ?? null;
    const hitResult = latestHitResult;

    placed = true;
    reticle.enabled = false;

    // Once placed, the preview hit-test must stop. The reticle must not keep
    // moving and no later hit result may replace the selected physical point.
    activeHitTestSource?.remove();
    activeHitTestSource = null;

    applyPlacementPose(position, rotation);
    modelRoot.enabled = true;
    setStatus('KTM colocada. Pellizca con dos dedos para ajustar el tamaño.');

    // Create the anchor from the same XRHitTestResult used by the reticle.
    // This is the PlayCanvas/WebXR reference implementation path for stable
    // placement against evolving ARCore world tracking.
    if (!app.xr?.anchors.available) {
        setStatus('KTM colocada, pero WebXR no habilitó Anchors en esta sesión.');
        return;
    }

    app.xr.anchors.create(hitResult, (error, anchor) => {
        if (error || !anchor) {
            console.error(error);
            setStatus('KTM colocada, pero no se pudo crear el anchor.');
            return;
        }

        activeAnchor = anchor;

        const syncToAnchor = () => {
            if (activeAnchor !== anchor) return;
            modelRoot.setPosition(anchor.getPosition());
            modelRoot.setRotation(anchor.getRotation());
        };

        // The callback is issued after the first valid anchor pose exists.
        syncToAnchor();
        anchor.on('change', syncToAnchor);
        anchor.once('destroy', () => {
            if (activeAnchor === anchor) activeAnchor = null;
        });
    });
};

app.xr?.input.on('select', (inputSource) => {
    if ((inputSource as any).targetRayMode !== XRTARGETRAY_SCREEN) return;
    placeAtLatestHit();
});

app.xr?.on('start', () => {
    document.body.classList.add('xr-active');
    startButton.hidden = true;
    backButton.hidden = false;
    arUi.style.pointerEvents = 'auto';
    reticle.enabled = false;
    latestPosition = null;
    latestRotation = null;
    latestHitResult = null;
    placed = false;
    userScale = 1;
    pinchStartDistance = null;
    modelRoot.setLocalScale(1, 1, 1);
    diagnostics.started();
    setStatus('Mueve el teléfono lentamente y apunta a una superficie plana.');
});

app.xr?.hitTest.on('available', () => {
    if (placed || activeHitTestSource || !app.xr?.hitTest.supported) return;

    // Match the official PlayCanvas mobile AR hit-test flow: a viewer-space
    // ray continuously drives a placement reticle over detected planes/points.
    app.xr.hitTest.start({
        spaceType: XRSPACE_VIEWER,
        entityTypes: [XRTRACKABLE_PLANE, XRTRACKABLE_POINT],
        callback: (error, source) => {
            if (error || !source) {
                console.error(error);
                setStatus('No se pudo iniciar la detección de superficies.');
                return;
            }

            activeHitTestSource = source;

            source.on('result', (position, rotation, _inputSource, hitTestResult) => {
                if (placed) return;

                latestPosition = position.clone();
                latestRotation = rotation.clone();
                latestHitResult = hitTestResult ?? null;

                // The reticle and the eventual model placement use the exact
                // same world-space transform.
                reticle.setPosition(position);
                reticle.setRotation(rotation);
                reticle.enabled = true;
                setStatus('Superficie detectada. Toca el aro para colocar la KTM.');
            });

            source.once('remove', () => {
                if (activeHitTestSource === source) activeHitTestSource = null;
            });
        }
    });
});

app.xr?.on('end', () => {
    document.body.classList.remove('xr-active');
    startButton.hidden = false;
    backButton.hidden = false;
    arUi.style.pointerEvents = '';
    modelRoot.enabled = false;
    modelRoot.setLocalScale(1, 1, 1);
    userScale = 1;
    pinchStartDistance = null;
    placed = false;
    latestPosition = null;
    latestRotation = null;
    latestHitResult = null;
    reticle.enabled = false;

    // XR session end already owns disposal of native hit-test and anchor
    // resources. Calling remove()/destroy() here can race Android's teardown.
    activeHitTestSource = null;
    activeAnchor = null;

    if (returnToViewerRequested) {
        // Let the XR end event and the current frame settle before replacing
        // the AR document with the WebGPU viewer.
        window.setTimeout(returnToViewer, 50);
        return;
    }

    backButton.disabled = false;
    setStatus('Sesión RA finalizada.');
    diagnostics.ended();
});

// Passive capability check does not request a session or camera permission.
void diagnostics.check();

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
