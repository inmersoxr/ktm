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

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [DEVICETYPE_WEBGL2],
    antialias: false,
    xrCompatible: true
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const options = new AppOptions();
options.graphicsDevice = device;
options.componentSystems = [CameraComponentSystem, GSplatComponentSystem];
options.resourceHandlers = [TextureHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.start();

const camera = new Entity('AR Camera');
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

startButton.addEventListener('click', () => {
    if (!camera.camera || !app.xr?.supported || !app.xr.isAvailable(XRTYPE_AR)) {
        setStatus('La RA WebXR no está disponible en este navegador. Abre este enlace en Chrome para Android con servicios de RA de Google activos.');
        return;
    }

    app.xr.start(camera.camera, XRTYPE_AR, XRSPACE_LOCALFLOOR, {
        callback: (error) => {
            if (error) {
                console.error(error);
                setStatus('No se pudo iniciar la sesión RA en este dispositivo.');
            }
        }
    });
});

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
