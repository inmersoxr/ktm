import type { CameraPose } from './splat-config';

// Desktop product display only. Mobile keeps the captured model's native
// scale and original camera presets; AR loads its own scene.
export const DESKTOP_MODEL_SCALE = 4;
export const DESKTOP_CAMERA_FOV = 13;

export function prepareViewerPose<T extends CameraPose>(
    pose: T,
    index: number,
    desktop: boolean,
    center?: readonly [number, number, number],
    aspect = 16 / 9
): T {
    if (!desktop) return { ...pose };

    const c = center ?? pose.target;
    const delta = pose.position.map((v, axis) => v - pose.target[axis]);
    const sourceDistance = Math.hypot(delta[0], delta[1], delta[2]);
    if (!Number.isFinite(sourceDistance) || sourceDistance < 1e-6) return { ...pose };

    const unit = delta.map((v) => v / sourceDistance);
    const cameraDistance = index === 0
        ? sourceDistance * 11.2
        : sourceDistance * DESKTOP_MODEL_SCALE *
          (Math.tan(pose.fov * Math.PI / 360) / Math.tan(DESKTOP_CAMERA_FOV * Math.PI / 360)) /
          (index <= 3 ? 2.15 : 1.05);

    // The original capture's feature targets must scale along with the model.
    // For the cover, instead frame the actual bounds center slightly right of
    // screen center so copy occupies the left and wheels clear the bottom bar.
    let target: [number, number, number];
    if (index === 0) {
        const rightX = unit[2] / Math.hypot(unit[0], unit[2]);
        const rightZ = -unit[0] / Math.hypot(unit[0], unit[2]);
        const halfHeight = cameraDistance * Math.tan(DESKTOP_CAMERA_FOV * Math.PI / 360);
        const horizontalOffset = halfHeight * Math.max(1, aspect) * 0.36;
        target = [
            c[0] - rightX * horizontalOffset,
            c[1] - halfHeight * 0.10,
            c[2] - rightZ * horizontalOffset
        ];
    } else {
        target = [
            c[0] + (pose.target[0] - c[0]) * DESKTOP_MODEL_SCALE,
            c[1] + (pose.target[1] - c[1]) * DESKTOP_MODEL_SCALE,
            c[2] + (pose.target[2] - c[2]) * DESKTOP_MODEL_SCALE
        ];
    }

    return {
        ...pose,
        position: target.map((v, axis) => v + unit[axis] * cameraDistance) as [number, number, number],
        target,
        fov: DESKTOP_CAMERA_FOV
    };
}
