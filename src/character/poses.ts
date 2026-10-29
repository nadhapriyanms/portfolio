/**
 * Procedural pose library for the character rig. Each pose returns joint rotations
 * (radians, XYZ) plus hip height; the rig blends between any two poses.
 * Conventions: the character faces +Z. Negative X on a shoulder or hip swings the limb forward,
 * negative X on an elbow bends the forearm forward, positive X on a knee folds the shin back.
 */
import * as THREE from 'three'
import { RIG, solveArm, solveLeg, toChest } from './ik'

export const joints = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'shoulderR', 'elbowR',
  'hipL', 'kneeL', 'hipR', 'kneeR',
] as const
export type Joint = (typeof joints)[number]
export type Euler3 = [number, number, number]
export type Pose = Record<Joint, Euler3> & { hipsY: number }

export type PoseName =
  | 'idle' | 'walk' | 'stopLook' | 'sit' | 'type' | 'sitWork' | 'stand' | 'inspect'
  | 'work' | 'ride' | 'celebrate' | 'lookUp' | 'wave' | 'proud'

const HIP_Y = 0.95

/* ───────── IK-solved postures (computed once at load) ───────── */

/** Where the rider sits on the CLUX cycle (cycle space); the character faces the cycle's +X. */
export const RIDER_MOUNT = { x: -0.2, y: 0.06 }
const BB = { x: -0.02, y: 0.33 } // bottom bracket, cycle space (see Cycle.tsx)
const CRANK = 0.16
const RIDE = { hipsY: 0.9, spine: 0.38, chest: 0.06 }
// handlebar grips at cycle (0.3, 1.27, ±0.36) → character space (X = -z, Z = x - mount)
const rideArms = ([1, -1] as const).map((side) =>
  solveArm(side, toChest(new THREE.Vector3(0.36 * side, 1.2 - RIDER_MOUNT.y, 0.3 - RIDER_MOUNT.x), RIDE.hipsY, RIDE.spine, RIDE.chest)),
)

/** Typing posture: the chair in CollegeScene puts the keyboard ~0.58 m ahead at desk height. */
const TYPE = { hipsY: 0.52, spine: 0.16, chest: 0.05 }
const typeKey = (side: number, lift: number) =>
  solveArm(side, toChest(new THREE.Vector3(0.11 * side, 0.82 + lift, 0.58), TYPE.hipsY, TYPE.spine, TYPE.chest))
const typeArms = {
  down: [typeKey(1, 0), typeKey(-1, 0)],
  up: [typeKey(1, 0.025), typeKey(-1, 0.025)],
}
const lerp3 = (a: number[], b: number[], k: number): Euler3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
/** Soft key-press envelope: mostly resting, brief smooth lifts. */
const tap = (t: number, f: number, o: number) => Math.pow(Math.max(0, Math.sin(t * f + o)), 6)

function base(): Pose {
  const p = { hipsY: HIP_Y } as Pose
  for (const j of joints) p[j] = [0, 0, 0]
  p.shoulderL = [0, 0, 0.07]
  p.shoulderR = [0, 0, -0.07]
  p.elbowL = [-0.12, 0, 0]
  p.elbowR = [-0.12, 0, 0]
  return p
}

function seated(p: Pose) {
  p.hipsY = 0.52
  p.hipL = [-1.5, 0, 0.04]
  p.hipR = [-1.5, 0, -0.04]
  p.kneeL = [1.45, 0, 0]
  p.kneeR = [1.45, 0, 0]
  return p
}

