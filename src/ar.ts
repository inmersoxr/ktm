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

const nativeXr = (navigator as any).xr;
const hasNativeWebXr = !!nativeXr && typeof nativeXr.requestSession === 'function';
const isAndroid = /Android/i.test(navigator.userAgent);
const isChrome = navigator.userAgent.includes('Chrome/') && !['SamsungBrowser', 'EdgA/', 'OPR/', 'UCBrowser'].some((token) => navigator.userAgent.includes(token));
const isEmbeddedBrowser = ['Instagram', 'FBAN', 'FBAV', 'FB_IAB', 'Messenger', 'TikTok', 'Line/'].some((token) => navigator.userAgent.includes(token));
const chromeStoreUrl = 'https://play.google.com/store/apps/details?id=com.android.chrome';
const arServicesUrl = 'https://play.google.com/store/apps/details?id=com.google.ar.core';
let arReady = false;
let arBusy = false;
let useAnchors = true;
let lastXrError: { name: string; message: string } | null = null;

const repairButton = document.createElement('button');
repairButton.id = 'ar-repair';
repairButton.type = 'button';
repairButton.hidden = true;
arUi.appendChild(repairButton);

const setRepair = (label?: string, action?: () => void) => {
    repairButton.hidden = !label || !action;
    repairButton.textContent = label ?? '';
    repairButton.onclick = action ?? null;
};

