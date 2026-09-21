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
    position: [3.6796885395331476, 1.5493213238564685, 2.0200847155151145],
    target: [1.7131805035335086, 1.1991350829646437, -1.081999678486799],
    fov: 75
};

export const PRODUCT_VIEWS: ProductView[] = [
    {
        id: 'general',
        number: 1,
        title: 'Vista general',
        description: 'KTM 390 DUKE completa: proporciones, postura y diseño general.',
        position: [3.6796885395331476, 1.5493213238564685, 2.0200847155151145],
        target: [1.7131805035335086, 1.1991350829646437, -1.081999678486799],
        fov: 75
    },
    {
        id: 'three-quarter',
        number: 2,
        title: 'Vista ¾',
        description: 'Vista de producto en tres cuartos para apreciar volumen, frontal y perfil en una sola composición.',
        position: [5.398712117605041, 1.379814896704239, 0.16444443794089614],
        target: [2.6077714821177462, 1.2360396175644714, -0.39834665107877865],
        fov: 75
    },
    {
        id: 'front',
        number: 3,
        title: 'Vista frontal',
        description: 'Frontal de la 390 DUKE: óptica, anchura y postura visual de la moto.',
        position: [4.485383222368742, 1.0946773019101497, -1.6909231492206986],
        target: [1.6107872213741286, 1.0946773019101497, 0.03869495000220746],
        fov: 75
    },
    {
        id: 'rear',
        number: 4,
        title: 'Vista posterior',
        description: 'Colín, rueda trasera y proporciones vistas desde la parte posterior.',
        position: [-0.3356444347901393, 1.2016859086797782, 1.074094086277257],
        target: [2.7051561438354543, 1.198388219796843, -0.5853858880143752],
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
        position: [2.0690354264451134, 0.5654275384277733, 0.3658071699592362],
        target: [2.035663857796218, 0.5278788171118406, -0.49672651258500816],
        fov: 60
    },
    {
        id: 'brakes',
        number: 7,
        title: 'Sistema de frenos',
        description: 'Detalle del conjunto de frenado. La 390 DUKE incorpora además Cornering ABS y modo Supermoto ABS.',
        position: [1.922717078174622, 0.38595881083279737, 0.4611693187237943],
        target: [1.5954522143547045, 0.3565323086185131, -0.23375241874604744],
        fov: 56
    },
    {
        id: 'chassis',
        number: 8,
        title: 'Chasis y parte ciclo',
        description: 'Detalle del bastidor, subchasis, basculante y arquitectura estructural de la moto.',
        position: [3.05724272392482, 1.3144793668416264, 1.9715530241493908],
        target: [1.8873453634684665, 0.9068415082429181, -0.983394640473237],
        fov: 54
    }
];