/** t = seconds (idle motion), phase = locomotion/pedal phase in radians. */
export const poses: Record<PoseName, (t: number, phase: number) => Pose> = {
  idle: (t) => {
    const p = base()
    const b = Math.sin(t * 1.6)
    p.chest = [0.02 * b, 0, 0]
    p.head = [0.03 * Math.sin(t * 0.7), 0.08 * Math.sin(t * 0.35), 0]
    p.shoulderL = [0.03 * b, 0, 0.08]
    p.shoulderR = [0.03 * b, 0, -0.08]
    return p
  },
  stand: (t) => poses.idle(t, 0),
  walk: (_t, ph) => {
    const p = base()
    const s = Math.sin(ph)
    p.hipsY = HIP_Y + 0.035 * Math.abs(Math.cos(ph)) - 0.02
    p.hips = [0, 0.1 * s, 0]
    p.chest = [0.06, -0.14 * s, 0]
    p.head = [0, 0.05 * s, 0]
    p.hipL = [-0.55 * s, 0, 0]
    p.hipR = [0.55 * s, 0, 0]
    p.kneeL = [Math.max(0, 0.95 * Math.sin(ph - 1.2)) + 0.08, 0, 0]
    p.kneeR = [Math.max(0, -0.95 * Math.sin(ph - 1.2)) + 0.08, 0, 0]
    p.shoulderL = [0.45 * s, 0, 0.08]
    p.shoulderR = [-0.45 * s, 0, -0.08]
    p.elbowL = [-0.35 - 0.15 * Math.max(0, -s), 0, 0]
    p.elbowR = [-0.35 - 0.15 * Math.max(0, s), 0, 0]
    return p
  },
  stopLook: (t) => {
    const p = poses.idle(t, 0)
    p.neck = [-0.04, -0.35, 0]
    p.head = [-0.08, -0.45, 0]
    p.chest = [0, -0.15, 0]
    return p
  },
  sit: (t) => {
    const p = seated(poses.idle(t, 0))
    p.spine = [0.08, 0, 0]
    p.shoulderL = [-0.5, 0, 0.12]
    p.shoulderR = [-0.5, 0, -0.12]
    p.elbowL = [-0.8, 0, 0]
    p.elbowR = [-0.8, 0, 0]
    return p
  },
  type: (t) => {
    // Hands rest on the keys (IK); small, smooth alternating lifts read as typing without jitter.
    const p = seated(base())
    p.hipsY = TYPE.hipsY
    p.spine = [TYPE.spine, 0, 0]
    p.chest = [TYPE.chest, 0, 0]
    p.neck = [0.12, 0, 0]
    p.head = [0.2 + 0.02 * Math.sin(t * 0.7), 0.05 * Math.sin(t * 0.35), 0]
    const kl = tap(t, 7.3, 0) * 0.8 + tap(t, 4.1, 2.0) * 0.4
    const kr = tap(t, 6.7, 1.6) * 0.8 + tap(t, 3.7, 4.2) * 0.4
    const L = lerp3(typeArms.down[0], typeArms.up[0], Math.min(1, kl))
    const R = lerp3(typeArms.down[1], typeArms.up[1], Math.min(1, kr))
    p.shoulderL = [L[0], 0, L[1]]
    p.elbowL = [L[2], 0, 0]
    p.shoulderR = [R[0], 0, R[1]]
    p.elbowR = [R[2], 0, 0]
    return p
  },
  sitWork: (t) => {
    const p = seated(base())
    p.spine = [0.28, 0, 0]
    p.neck = [0.15, 0, 0]
    p.head = [0.3, 0.12 * Math.sin(t * 0.6), 0]
    p.shoulderL = [-0.95, 0, 0.18]
    p.shoulderR = [-0.85 + 0.12 * Math.sin(t * 3.2), 0, -0.25]
    p.elbowL = [-0.7, 0, 0]
    p.elbowR = [-0.8 + 0.15 * Math.sin(t * 3.2 + 1), 0, 0]
    return p
  },
  work: (t) => {
    const p = base()
    p.spine = [0.26, 0, 0]
    p.chest = [0.08, 0, 0]
    p.neck = [0.18, 0, 0]
    p.head = [0.28, 0.1 * Math.sin(t * 0.5), 0]
    p.hipL = [-0.05, 0, 0.06]
    p.hipR = [0.05, 0, -0.06]
    p.kneeL = [0.1, 0, 0]
    p.kneeR = [0.1, 0, 0]
    p.shoulderL = [-0.85, 0, 0.15]
    p.shoulderR = [-0.95 + 0.14 * Math.sin(t * 2.6), 0, -0.2]
    p.elbowL = [-0.65, 0, 0]
    p.elbowR = [-0.6 + 0.2 * Math.sin(t * 2.6 + 1.2), 0, 0]
    return p
  },
  inspect: (t) => {
    const p = base()
    p.spine = [0.06, 0, 0]
    p.neck = [-0.04, 0, 0]
    p.head = [-0.06 + 0.02 * Math.sin(t), 0.06 * Math.sin(t * 0.6), 0.05]
    p.shoulderR = [-1.25, 0, -0.1]
    p.elbowR = [-0.35, 0, 0]
    p.shoulderL = [0.05, 0, 0.1]
    return p
  },
  lookUp: (t) => {
    const p = poses.idle(t, 0)
    p.neck = [-0.12, 0, 0]
    p.head = [-0.22, 0.12 * Math.sin(t * 0.25), 0]
    p.shoulderL = [0.25, 0, 0.12]
    p.shoulderR = [0.25, 0, -0.12]
    p.elbowL = [-0.5, 0, 0]
    p.elbowR = [-0.5, 0, 0]
    return p
  },
  ride: (_t, crank) => {
    // phase = the cycle's crank angle; feet are solved onto the real pedal positions every frame
    const p = base()
    p.hipsY = RIDE.hipsY
    p.spine = [RIDE.spine, 0, 0]
    p.chest = [RIDE.chest, 0, 0]
    p.neck = [-0.22, 0, 0]
    p.head = [-0.18, 0, 0]
    const [al, ar] = rideArms
    p.shoulderL = [al[0], 0, al[1]]
    p.elbowL = [al[2], 0, 0]
    p.shoulderR = [ar[0], 0, ar[1]]
    p.elbowR = [ar[2], 0, 0]
    const hipZ = 0
    const hipY = RIDE.hipsY + RIG.hipY
    const sc = Math.sin(crank) * CRANK
    const cc = Math.cos(crank) * CRANK
    // right pedal sits on the cycle's +z side (character's right), left pedal opposite
    const rightFoot = { z: BB.x - sc - RIDER_MOUNT.x, y: BB.y - cc + 0.07 - RIDER_MOUNT.y }
    const leftFoot = { z: BB.x + sc - RIDER_MOUNT.x, y: BB.y + cc + 0.07 - RIDER_MOUNT.y }
    const [hr, kr] = solveLeg(hipZ, hipY, rightFoot.z, rightFoot.y)
    const [hl, kl] = solveLeg(hipZ, hipY, leftFoot.z, leftFoot.y)
    p.hipR = [hr, 0, -0.1]
    p.kneeR = [kr, 0, 0]
    p.hipL = [hl, 0, 0.1]
    p.kneeL = [kl, 0, 0]
    return p
  },
  celebrate: (t) => {
    const p = base()
    const b = Math.abs(Math.sin(t * 4))
    p.hipsY = HIP_Y + 0.03 * b
    p.chest = [-0.1, 0, 0]
    p.head = [-0.15, 0, 0]
    p.shoulderL = [-2.75, 0, 0.35 + 0.1 * b]
    p.shoulderR = [-2.75, 0, -0.35 - 0.1 * b]
    p.elbowL = [-0.35, 0, 0]
    p.elbowR = [-0.35, 0, 0]
    return p
  },
  proud: (t) => {
    const p = poses.idle(t, 0)
    p.chest = [-0.06, 0.1, 0]
    p.head = [-0.06, 0.25, 0]
    p.shoulderL = [0.15, 0, 0.42]
    p.elbowL = [-1.9, 0, 0]
    p.shoulderR = [-0.15, 0, -0.1]
    return p
  },
  wave: (t) => {
    const p = poses.idle(t, 0)
    p.shoulderR = [-0.25, 0, -2.45]
    p.elbowR = [-0.25 - 0.35 * (0.5 + 0.5 * Math.sin(t * 7)), 0, 0]
    p.head = [-0.08, -0.12, 0.06]
    return p
  },
}

/** Blends pose a → b by w into `out`. */
export function blendPose(a: Pose, b: Pose, w: number, out: Pose) {
  out.hipsY = a.hipsY + (b.hipsY - a.hipsY) * w
  for (const j of joints) {
    const pa = a[j]
    const pb = b[j]
    const o = out[j] ?? (out[j] = [0, 0, 0])
    o[0] = pa[0] + (pb[0] - pa[0]) * w
    o[1] = pa[1] + (pb[1] - pa[1]) * w
    o[2] = pa[2] + (pb[2] - pa[2]) * w
  }
  return out
}
