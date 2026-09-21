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

// Seven product chapters. The duplicated starter poses are intentional:
// they give every chapter a usable camera immediately, while Edit mode lets
// the final framing be authored directly in the live viewer.
export const PRODUCT_VIEWS: ProductView[] = [
    {
        id: 'general',
        number: 1,
        title: 'Vista general',
        description: 'KTM 390 DUKE — diseño naked compacto, agresivo y ligero, pensado para ciudad y conducción deportiva.',
        position: [3.570438493421631, 1.1991793421039665, 1.7360051815390003],
        target: [1.7820000856495253, 0.9280028345485022, -1.089385464274304],
        fov: 75
    },
    {
        id: 'engine',
        number: 2,
        title: 'Motor LC4c 399 cc',
        description: 'Monocilíndrico LC4c de 398,7 cc, 45 PS y 39 Nm: el núcleo mecánico de esta generación de la 390 DUKE.',
        position: [2.8659650360794737, 0.6097127777606907, 0.47111962759467496],
        target: [1.75, 0.18, -1.12],
        fov: 58
    },
    {
        id: 'suspension',
        number: 3,
        title: 'Suspensión WP APEX',
        description: 'Horquilla invertida WP APEX de 43 mm y conjunto ajustable orientado a precisión, apoyo y control.',
        position: [1.9421568272252345, 0.5371758804600747, -1.3574899368108149],
        target: [2.08702064647823, 0.5308441551306887, -1.2346153129380828],
        fov: 56
    },
    {
        id: 'brakes',
        number: 4,
        title: 'Frenos + Cornering ABS',
        description: 'Disco delantero de 320 mm, ABS en curva y Supermoto ABS para frenadas más controladas dentro y fuera de la trazada.',
        position: [1.9421568272252345, 0.5371758804600747, -1.3574899368108149],
        target: [2.08702064647823, 0.5308441551306887, -1.2346153129380828],
        fov: 56
    },
    {
        id: 'chassis',
        number: 5,
        title: 'Chasis Gen 3',
        description: 'Arquitectura revisada de bastidor y parte ciclo para una 390 DUKE más compacta, ágil y precisa.',
        position: [2.4710179488241817, 0.754674206124277, 1.427477145612344],
        target: [1.5709381048809798, 0.44768347007372056, -0.7902540128824319],
        fov: 54
    },
    {
        id: 'tft',
        number: 6,
        title: 'TFT + electrónica',
        description: 'Pantalla TFT de 5 pulgadas, modos Street y Rain, pantalla Track, Launch Control y ayudas electrónicas de esta generación.',
        position: [3.570438493421631, 1.1991793421039665, 1.7360051815390003],
        target: [1.7820000856495253, 0.9280028345485022, -1.089385464274304],
        fov: 75
    },
    {
        id: 'rear',
        number: 7,
        title: 'Parte posterior',
        description: 'Colín, rueda trasera y proporciones tensas que rematan el diseño compacto de la 390 DUKE.',
        position: [-1.0314198612536778, 0.9917037544432161, 1.2774425043114086],
        target: [2.865817609080557, 0.9917037544432161, -0.8302069375459962],
        fov: 60
    }
];