const openInChrome = () => {
    // Only navigate from a direct tap. Browsers may block Android intents.
    const url = new URL(window.location.href);
    const target = `${url.host}${url.pathname}${url.search}`;
    window.location.href = `intent://${target}#Intent;scheme=${url.protocol === 'http:' ? 'http' : 'https'};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
};

const showChromeAction = (message: string) => {
    setStatus(message);
    startButton.textContent = 'Abrir en Chrome';
    startButton.disabled = false;
    setRepair('Instalar o actualizar Chrome', () => window.location.assign(chromeStoreUrl));
};

const showArServicesAction = (message: string) => {
    setStatus(message);
    startButton.textContent = 'Volver a comprobar';
    startButton.disabled = false;
    setRepair('Comprobar servicios de RA', () => window.location.assign(arServicesUrl));
};

const showReady = () => {
    if (arBusy || arApp?.xr?.active || bootstrapError) return;
    setRepair();
    startButton.textContent = 'Iniciar RA';
    startButton.disabled = false;
    setStatus(splatEntity ? 'Modelo listo. Pulsa “Iniciar RA”.' : 'RA disponible. Cargando motocicleta…');
};

const checkArSupport = async () => {
    if (arBusy || arApp?.xr?.active) return;
    arReady = false;
    if (isAndroid && isEmbeddedBrowser) {
        showChromeAction('Abre esta experiencia en Chrome para utilizar la realidad aumentada.');
        return;
    }
    if (!window.isSecureContext) {
        setStatus('La RA necesita una conexión HTTPS. Abre la dirección segura de esta página.');
        startButton.textContent = 'Reintentar';
        setRepair();
        return;
    }
    if (!hasNativeWebXr) {
        if (isAndroid) {
            showChromeAction(isChrome
                ? 'Chrome no ofrece WebXR aquí. Comprueba si está actualizado.'
                : 'Este navegador no ofrece WebXR. Abre la experiencia en Chrome.');
        } else {
            setStatus('Este navegador no ofrece WebXR para esta experiencia.');
            startButton.textContent = 'Volver a comprobar';
            setRepair();
        }
        return;
    }
    if (typeof nativeXr.isSessionSupported !== 'function') {
        showArServicesAction('No se pudo comprobar la RA. Revisa los servicios de RA o actualiza Chrome.');
        return;
    }
    setStatus('Comprobando realidad aumentada…');
    try {
        arReady = await nativeXr.isSessionSupported('immersive-ar');
        if (arReady) {
            showReady();
        } else if (isAndroid && !isChrome) {
            showChromeAction('Este navegador no permite iniciar RA. Ábrelo en Chrome.');
        } else {
            showArServicesAction('La RA todavía no está disponible en Chrome. Comprueba o actualiza los servicios de RA y vuelve aquí.');
        }
    } catch (error) {
        console.error('WebXR availability check:', error);
        showArServicesAction('Chrome no pudo comprobar la RA. Comprueba los servicios de RA y vuelve a intentar.');
    }
};

const showSessionError = (error: Error) => {
    const name = error.name || 'Error';
    const message = error.message || String(error);
    lastXrError = { name, message };
    console.error('AR session:', { name, message, browser: navigator.userAgent, anchors: useAnchors });
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('Chrome no pudo acceder a la cámara o iniciar la RA. Permite el acceso a la cámara en la configuración de este sitio y vuelve a intentar.');
        startButton.textContent = 'Reintentar RA';
        setRepair('Volver a comprobar', () => void checkArSupport());
    } else if (name === 'NotSupportedError' && useAnchors) {
        // The requested anchors may be unsupported even when immersive-ar works.
        // The retry must happen on the user's next tap to retain user activation.
        useAnchors = false;
        setStatus('Este teléfono rechazó la configuración avanzada. Prueba la RA sin anclajes.');
        startButton.textContent = 'Reintentar RA';
        setRepair('Comprobar servicios de RA', () => window.location.assign(arServicesUrl));
    } else if (name === 'NotSupportedError' && isAndroid && !isChrome) {
        showChromeAction('Este navegador no pudo iniciar RA. Prueba en Chrome.');
    } else if (name === 'NotSupportedError' && isAndroid) {
        showArServicesAction('Chrome no pudo iniciar la RA. Comprueba o actualiza los servicios de RA y vuelve a intentar.');
    } else if (name === 'InvalidStateError') {
        setStatus('La sesión anterior sigue activa o no ha terminado de cerrarse. Vuelve a intentar.');
        startButton.textContent = 'Reintentar RA';
        setRepair();
    } else {
        setStatus('La sesión RA no se inició. Puedes volver a intentar o comprobar los servicios de RA.');
        startButton.textContent = 'Reintentar RA';
        setRepair(isAndroid ? 'Comprobar servicios de RA' : undefined,
            isAndroid ? () => window.location.assign(arServicesUrl) : undefined);
    }
};

if (isAndroid && isEmbeddedBrowser) {
    showChromeAction('Este navegador interno no ofrece una experiencia RA fiable. Abre en Chrome.');
} else if (!hasNativeWebXr && isAndroid) {
    showChromeAction('Este navegador no ofrece WebXR. Abre en Chrome.');
}

window.addEventListener('error', (event) => {
    bootstrapError = event.message || 'Error de inicialización';
    setStatus(`Error de RA: ${bootstrapError}`);
    setRepair();
});

window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    bootstrapError = reason;
    setStatus(`Error de RA: ${reason}`);
    setRepair();
});

const startAr = () => {
    if (arBusy) return;
    if (isAndroid && (isEmbeddedBrowser || (!isChrome && (!hasNativeWebXr || !arReady)))) {
        openInChrome();
        return;
    }
    if (bootstrapError) {
        setStatus(`Error de RA: ${bootstrapError}`);
        return;
    }
    if (!hasNativeWebXr || !arReady) {
        void checkArSupport();
        return;
    }
    if (!arApp || !arCamera?.camera || !arApp.xr) {
        setStatus('La RA se está inicializando. Inténtalo nuevamente en un momento.');
        return;
    }

    arBusy = true;
    startButton.disabled = true;
    setRepair();
    setStatus('Solicitando sesión RA…');

    // PlayCanvas may lag behind the native API's capability check.
    const xr = arApp.xr as any;
    if (xr._available) xr._available[XRTYPE_AR] = true;

    xr.start(arCamera.camera, XRTYPE_AR, XRSPACE_LOCAL, {
        anchors: useAnchors,
        callback: (error: Error | null) => {
            arBusy = false;
            startButton.disabled = false;
            if (error) showSessionError(error);
            else lastXrError = null;
        }
    });
};

startButton.addEventListener('click', startAr);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !arApp?.xr?.active && !arBusy) void checkArSupport();
});
void checkArSupport();

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
    if (arReady) showReady();
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
    setRepair();
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
    void checkArSupport();
});

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
