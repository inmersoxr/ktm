// User-facing RA recovery: browser/device differences stay internal.
// WebXR cannot inspect Android's installed AR service or Chrome flags directly.
type XRProbe = {
    requestSession?: (mode: string) => Promise<unknown>;
    isSessionSupported?: (mode: string) => Promise<boolean>;
};

type Recovery = {
    title: string;
    explanation?: string;
    primary?: string;
    link?: string;
    linkLabel?: string;
};

export function createArDiagnostics(
    startButton: HTMLButtonElement,
    status: HTMLElement,
    panel: HTMLElement
) {
    const title = panel.querySelector<HTMLElement>('#ar-guide-heading')!;
    const explanation = panel.querySelector<HTMLElement>('#ar-guide-message')!;
    const steps = panel.querySelector<HTMLOListElement>('#ar-guide-steps')!;
    const link = panel.querySelector<HTMLAnchorElement>('#ar-guide-link')!;
    const settings = panel.querySelector<HTMLButtonElement>('#ar-guide-settings')!;
    const settingsPanel = panel.querySelector<HTMLElement>('#ar-chrome-steps')!;
    const xr = (navigator as Navigator & { xr?: XRProbe }).xr;
    const ua = navigator.userAgent;
    const android = /Android/i.test(ua);
    const embedded = /Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|Line\//i.test(ua);
    const chrome = /Chrome\/[0-9]+/i.test(ua) &&
        !/SamsungBrowser|EdgA\/|OPR\/|UCBrowser/i.test(ua) && !embedded;
    const chromeStore = 'https://play.google.com/store/apps/details?id=com.android.chrome';
    const arStore = 'https://play.google.com/store/apps/details?id=com.google.ar.core';

    let support: boolean | null = null;
    let checking = false;
    let busy = false;
    let modelLoaded = false;
    let needsChrome = android && embedded;
    let lastFailure = false;

    const showHelp = (info: Recovery) => {
        busy = false;
        lastFailure = true;
        panel.hidden = false;
        panel.classList.add('compact');
        status.hidden = true; // Never repeat the same error above the recovery panel.
        title.textContent = info.title;
        explanation.textContent = info.explanation ?? '';
        explanation.hidden = !info.explanation;
        steps.replaceChildren();
        steps.hidden = true;
        settings.hidden = true;
        settingsPanel.hidden = true;
        link.hidden = !info.link;
        if (info.link) {
            link.href = info.link;
            link.textContent = info.linkLabel ?? 'Continuar';
        } else {
            link.removeAttribute('href');
        }
        startButton.textContent = info.primary ?? 'Reintentar RA';
        startButton.disabled = false;
    };

    const ready = () => {
        busy = false;
        lastFailure = false;
        panel.hidden = true;
        status.hidden = false;
        startButton.textContent = 'Iniciar RA';
        startButton.disabled = false;
        status.textContent = modelLoaded ? 'Listo para colocar la moto.' : 'Preparando la motocicleta…';
    };

    const browserHelp = (suggestUpdate: boolean) => showHelp({
        title: suggestUpdate ? 'Actualiza el navegador' : 'Abre la experiencia en Chrome',
        explanation: suggestUpdate ? 'Después vuelve a esta página.' : 'Así podrás utilizar la cámara del teléfono.',
        primary: suggestUpdate ? 'Volver a comprobar' : 'Abrir en Chrome',
        link: chromeStore,
        linkLabel: 'Actualizar Chrome'
    });

    const cameraPermission = async () => {
        if (!navigator.permissions?.query) return 'unknown';
        try {
            return (await navigator.permissions.query({ name: 'camera' as PermissionName })).state;
        } catch { return 'unknown'; }
    };

    const check = async () => {
        if (checking || busy || document.body.classList.contains('xr-active')) return;
        checking = true;
        try {
            if (embedded && android) {
                needsChrome = true;
                browserHelp(false);
                return;
            }
            if (!window.isSecureContext) {
                showHelp({title:'Necesitamos una conexión segura',
                    explanation:'Abre esta página mediante HTTPS.',primary:'Volver a comprobar'});
                return;
            }
            if (!xr?.requestSession) {
                if (android) {
                    needsChrome = !chrome;
                    browserHelp(chrome);
                } else {
                    showHelp({title:'La realidad aumentada no está disponible en este navegador',
                        explanation:'Ábrela en un navegador que permita usar la cámara en RA.',
                        primary:'Volver a comprobar'});
                }
                return;
            }
            needsChrome = false;
            if (await cameraPermission() === 'denied') {
                showHelp({title:'Permite el acceso a la cámara',
                    explanation:'Abre los permisos de este sitio en el navegador y permite la cámara.',
                    primary:'Volver a comprobar'});
                return;
            }
            if (xr.isSessionSupported) {
                try {
                    support = await xr.isSessionSupported('immersive-ar');
                } catch (e) {
                    console.warn('RA capability check was inconclusive:',e);
                    support = null;
                }
                if (support === false) {
                    if (android && !chrome) {
                        needsChrome = true;
                        browserHelp(false);
                    } else {
                        showHelp({title:'Prepara tu teléfono para usar RA',
                            explanation:'Comprueba que la realidad aumentada esté actualizada.',
                            link:android ? arStore : undefined,
                            linkLabel:'Comprobar RA del teléfono',
                            primary:'Volver a comprobar'});
                    }
                    return;
                }
            }
            ready();
        } finally { checking = false; }
    };

    const openChrome = () => {
        // Browser intents must execute synchronously inside the actual tap.
        const url = new URL(window.location.href);
        const target = url.host + url.pathname + url.search + url.hash;
        window.location.href = 'intent://' + target + '#Intent;scheme=' +
            (url.protocol === 'http:' ? 'http' : 'https') +
            ';package=com.android.chrome;S.browser_fallback_url=' +
            encodeURIComponent(url.href) + ';end';
    };

    const handleError = (error: Error) => {
        busy = false;
        const name = error.name || 'Error';
        console.error('RA startup error:', {name, message:error.message, browser:ua});
        if (name === 'NotAllowedError' || name === 'SecurityError') {
            showHelp({title:'Permite el acceso a la cámara',
                explanation:'Activa la cámara en los permisos de este sitio y vuelve a intentarlo.'});
        } else if (name === 'NotReadableError') {
            showHelp({title:'La cámara está ocupada',
                explanation:'Cierra otras aplicaciones que utilicen la cámara y vuelve a intentarlo.'});
        } else if (android && !chrome && name === 'NotSupportedError') {
            needsChrome = true;
            browserHelp(false);
        } else if (name === 'NotSupportedError') {
            showHelp({title:'No pudimos abrir la realidad aumentada',
                explanation:'Comprueba que la RA del teléfono esté actualizada.',
                link:android ? arStore : undefined,
                linkLabel:'Comprobar RA del teléfono'});
        } else {
            showHelp({title:'No pudimos iniciar la cámara',
                explanation:'Puedes volver a intentarlo.',primary:'Reintentar RA'});
        }
    };

    document.addEventListener('visibilitychange', () => {
        // Recheck after returning from system settings or the Play Store.
        if (!document.hidden && !busy) void check();
    });
    return {
        get needsChrome() { return needsChrome; },
        get canAttempt() { return !!xr?.requestSession && support !== false; },
        check,
        openChrome,
        handleError,
        requesting() {
            busy = true;
            lastFailure = false;
            panel.hidden = true;
            status.hidden = false;
            status.textContent = 'Preparando realidad aumentada…';
            startButton.disabled = true;
        },
        modelReady() {
            modelLoaded = true;
            if (!lastFailure && !busy && support !== false && !document.body.classList.contains('xr-active')) ready();
        },
        started() {
            busy = false;
            lastFailure = false;
            panel.hidden = true;
            status.hidden = false;
        },
        ended() { busy = false; void check(); },
        showInitError(detail: string) {
            console.error('RA initialization error:', detail);
            showHelp({title:'No se pudo abrir la experiencia',
                explanation:'Actualiza la página e inténtalo de nuevo.',primary:'Recargar'});
        }
    };
}
