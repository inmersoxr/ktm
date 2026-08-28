export type CameraPose = {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
};

export type ProductView = CameraPose & {
    id: string;
    number: number;
    title: string;
    description: string;
};

export const SPLAT_URL = "./splat/meta.json";

// Initial camera pose authored in SuperSplat. Null falls back to auto-framing.
export const CAMERA_POSE: CameraPose | null = {
    "position": [
        3.442340612411499,
        0.9369392991065979,
        1.9247454404830933
    ],
    "target": [
        1.9566744836855152,
        0.4368972023895422,
        -1.1801540713340013
    ],
    "fov": 75
};

// Camera presets are intentionally data-only so they can be refined in Edit mode.
// No color/material overrides are applied: the Gaussian always renders as captured.
export const PRODUCT_VIEWS: ProductView[] = [
    { id: 'general', number: 1, title: 'Vista general', description: 'KTM Duke 390 — diseño compacto, postura agresiva y carácter urbano.', position: [3.4423, 0.9369, 1.9247], target: [1.9567, 0.4369, -1.1802], fov: 75 },
    { id: 'motor', number: 2, title: 'Motor', description: 'El corazón monocilíndrico de la Duke, ligero y diseñado para una respuesta directa.', position: [3.05, 0.38, -0.25], target: [1.75, 0.18, -1.12], fov: 58 },
    { id: 'front', number: 3, title: 'Suspensión delantera', description: 'Tren delantero, horquilla y geometría de dirección de respuesta precisa.', position: [2.72, 0.72, -2.55], target: [1.52, 0.42, -1.52], fov: 56 },
    { id: 'exhaust', number: 4, title: 'Escape', description: 'Sistema de escape integrado en la silueta compacta de la motocicleta.', position: [1.15, 0.38, 0.48], target: [1.78, 0.25, -1.18], fov: 54 },
    { id: 'rear', number: 5, title: 'Parte posterior', description: 'Colín, rueda trasera y proporciones tensas vistas desde atrás.', position: [-0.2, 0.9, -0.25], target: [1.62, 0.48, -1.25], fov: 60 }
];
