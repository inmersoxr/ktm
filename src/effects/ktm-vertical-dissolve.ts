import { Color, Vec3 } from 'playcanvas';
import type { BoundingBox } from 'playcanvas';
// PlayCanvas publishes this official shader-effect script as ESM without a TypeScript declaration.
// @ts-ignore -- official PlayCanvas 2.20.0 ESM script
import { GsplatDissolveShaderEffect } from 'playcanvas/scripts/esm/gsplat/shader-effect-dissolve.mjs';

// Adapt the official PlayCanvas dissolve: noise determines the particle breakup,
// while world-space height determines the *order* in which splats reassemble.
// The original shader, GLSL/WGSL support, particle motion and cleanup are retained.
const GLSL_NEEDLE = 'float n = dissolveFbm(center * uNoiseFrequency);';
const WGSL_NEEDLE = 'let n = dissolveFbm((*center) * uniform.uNoiseFrequency);';

export class KtmVerticalDissolve extends GsplatDissolveShaderEffect {
    static scriptName = 'ktmVerticalDissolve';

    private playing = false;

    getShaderGLSL(): string {
        const source: string = super.getShaderGLSL();
        if (!source.includes(GLSL_NEEDLE)) throw new Error('PlayCanvas dissolve GLSL signature changed');
        return source.replace(GLSL_NEEDLE, `
    float height01 = clamp((center.y - uAabbMin.y) /
        max(uAabbMax.y - uAabbMin.y, 0.001), 0.0, 1.0);
    // Reverse the noise field so reverse playback reconstructs the wheels first.
    float n = clamp(1.0 - height01 +
        (dissolveFbm(center * uNoiseFrequency) - 0.5) * 0.22, 0.0, 1.0);`);
    }

    getShaderWGSL(): string {
        const source: string = super.getShaderWGSL();
        if (!source.includes(WGSL_NEEDLE)) throw new Error('PlayCanvas dissolve WGSL signature changed');
        return source.replace(WGSL_NEEDLE, `
    let height01 = clamp(((*center).y - uniform.uAabbMin.y) /
        max(uniform.uAabbMax.y - uniform.uAabbMin.y, 0.001), 0.0, 1.0);
    let n = clamp(1.0 - height01 +
        (dissolveFbm((*center) * uniform.uNoiseFrequency) - 0.5) * 0.22, 0.0, 1.0);`);
    }

    /**
     * Prepare the invisible first frame while AR uploads, sorts and compiles the
     * Gaussian. The caller decides when real rendering is ready to begin.
     */
    armReveal(): void {
        this.playing = false;
        this.effectTime = 0;
        if (!this.enabled) this.enabled = true;
        // Apply the reverse-dissolve's initial uniforms before the first draw.
        if (this.material) this.updateEffect(0, 0);
        const canvas = document.querySelector<HTMLCanvasElement>('#app, #ar-canvas');
        if (canvas) {
            canvas.dataset.fxState = 'armed';
            canvas.dataset.fxProgress = '0';
        }
    }

    startReveal(): void {
        // Re-enable after completion (for AR replay / a new XR session).
        if (!this.enabled) this.enabled = true;
        this.effectTime = 0;
        this.playing = true;
        const canvas = document.querySelector<HTMLCanvasElement>('#app, #ar-canvas');
        if (canvas) {
            canvas.dataset.fxState = 'playing';
            canvas.dataset.fxProgress = '0';
        }
    }

    update(dt: number): void {
        // WebXR on phones can stall for several seconds during first-use shader
        // compilation and Gaussian sorting. Never count invisible wall-clock
        // time as several seconds of animation: advance at most one rendered
        // 30 Hz frame per app update. Desktop retains its existing timing.
        const arMode = Boolean(document.querySelector('#ar-canvas'));
        super.update(arMode ? Math.min(Math.max(dt, 0), 1 / 30) : dt);
    }

    updateEffect(effectTime: number, dt: number): void {
        const elapsed = this.playing ? effectTime : 0;
        super.updateEffect(elapsed, dt);
        if (!this.playing) {
            this.effectTime = 0;
            return;
        }

        const canvas = document.querySelector<HTMLCanvasElement>('#app, #ar-canvas');
        if (canvas) canvas.dataset.fxProgress = String(Math.min(1, elapsed / this.duration));
        if (elapsed >= this.duration) {
            this.playing = false;
            // Official GSplatShaderEffect removes its shader on disable.
            // At progress=0 all splats have their original positions and colors.
            this.enabled = false;
            if (canvas) canvas.dataset.fxState = 'complete';
        }
    }
}

export function configureKtmVerticalDissolve(
    effect: KtmVerticalDissolve,
    bounds: BoundingBox | undefined
): void {
    // The KTM asset is rotated 180 degrees around Z in main.ts.
    // Splat centers in the unified render shader are in world coordinates;
    // the visual bottom corresponds to -localY.
    const cy = bounds?.center.y ?? -0.4;
    const hy = bounds?.halfExtents.y ?? 0.45;
    const bottom = -(cy + hy) - 0.015;
    const top = -(cy - hy) + 0.015;

    // The scene contains only the KTM splat. Generous horizontal bounds ensure
    // a complete dissolve despite the model's unusual authored coordinates.
    effect.aabbMin = new Vec3(-100, bottom, -100);
    effect.aabbMax = new Vec3(100, top, 100);
    effect.duration = 4.4;
    effect.dissolve = false; // Reassemble, rather than dissolve away.
    effect.noiseFrequency = 7;
    effect.edgeWidth = 0.16;
    effect.edgeColor = new Color(2.0, 0.55, 0.09);
    effect.liftDirection = new Vec3(0, 1, 0);
    effect.liftDistance = 0.13;
    effect.waveAmplitude = 0.018;
    effect.waveFrequency = 7;
}
