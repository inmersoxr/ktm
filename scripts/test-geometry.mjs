import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const loadTs = (file) => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
    });
    const exports = {};
    vm.runInNewContext(compiled.outputText, { exports, Math, Number });
    return exports;
};
const orbit = loadTs('../src/orbit-geometry.ts');
const floor = loadTs('../src/ar-floor.ts');
const close = (a,b,tol=1e-7) => assert.ok(Math.abs(a-b) < tol, `${a} != ${b}`);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

// Saved cameras have arbitrary aim points: they must NOT become the orbit axis.
const center={x:1.23,y:.55,z:-.3};
const camera={x:3.7,y:1.7,z:2};
const target={x:1.8,y:1.1,z:-1.05};
const moved=orbit.orbitAboveCenter(camera,target,center,25);
close(distance(moved.camera,center),distance(camera,center));
close(distance(moved.target,center),distance(target,center));
close(distance(moved.camera,moved.target),distance(camera,target));
assert.ok(moved.pitch>0&&moved.pitch<=85);
const restored=orbit.orbitAboveCenter(moved.camera,moved.target,center,-25);
for(const axis of ['x','y','z']) {
    close(restored.camera[axis],camera[axis]);
    close(restored.target[axis],target[axis]);
}
const top=orbit.orbitAboveCenter(camera,target,center,9000);
close(top.pitch,85);
const lowest=orbit.orbitAboveCenter(camera,target,center,-9000);
close(lowest.pitch,0);
assert.ok(lowest.camera.y>=center.y-1e-7);

// Local surface +Y must point UP; walls and ceilings cannot create the reticle.
const flat={x:0,y:0,z:0,w:1};
const wall={x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2};
const ceiling={x:1,y:0,z:0,w:0};
assert.equal(floor.isHorizontalUpward(flat),true);
assert.equal(floor.isHorizontalUpward(wall),false);
assert.equal(floor.isHorizontalUpward(ceiling),false);
const sample=floor.createFloorTracker();
for(let i=0;i<3;i++) {
    assert.equal(floor.acceptFloorSample(sample,{x:0,y:0,z:0},flat,100+i*16),false);
}
assert.equal(floor.acceptFloorSample(sample,{x:.02,y:0,z:0},flat,160),true);
assert.equal(floor.acceptFloorSample(sample,{x:0,y:0,z:0},wall,180),false);
assert.equal(sample.count,0);
assert.equal(floor.acceptFloorSample(sample,{x:0,y:0,z:0},flat,210),false);
assert.equal(floor.acceptFloorSample(sample,{x:1,y:0,z:0},flat,220),false);
assert.equal(sample.count,1);
assert.equal(floor.acceptFloorSample(sample,{x:1,y:0,z:0},flat,3000),false);
assert.equal(sample.count,1);
const arSrc=readFileSync(new URL('../src/ar.ts',import.meta.url),'utf8');
assert.match(arSrc,/entityTypes:\s*\[XRTRACKABLE_PLANE\]/);
assert.doesNotMatch(arSrc,/XRTRACKABLE_POINT/);
assert.match(arSrc,/FLOOR_HIT_TIMEOUT_MS/);
assert.match(arSrc,/acceptFloorSample\(/);
console.log('PASS: model-centered orbit, 0–85° clamp, wall/ceiling rejection, hit stability and stale-hit protection.');

const eye={x:0,y:1.4,z:0};
assert.equal(floor.isCurrentFloorRay({x:0,y:.55,z:-1.6},eye,{x:0,y:-0.4,z:-0.9}),true);
assert.equal(floor.isCurrentFloorRay({x:0,y:1.0,z:-1.6},eye,{x:0,y:0,z:-1}),false);
assert.equal(floor.isCurrentFloorRay({x:0,y:.55,z:-6},eye,{x:0,y:-0.4,z:-0.9}),false);
assert.ok(floor.FLOOR_HIT_TIMEOUT_MS <= 100);
const mainSource=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
assert.match(mainSource,/orbitAboveCenter\(cameraPosition, target, splatCenter, deltaY \* ORBIT_SENSITIVITY\)/);
const userGuide=readFileSync(new URL('../src/ar-diagnostics.ts',import.meta.url),'utf8');
assert.doesNotMatch(userGuide,/Reintenta sin anclajes|Probar una configuración más sencilla/);
assert.match(arSrc,/anchors: false/);
console.log('PASS: live floor ray, fast expiry, inverted gesture and no advanced AR setup.');

const desktopCamera = loadTs('../src/viewer-camera.ts');
const sourcePose={position:[3.68,1.55,2.02],target:[1.71,1.2,-1.08],fov:75};
const first=desktopCamera.prepareViewerPose(sourcePose,0,true);
close(first.fov,46);
close(first.target[1],sourcePose.target[1] - .55);
assert.ok(first.position.every(Number.isFinite));
assert.ok(Math.hypot(...first.position.map((x,i)=>x-sourcePose.target[i])) >
          Math.hypot(...sourcePose.position.map((x,i)=>x-sourcePose.target[i])));
const mobile=desktopCamera.prepareViewerPose(sourcePose,0,false);
close(mobile.fov,75);
for(let i=0;i<3;i++)close(mobile.position[i],sourcePose.position[i]);
const detail=desktopCamera.prepareViewerPose({position:[2.9,.45,.25],target:[1.68,.24,-1.1],fov:58},5,true);
close(detail.fov,46);
assert.ok(detail.position[0]>2.9);
console.log('PASS: desktop standard lens and original mobile presets.');
