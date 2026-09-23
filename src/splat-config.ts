export type CameraPose = {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
};

export type ProductView = CameraPose & {
    id: string;
    number: number;
    title: string;
    navLabel: string;
    kicker: string;
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
        title: 'KTM 390 DUKE',
        navLabel: 'General',
        kicker: 'NAKED · READY TO RACE',
        description: 'Diseño agresivo, un motor LC4c de 398,7 cc y una respuesta que invita a disfrutar cada curva. Una naked compacta con auténtico carácter KTM.',
        position: [3.6796885395331476, 1.5493213238564685, 2.0200847155151145],
        target: [1.7131805035335086, 1.1991350829646437, -1.081999678486799],
        fov: 75
    },
    {
        id: 'three-quarter',
        number: 2,
        title: 'Diseño que se hace notar',
        navLabel: 'Diseño',
        kicker: 'IDENTIDAD KTM',
        description: 'Líneas afiladas, depósito musculoso y el inconfundible naranja KTM. Una silueta deportiva que destaca en cada recorrido.',
        position: [5.398712117605041, 1.379814896704239, 0.16444443794089614],
        target: [2.6077714821177462, 1.2360396175644714, -0.39834665107877865],
        fov: 75
    },
    {
        id: 'front',
        number: 3,
        title: 'Una mirada inconfundible',
        navLabel: 'Frontal',
        kicker: 'PRESENCIA DUKE',
        description: 'Óptica de personalidad marcada y una postura deportiva que expresan el carácter de la 390 DUKE desde el primer instante.',
        position: [4.485383222368742, 1.0946773019101497, -1.6909231492206986],
        target: [1.6107872213741286, 1.0946773019101497, 0.03869495000220746],
        fov: 75
    },
    {
        id: 'rear',
        number: 4,
        title: 'Carácter hasta el último detalle',
        navLabel: 'Trasera',
        kicker: 'DISEÑO DEPORTIVO',
        description: 'Colín compacto, ruedas de aleación y una presencia decidida. Cada detalle refleja el ADN deportivo de KTM.',
        position: [-0.3356444347901393, 1.2016859086797782, 1.074094086277257],
        target: [2.7051561438354543, 1.198388219796843, -0.5853858880143752],
        fov: 60
    },
    {
        id: 'engine',
        number: 5,
        title: 'LC4c · 398,7 cc',
        navLabel: 'Motor',
        kicker: 'MOTOR MONOCILÍNDRICO',
        description: 'Hasta 45 PS y 39 Nm de par: respuesta directa, agilidad urbana y energía de sobra para encadenar curvas.',
        position: [2.868315531022465, 0.43412708597954286, 0.2411656768058119],
        target: [1.6756127689684437, 0.24060954711632165, -1.1052526568155234],
        fov: 58
    },
    {
        id: 'rear-suspension',
        number: 6,
        title: 'Precisión en cada curva',
        navLabel: 'Suspensión',
        kicker: 'WP APEX',
        description: 'La suspensión WP APEX acompaña cada cambio de ritmo y aporta respuesta y control a la conducción deportiva.',
        position: [2.0690354264451134, 0.5654275384277733, 0.3658071699592362],
        target: [2.035663857796218, 0.5278788171118406, -0.49672651258500816],
        fov: 60
    },
    {
        id: 'brakes',
        number: 7,
        title: 'Frenada con confianza',
        navLabel: 'Frenos',
        kicker: 'SEGURIDAD Y CONTROL',
        description: 'Un sistema de frenos preparado para una conducción precisa, con Cornering ABS y modo Supermoto ABS.',
        position: [1.922717078174622, 0.38595881083279737, 0.4611693187237943],
        target: [1.5954522143547045, 0.3565323086185131, -0.23375241874604744],
        fov: 56
    },
    {
        id: 'chassis',
        number: 8,
        title: 'Agilidad por naturaleza',
        navLabel: 'Chasis',
        kicker: 'ESTRUCTURA DUKE',
        description: 'El bastidor, el subchasis y el basculante forman una estructura compacta pensada para reaccionar con agilidad.',
        position: [1.277675503267833, 0.9375674625459804, -2.1539673348917545],
        target: [1.8595303837529924, 0.9363021420135542, -0.9590198542411299],
        fov: 54
    }
];
