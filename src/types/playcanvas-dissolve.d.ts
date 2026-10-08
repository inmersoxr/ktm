// PlayCanvas 2.20.0 distributes the optional effect as JS without an accompanying .d.ts.
declare module 'playcanvas/scripts/esm/gsplat/shader-effect-dissolve.mjs' {
    import { Color, Script, Vec3 } from 'playcanvas';

    export class GsplatDissolveShaderEffect extends Script {
        effectTime: number;
        material: import('playcanvas').Material | null;
        update(dt: number): void;
        aabbMin: Vec3;
        aabbMax: Vec3;
        cropEnabled: boolean;
        duration: number;
        dissolve: boolean;
        noiseFrequency: number;
        edgeWidth: number;
        edgeColor: Color;
        liftDirection: Vec3;
        liftDistance: number;
        waveAmplitude: number;
        waveFrequency: number;
        getShaderGLSL(): string;
        getShaderWGSL(): string;
        updateEffect(effectTime: number, dt: number): void;
    }
}
