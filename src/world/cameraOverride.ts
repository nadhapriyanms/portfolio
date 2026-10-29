import * as THREE from 'three'

/**
 * Interactive framing that temporarily takes over from the scroll rig
 * (project billboards, constellation stars). `weight` eases in and out in CameraDirector.
 */
export const cameraOverride = {
  active: false,
  weight: 0,
  pos: new THREE.Vector3(),
  target: new THREE.Vector3(),
  fov: 40,
}

export function focusCamera(pos: THREE.Vector3, target: THREE.Vector3, fov = 40) {
  cameraOverride.pos.copy(pos)
  cameraOverride.target.copy(target)
  cameraOverride.fov = fov
  cameraOverride.active = true
}

export function releaseCamera() {
  cameraOverride.active = false
}
