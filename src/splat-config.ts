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
    position: [3.570438493421631, 1.1991793421039665, 1.7360051815390003],
    target: [1.7820000856495253, 0.9280028345485022, -1.089385464274304],
    fov: 75
};

// Camera presets are intentionally data-only so they can be refined in Edit mode.
// No color/material overrides are applied: the Gaussian always renders as captured.
export const PRODUCT_VIEWS: ProductView[] = [
    {
        id: 'general',
        number: 1,
        title: 'Vista general',
        description: 'KTM Duke 390 — diseño compacto, postura agresiva y carácter urbano.',
        position: [3.570438493421631, 1.1991793421039665, 1.7360051815390003],
        target: [1.7820000856495253, 0.9280028345485022, -1.089385464274304],
        fov: 75
    },
    {
        id: 'motor',
        number: 2,
        title: 'Motor',
        description: 'El corazón monocilíndrico de la Duke, ligero y diseñado para una respuesta directa.',
        position: [2.8659650360794737, 0.6097127777606907, 0.47111962759467496],
        target: [1.75, 0.18, -1.12],
        fov: 58
    },
    {
        id: 'front',
        number: 3,
        title: 'Suspensión delantera',
        description: 'Tren delantero, horquilla y geometría de dirección de respuesta precisa.',
        position: [1.9421568272252345, 0.5371758804600747, -1.3574899368108149],
        target: [2.08702064647823, 0.5308441551306887, -1.2346153129380828],
        fov: 56
    },
    {
        id: 'exhaust',
        number: 4,
        title: 'Escape',
        description: 'Sistema de escape integrado en la silueta compacta de la motocicleta.',
        position: [2.4710179488241817, 0.754674206124277, 1.427477145612344],
        target: [1.5709381048809798, 0.44768347007372056, -0.7902540128824319],
        fov: 54
    },
    {
        id: 'rear',
        number: 5,
        title: 'Parte posterior',
        description: 'Colín, rueda trasera y proporciones tensas vistas desde atrás.',
        position: [-1.0314198612536778, 0.9917037544432161, 1.2774425043114086],
        target: [2.865817609080557, 0.9917037544432161, -0.8302069375459962],
        fov: 60
    }
];
