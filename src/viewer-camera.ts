import type { CameraPose } from './splat-config';

// A conventional 46° lens: keep authored aim, adapt distance so existing
// detail views retain their framing while overview views fill the screen.
export const DESKTOP_CAMERA_FOV = 46;
export function prepareViewerPose<T extends CameraPose>(pose: T, index: number, desktop: boolean): T {
    if (!desktop || pose.fov <= 50) return { ...pose };
    const oldLens = Math.tan(pose.fov * Math.PI / 360);
    const newLens = Math.tan(DESKTOP_CAMERA_FOV * Math.PI / 360);
    const magnification = index === 0 ? 1.65 : index <= 3 ? 1.35 : 1;
    const dolly = oldLens / newLens / magnification;
    // The narrow lens makes the author's original high aim more apparent.
    // Aim a little lower so the complete bike remains above the bottom menu.
    const verticalAimOffset = index === 0 ? 0.55 : index <= 3 ? 0.30 : 0;
    return {
        ...pose,
        position: pose.position.map((value, axis) =>
            pose.target[axis] + (value - pose.target[axis]) * dolly
        ) as [number, number, number],
        target: [
            pose.target[0],
            pose.target[1] - verticalAimOffset,
            pose.target[2]
        ] as [number, number, number],
        fov: DESKTOP_CAMERA_FOV
    };
}
