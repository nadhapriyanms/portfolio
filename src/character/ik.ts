import * as THREE from 'three'

/**
 * Small IK helpers for the avatar rig, so hands land on real targets (handlebar grips,
 * keyboard) and feet stay locked to the pedals instead of approximating with sine waves.
 * Rig dimensions mirror Character.tsx.
 */
export const RIG = {
  spineY: 0.09,
  chestY: 0.22,
  shoulderX: 0.19,
  shoulderY: 0.17,
  upperArm: 0.27,
  hand: 0.375, // elbow → palm centre (Character.tsx Hand)
  hipX: 0.092,
  hipY: -0.06,
  thigh: 0.43,
  shin: 0.442,
}

const v = new THREE.Vector3()
const e = new THREE.Euler()
const q = new THREE.Quaternion()

/** Hand position in chest space for shoulder (x, z) and elbow (x) angles. Euler order XYZ, like three. */
function armFK(side: number, sx: number, sz: number, ex: number, out: THREE.Vector3) {
  // forearm + hand, in elbow space, rotated by the elbow
  out.set(0, -RIG.hand, 0.005).applyQuaternion(q.setFromEuler(e.set(ex, 0, 0)))
  out.add(v.set(0.008 * side, -RIG.upperArm, 0))
  out.applyQuaternion(q.setFromEuler(e.set(sx, 0, sz)))
  return out.add(v.set(RIG.shoulderX * side, RIG.shoulderY, 0))
}

/** Chest-space position of a point given in character space, for a pose's hip height and spine/chest bend. */
export function toChest(p: THREE.Vector3, hipsY: number, spineX: number, chestX: number) {
  const chestOrigin = new THREE.Vector3(0, RIG.chestY, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), spineX).add(new THREE.Vector3(0, hipsY + RIG.spineY, 0))
  return p.clone().sub(chestOrigin).applyAxisAngle(new THREE.Vector3(1, 0, 0), -(spineX + chestX))
}

/**
 * Solves shoulder (x, z) + elbow (x) so the hand reaches `target` (chest space).
 * Damped numerical descent; runs once per target at load, so cost does not matter.
 * Elbows are kept bending forward/down and the arm is not allowed to cross the body.
 */
export function solveArm(side: number, target: THREE.Vector3): [number, number, number] {
  let p: [number, number, number] = [-0.8, 0.15 * side, -0.6]
  const tmp = new THREE.Vector3()
  const cost = (x: [number, number, number]) => {
    armFK(side, x[0], x[1], x[2], tmp)
    const elbowPenalty = x[2] > -0.05 ? (x[2] + 0.05) * (x[2] + 0.05) * 4 : 0
    const crossPenalty = side * x[1] < -0.1 ? (side * x[1] + 0.1) ** 2 * 2 : 0
    return tmp.distanceToSquared(target) + elbowPenalty + crossPenalty
  }
  let step = 0.25
  let best = cost(p)
  for (let it = 0; it < 400 && step > 1e-4; it++) {
    let improved = false
    for (let i = 0; i < 3; i++) {
      for (const dir of [1, -1]) {
        const c: [number, number, number] = [...p]
        c[i] += dir * step
        const cc = cost(c)
        if (cc < best) {
          best = cc
          p = c
          improved = true
        }
      }
    }
    if (!improved) step *= 0.6
  }
  return p
}

/**
 * Two-bone leg IK in the character's sagittal plane (forward = +z, up = +y).
 * Returns hip pitch and knee bend in rig conventions (negative hip = forward, positive knee = fold back).
 */
export function solveLeg(hipZ: number, hipY: number, footZ: number, footY: number): [number, number] {
  const dx = footZ - hipZ
  const dy = footY - hipY
  const L1 = RIG.thigh
  const L2 = RIG.shin
  const dist = Math.min(L1 + L2 - 1e-3, Math.max(0.05, Math.hypot(dx, dy)))
  const alpha = Math.atan2(dx, -dy)
  const beta = Math.acos(THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1))
  const gamma = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1))
  return [-(alpha + beta), Math.PI - gamma]
}
