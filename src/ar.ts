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
    RESOLUTION_AUTO,
    TextureHandler,
    XRSPACE_LOCALFLOOR,
    XRSPACE_VIEWER,
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

if (!canvas || !startButton || !backButton || !status) {
    throw new Error('Missing AR interface');
}

const setStatus = (message: string) => {
    status.textContent = message;
};

backButton.addEventListener('click', () => {
    window.location.href = './';
});

// Register the user-action handler before graphics/model initialization.
// This keeps the button alive even if the AR renderer fails during startup.
let arApp: AppBase | null = null;
let arCamera: Entity | null = null;
let bootstrapError: string | null = null;

window.addEventListener('error', (event) => {
    bootstrapError = event.message || 'Error de inicialización';
    setStatus(`Error de RA: ${bootstrapError}`);
});

window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    bootstrapError = reason;
    setStatus(`Error de RA: ${reason}`);
});

const startAr = () => {
    if (bootstrapError) {
        setStatus(`Error de RA: ${bootstrapError}`);
        return;
    }

    if (!arApp || !arCamera?.camera || !arApp.xr) {
        setStatus('La RA todavía se está inicializando. Espera un segundo y vuelve a tocar.');
        return;
    }

    setStatus('Solicitando sesión RA…');

    // PlayCanvas 2.20 gates start() on its cached availability flag before
    // calling navigator.xr.requestSession(). Force only that cache entry so
    // the browser itself becomes the authority. This route is isolated from
    // the WebGPU product viewer.
    const xr = arApp.xr as any;
    if (xr._available) xr._available[XRTYPE_AR] = true;

    xr.start(arCamera.camera, XRTYPE_AR, XRSPACE_LOCALFLOOR, {
        callback: (error: Error | null) => {
            if (error) {
                console.error(error);
                const name = error instanceof DOMException ? error.name : 'Error';
                const message = error instanceof Error ? error.message : String(error);
                setStatus(`${name}: ${message}`);
            }
        }
    });
};

startButton.addEventListener('click', startAr);

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [DEVICETYPE_WEBGL2],
    antialias: false,
    xrCompatible: true
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const options = new AppOptions();
options.graphicsDevice = device;
options.xr = XrManager;
options.componentSystems = [CameraComponentSystem, GSplatComponentSystem];
options.resourceHandlers = [TextureHandler, GSplatHandler];

const app = new AppBase(canvas);
arApp = app;
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.start();

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

let splatEntity: Entity | null = null;
let splatBounds: BoundingBox | undefined;
let placed = false;
let latestPosition: Vec3 | null = null;
let latestRotation: Quat | null = null;

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
        const groundY = center.y - splatBounds.halfExtents.y;

        splat.setLocalScale(scale, scale, scale);
        splat.setLocalPosition(
            center.x * scale,
            groundY * scale,
            -center.z * scale
        );
    }

    modelRoot.addChild(splat);
    splatEntity = splat;
    setStatus('Modelo listo. Pulsa “Iniciar RA”.');
});

splatAsset.on('error', (error: unknown) => {
    console.error(error);
    setStatus('No se pudo cargar la motocicleta.');
    startButton.disabled = true;
});

app.assets.add(splatAsset);
app.assets.load(splatAsset);

const placeAtLatestHit = () => {
    if (!latestPosition || !splatEntity) return;
    modelRoot.setPosition(latestPosition);
    if (latestRotation) {
        modelRoot.setRotation(latestRotation);
    }
    modelRoot.enabled = true;
    placed = true;
    setStatus('KTM colocada. Toca otra superficie para moverla.');
};

app.xr?.input.on('select', () => {
    placeAtLatestHit();
});

app.xr?.on('start', () => {
    document.body.classList.add('xr-active');
    startButton.hidden = true;
    backButton.hidden = true;
    setStatus('Mueve el teléfono para detectar el piso y toca donde quieras colocar la KTM.');

    if (!app.xr?.hitTest.supported) {
        setStatus('Este dispositivo inició RA, pero no ofrece detección de superficies WebXR.');
        return;
    }

    app.xr.hitTest.start({
        spaceType: XRSPACE_VIEWER,
        callback: (error, source) => {
            if (error || !source) {
                console.error(error);
                setStatus('No se pudo iniciar la detección del piso.');
                return;
            }

            source.on('result', (position, rotation) => {
                latestPosition = position.clone();
                latestRotation = rotation.clone();
                if (!placed) {
                    setStatus('Superficie detectada. Toca la pantalla para colocar la KTM.');
                }
            });
        }
    });
});

app.xr?.on('end', () => {
    document.body.classList.remove('xr-active');
    startButton.hidden = false;
    backButton.hidden = false;
    setStatus('Sesión RA finalizada.');
    modelRoot.enabled = false;
    placed = false;
    latestPosition = null;
    latestRotation = null;
});

if (app.xr) {
    const syncAvailability = () => {
        if (app.xr?.isAvailable(XRTYPE_AR)) {
            setStatus(splatEntity ? 'Modelo listo. Pulsa “Iniciar RA”.' : 'RA disponible. Cargando motocicleta…');
        }
    };
    app.xr.on('available', (type, available) => {
        if (type === XRTYPE_AR && available) syncAvailability();
    });
    syncAvailability();
}

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
