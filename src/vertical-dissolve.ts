import type { BoundingBox, Entity, AppBase } from 'playcanvas';

/** Procedural, bottom-to-top Gaussian dissolve. No auxiliary geometry. */
export function installVerticalDissolve(app: AppBase, entity: Entity, bounds?: BoundingBox) {
    const material = entity.gsplat?.material;
    if (!material) return;
    const center = bounds?.center.y ?? 0;
    const half = Math.max(bounds?.halfExtents.y ?? 1, 0.001);
    const minY = -(center + half);
    const maxY = -(center - half);
    const glsl = `
uniform float uDissolveProgress;
uniform vec2 uDissolveHeight;
float dissolveHash(vec3 p) {
    return fract(sin(dot(floor(p * 45.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
void modifySplatCenter(inout vec3 center) {
    float h = (-center.y - uDissolveHeight.x) / max(0.0001, uDissolveHeight.y - uDissolveHeight.x);
    float noise = dissolveHash(center);
    float threshold = uDissolveProgress * 1.24 - 0.12;
    float arrival = smoothstep(-0.10, 0.10, threshold - h + (noise - 0.5) * 0.24);
    center += vec3((noise - 0.5) * 0.08, 0.0, (fract(noise * 17.0) - 0.5) * 0.08) * (1.0 - arrival);
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
void modifySplatColor(vec3 center, inout vec4 color) {
    float h = (-center.y - uDissolveHeight.x) / max(0.0001, uDissolveHeight.y - uDissolveHeight.x);
    float noise = dissolveHash(center);
    float threshold = uDissolveProgress * 1.24 - 0.12;
    float arrival = smoothstep(-0.10, 0.10, threshold - h + (noise - 0.5) * 0.24);
    color.a *= arrival;
}
`;
    const wgsl = `
@group(0) @binding(0) var<uniform> uDissolveProgress: f32;
@group(0) @binding(1) var<uniform> uDissolveHeight: vec2f;
fn dissolveHash(p: vec3f) -> f32 {
    return fract(sin(dot(floor(p * 45.0), vec3f(127.1, 311.7, 74.7))) * 43758.5453);
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
    let h = (-(*center).y - uDissolveHeight.x) / max(0.0001, uDissolveHeight.y - uDissolveHeight.x);
    let noise = dissolveHash(*center);
    let threshold = uDissolveProgress * 1.24 - 0.12;
    let arrival = smoothstep(-0.10, 0.10, threshold - h + (noise - 0.5) * 0.24);
    *center += vec3f((noise - 0.5) * 0.08, 0.0, (fract(noise * 17.0) - 0.5) * 0.08) * (1.0 - arrival);
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    let h = (-center.y - uDissolveHeight.x) / max(0.0001, uDissolveHeight.y - uDissolveHeight.x);
    let noise = dissolveHash(center);
    let threshold = uDissolveProgress * 1.24 - 0.12;
    let arrival = smoothstep(-0.10, 0.10, threshold - h + (noise - 0.5) * 0.24);
    (*color).a *= arrival;
}
`;
    const language = app.graphicsDevice.isWebGPU ? 'wgsl' : 'glsl';
    material.getShaderChunks(language).set('gsplatModifyVS', language === 'wgsl' ? wgsl : glsl);
    material.setParameter('uDissolveHeight', [minY, maxY]);
    material.setParameter('uDissolveProgress', 0);
    material.update();
    let elapsed = 0;
    const duration = 3.2;
    const update = (dt: number) => {
        elapsed = Math.min(duration, elapsed + dt);
        const t = elapsed / duration;
        material.setParameter('uDissolveProgress', t * t * (3 - 2 * t));
    };
    app.on('update', update);
    return () => {
        app.off('update', update);
        material.getShaderChunks(language).delete('gsplatModifyVS');
        material.update();
    };
}
