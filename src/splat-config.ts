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

export const CAMERA_POSE: CameraPose | null = {
    position: [3.570438493421631, 1.1991793421039665, 1.7360051815390003],
    target: [1.7820000856495253, 0.9280028345485022, -1.089385464274304],
    fov: 75
};

// Product exploration is deliberately split into two kinds of chapters:
// complete motorcycle views first, then technical details. Starter poses are
// placeholders only; every chapter can be reframed directly in Edit mode.
export const PRODUCT_VIEWS: ProductView[] = [
    {
        id: 'general',
        number: 1,
        title: 'Vista general',
        description: 'KTM 390 DUKE completa: proporciones, postura y diseño general.',
        position: [3.570438493421631, 1.1991793421039665, 1.7360051815390003],
        target: [1.7820000856495253, 0.9280028345485022, -1.089385464274304],
        fov: 75
    },
    {
        id: 'three-quarter',
        number: 2,
        title: 'Vista ¾',
        description: 'Vista de producto en tres cuartos para apreciar volumen, frontal y perfil en una sola composición.',
        position: [3.570438493421631, 1.1991793421039665, 1.7360051815390003],
        target: [1.7820000856495253, 0.9280028345485022, -1.089385464274304],
        fov: 75
    },
    {
        id: 'front',
        number: 3,
        title: 'Vista frontal',
        description: 'Frontal de la 390 DUKE: óptica, anchura y postura visual de la moto.',
        position: [3.570438493421631, 1.1991793421039665, 1.7360051815390003],
        target: [1.7820000856495253, 0.9280028345485022, -1.089385464274304],
        fov: 75
    },
    {
        id: 'rear',
        number: 4,
        title: 'Vista posterior',
        description: 'Colín, rueda trasera y proporciones vistas desde la parte posterior.',
        position: [-1.0314198612536778, 0.9917037544432161, 1.2774425043114086],
        target: [2.865817609080557, 0.9917037544432161, -0.8302069375459962],
        fov: 60
    },
    {
        id: 'engine',
        number: 5,
        title: 'Motor LC4c 399 cc',
        description: 'Detalle del monocilíndrico LC4c de 398,7 cc, 45 PS y 39 Nm.',
        position: [2.8659650360794737, 0.6097127777606907, 0.47111962759467496],
        target: [1.75, 0.18, -1.12],
        fov: 58
    },
    {
        id: 'rear-suspension',
        number: 6,
        title: 'Suspensión trasera WP APEX',
        description: 'Detalle del monoamortiguador trasero WP APEX y su integración en la parte ciclo.',
        position: [-1.0314198612536778, 0.9917037544432161, 1.2774425043114086],
        target: [2.865817609080557, 0.9917037544432161, -0.8302069375459962],
        fov: 60
    },
    {
        id: 'brakes',
        number: 7,
        title: 'Sistema de frenos',
        description: 'Detalle del conjunto de frenado. La 390 DUKE incorpora además Cornering ABS y modo Supermoto ABS.',
        position: [1.9421568272252345, 0.5371758804600747, -1.3574899368108149],
        target: [2.08702064647823, 0.5308441551306887, -1.2346153129380828],
        fov: 56
    },
    {
        id: 'chassis',
        number: 8,
        title: 'Chasis y parte ciclo',
        description: 'Detalle del bastidor, subchasis, basculante y arquitectura estructural de la moto.',
        position: [2.4710179488241817, 0.754674206124277, 1.427477145612344],
        target: [1.5709381048809798, 0.44768347007372056, -0.7902540128824319],
        fov: 54
    }
];
