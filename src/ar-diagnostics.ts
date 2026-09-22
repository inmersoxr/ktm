// Actionable, non-invasive browser diagnostics for the KTM WebXR page.
// Web pages cannot read ARCore's installed/updated state directly.
type XRProbe = {
    requestSession?: (mode: string) => Promise<unknown>;
    isSessionSupported?: (mode: string) => Promise<boolean>;
};

type Guide = {
    heading: string;
    message: string;
    steps: string[];
    link?: string;
    linkText?: string;
    primary?: string;
};

export function createArDiagnostics(
    startButton: HTMLButtonElement,
    status: HTMLElement,
    panel: HTMLElement
) {
    const heading = panel.querySelector<HTMLElement>('#ar-guide-heading')!;
    const message = panel.querySelector<HTMLElement>('#ar-guide-message')!;
    const steps = panel.querySelector<HTMLOListElement>('#ar-guide-steps')!;
    const link = panel.querySelector<HTMLAnchorElement>('#ar-guide-link')!;
    const settings = panel.querySelector<HTMLButtonElement>('#ar-guide-settings')!;
    const settingsPanel = panel.querySelector<HTMLElement>('#ar-chrome-steps')!;
    const xr = (navigator as Navigator & { xr?: XRProbe }).xr;
    const ua = navigator.userAgent;
    const android = /Android/i.test(ua);
    const embedded = /Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|Line\//i.test(ua);
    const chrome = /Chrome\/[0-9]+/i.test(ua) && !/SamsungBrowser|EdgA\/|OPR\/|UCBrowser/i.test(ua) && !embedded;
    const arStore = 'https://play.google.com/store/apps/details?id=com.google.ar.core';
    const chromeStore = 'https://play.google.com/store/apps/details?id=com.android.chrome';

    let support: boolean | null = null;
    let modelLoaded = false;
    let waiting = false;
    let issue = false;
    let advancedFeatures = true;
    let mustOpenChrome = android && embedded;

    const chromeSteps = [
        'En Chrome, toca ⋮ → Configuración → Configuración de sitios → Cámara. Permite la cámara para esta página.',
        'Si ya bloqueaste esta página, tócala en la lista de sitios y restablece sus permisos.',
        'En los ajustes del teléfono: Aplicaciones → Chrome → Permisos → Cámara. Comprueba que Chrome tenga permiso.',
        'Si modificaste las funciones experimentales de Chrome, abre chrome://flags y restablece las que hayas desactivado. No necesitas activar opciones experimentales para usar WebXR normal.'
    ];

    const guide = (data: Guide) => {
        issue = true;
        status.textContent = data.message;
        heading.textContent = data.heading;
        message.textContent = data.message;
        steps.replaceChildren();
        for (const item of data.steps) {
            const li = document.createElement('li');
            li.textContent = item;
            steps.appendChild(li);
        }
        panel.hidden = false;
        settingsPanel.hidden = true;
        settings.hidden = !android;
        link.hidden = !data.link;
        if (data.link) {
            link.href = data.link;
            link.textContent = data.linkText ?? 'Abrir';
        } else {
            link.removeAttribute('href');
        }
        startButton.textContent = data.primary ?? 'Volver a comprobar';
        startButton.disabled = false;
    };

    const clear = () => {
        issue = false;
        panel.hidden = true;
        settingsPanel.hidden = true;
        startButton.textContent = 'Iniciar RA';
        startButton.disabled = false;
        status.textContent = modelLoaded ? 'Modelo listo. Pulsa “Iniciar RA”.' : 'RA disponible. Cargando motocicleta…';
    };

    const chromeGuide = (updated = false) => guide({
        heading: updated ? 'Revisa Chrome' : 'Abrir en Chrome',
        message: updated
            ? 'Chrome no ofrece WebXR en esta configuración. Actualiza Chrome y revisa los permisos de esta página.'
            : 'Abre esta experiencia directamente en Chrome para utilizar la realidad aumentada.',
        steps: updated
            ? ['Actualiza Chrome desde Google Play.', 'Revisa los permisos de cámara en Chrome y en Android.', 'Regresa a la experiencia y vuelve a comprobar.']
            : ['Pulsa «Abrir en Chrome». Si tu navegador bloquea la apertura, utiliza el menú ⋮ → Abrir en el navegador.', 'Regresa aquí después de abrir Chrome.'],
        link: chromeStore,
        linkText: 'Instalar o actualizar Chrome',
        primary: updated ? 'Volver a comprobar' : 'Abrir en Chrome'
    });

    const servicesGuide = (permissionBlocked = false) => guide({
        heading: permissionBlocked ? 'Revisa los permisos de Chrome' : 'Comprobar RA y Chrome',
        message: permissionBlocked
            ? 'La cámara figura bloqueada. Revisa los permisos de Chrome antes de iniciar RA.'
            : 'Chrome no ha podido iniciar RA. Comprueba los servicios de RA y las configuraciones del navegador.',
        steps: permissionBlocked ? chromeSteps : [
            'Pulsa «Comprobar servicios de RA». Google Play indicará si necesitas instalar, habilitar o actualizar el componente.',
            'Revisa en Chrome los permisos de cámara de esta página y en Android los permisos de Chrome.',
            'Al volver aquí, pulsa «Volver a comprobar».'
        ],
        link: permissionBlocked ? undefined : arStore,
        linkText: permissionBlocked ? undefined : 'Comprobar servicios de RA',
        primary: permissionBlocked || support === false ? 'Volver a comprobar' : 'Reintentar RA'
    });

    const cameraPermission = async () => {
        if (!navigator.permissions?.query) return 'unknown';
        try {
            return (await navigator.permissions.query({ name: 'camera' as PermissionName })).state;
        } catch {
            return 'unknown';
        }
    };

    const check = async () => {
        if (waiting) return;
        waiting = true;
        support = null;
        try {
            if (android && embedded) {
                mustOpenChrome = true;
                chromeGuide();
                return;
            }
            if (!window.isSecureContext) {
                guide({
                    heading: 'La conexión necesita HTTPS',
                    message: 'Abre la versión HTTPS de esta página para utilizar la cámara y WebXR.',
                    steps: ['Utiliza la dirección segura HTTPS de esta experiencia.', 'Una vez abierta, vuelve a intentar.']
                });
                return;
            }
            if (!xr?.requestSession) {
                if (android) {
                    mustOpenChrome = !chrome;
                    chromeGuide(chrome);
                } else {
                    guide({
                        heading: 'WebXR no está habilitado',
                        message: 'Este navegador no ofrece una sesión WebXR para la experiencia.',
                        steps: ['Abre esta página en un navegador con WebXR y vuelve a comprobar.']
                    });
                }
                return;
            }
            if (android && (await cameraPermission()) === 'denied') {
                servicesGuide(true);
                return;
            }
            if (typeof xr.isSessionSupported === 'function') {
                try {
                    support = await xr.isSessionSupported('immersive-ar');
                } catch (error) {
                    console.warn('WebXR support check failed:', error);
                    support = null;
                }
                if (support === false) {
                    if (android && !chrome) {
                        mustOpenChrome = true;
                        chromeGuide();
                    } else {
                        servicesGuide();
                    }
                    return;
                }
            }
            mustOpenChrome = false;
            clear();
        } finally {
            waiting = false;
        }
    };

    const openChrome = () => {
        const url = new URL(window.location.href);
        const target = url.host + url.pathname + url.search + url.hash;
        // Android intents require a user tap; internal browsers can still block them.
        window.location.href = 'intent://' + target +
            '#Intent;scheme=' + (url.protocol === 'http:' ? 'http' : 'https') +
            ';package=com.android.chrome;S.browser_fallback_url=' +
            encodeURIComponent(url.href) + ';end';
    };

    const handleError = (error: Error) => {
        const name = error.name || 'Error';
        const detail = error.message || String(error);
        console.error('KTM WebXR session failed:', { name, detail, browser: ua, anchors: advancedFeatures });
        if (name === 'NotSupportedError' && advancedFeatures) {
            advancedFeatures = false;
            guide({
                heading: 'Probar una configuración más sencilla',
                message: 'La sesión rechazó una función avanzada. Reintenta sin anclajes, manteniendo la detección de superficies.',
                steps: ['Pulsa «Reintentar RA». Si vuelve a fallar, la página mostrará las comprobaciones de Chrome y RA.'],
                primary: 'Reintentar RA'
            });
        } else if (name === 'NotAllowedError' || name === 'SecurityError') {
            guide({
                heading: 'Permiso de cámara o RA bloqueado',
                message: 'Chrome no recibió permiso para iniciar la sesión. Revisa los permisos del sitio y del teléfono.',
                steps: chromeSteps,
                primary: 'Reintentar RA'
            });
        } else if (name === 'NotReadableError') {
            guide({
                heading: 'La cámara está ocupada',
                message: 'No se pudo acceder a la cámara. Cierra las otras aplicaciones que la estén utilizando.',
                steps: ['Cierra las aplicaciones que utilizan la cámara.', ...chromeSteps.slice(0, 3)],
                primary: 'Reintentar RA'
            });
        } else if (android && !chrome) {
            mustOpenChrome = true;
            chromeGuide();
        } else if (name === 'InvalidStateError' || name === 'AbortError') {
            guide({
                heading: 'La sesión fue interrumpida',
                message: 'Espera a que termine la sesión anterior y vuelve a intentar.',
                steps: ['Cierra cualquier sesión RA activa.', 'Pulsa «Reintentar RA».'],
                primary: 'Reintentar RA'
            });
        } else {
            servicesGuide();
        }
    };

    settings.addEventListener('click', () => {
        settingsPanel.hidden = !settingsPanel.hidden;
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !waiting && !document.body.classList.contains('xr-active')) void check();
    });

    return {
        get useAnchors() { return advancedFeatures; },
        get needsChrome() { return mustOpenChrome; },
        get canAttempt() { return !!xr?.requestSession && (support !== false || issue && advancedFeatures === false); },
        check,
        openChrome,
        handleError,
        requesting() {
            issue = false;
            panel.hidden = true;
            startButton.disabled = true;
            status.textContent = 'Solicitando sesión RA…';
        },
        modelReady() {
            modelLoaded = true;
            if (!issue && !waiting && support !== false && !document.body.classList.contains('xr-active')) clear();
        },
        started() {
            issue = false;
            panel.hidden = true;
        },
        ended() {
            void check();
        },
        showInitError(detail: string) {
            guide({
                heading: 'No se pudo iniciar la experiencia',
                message: 'La página no pudo preparar el visor RA. Vuelve a intentarlo o abre el visor 3D.',
                steps: ['Vuelve a cargar la página.', 'Si el problema continúa, vuelve al visor 3D.'],
                primary: 'Volver a comprobar'
            });
            console.error('AR initialization:', detail);
        }
    };
}
