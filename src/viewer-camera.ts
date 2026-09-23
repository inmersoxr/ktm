import type { CameraPose } from './splat-config';

// Layout changes the controls, never the saved product-camera geometry.
export const DESKTOP_MODEL_SCALE = 1;
export const DESKTOP_CAMERA_FOV = 75;

export function prepareViewerPose<T extends CameraPose>(
    pose: T,
    _index: number,
    _desktop: boolean,
    _center?: readonly [number, number, number],
    _aspect?: number
): T {
    return pose;
}
