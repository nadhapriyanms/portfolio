/**
 * Camera choreography, one keyframe list per chapter.
 * t is the chapter-local time (0–1). p = camera position, l = look target.
 * In scenes that publish a moving anchor (school walk, city ride) both are anchor-relative.
 */
export type Vec3 = [number, number, number]

export interface Shot {
  t: number
  p: Vec3
  l: Vec3
  fov: number
  roll?: number
  /** Screen-space framing shift (fraction of width, + moves the subject right). Ignored in portrait. */
  sx?: number
  ease?: string
}

export const cameraShots: Record<string, Shot[]> = {
  // Establishing orbit → approach → crane down → fisheye descent to the tiny street on the pole.
  'hero-globe': [
    { t: 0, p: [0, 0.5, 15], l: [0, 0.2, 0], fov: 34, sx: 0.22 },
    // as the hero text drifts away the planet glides to centre while the camera closes in
    { t: 0.32, p: [1.2, 1.7, 8.6], l: [0, 0.6, 0], fov: 36, sx: 0.0, ease: 'sine.inOut' },
    { t: 0.62, p: [0.4, 4.2, 3.9], l: [0, 1.7, 0], fov: 40, sx: 0 },
    { t: 0.86, p: [0.05, 2.75, 1.25], l: [0, 2.07, 0], fov: 48 },
    { t: 1, p: [0, 2.28, 0.48], l: [0, 2.12, -0.22], fov: 56, ease: 'power2.in' },
  ],
  // Tracking behind the walk, two stops at the noticeboards, then into the doorway.
  'school-years': [
    { t: 0, p: [0.9, 2.1, 6.2], l: [0, 1.2, -3], fov: 40, ease: 'power2.out' },
    { t: 0.2, p: [-1.1, 1.65, 3.8], l: [0.3, 1.3, -3], fov: 42 },
    { t: 0.28, p: [-1.9, 1.75, 3.6], l: [2.0, 1.45, -1.0], fov: 42 },
    { t: 0.4, p: [-1.9, 1.75, 3.6], l: [2.0, 1.45, -1.0], fov: 42 },
    { t: 0.48, p: [-1.4, 1.8, 3.9], l: [0, 1.3, -3], fov: 42 },
    { t: 0.56, p: [-1.9, 1.75, 3.6], l: [2.0, 1.45, -1.0], fov: 42 },
    { t: 0.68, p: [-1.9, 1.75, 3.6], l: [2.0, 1.45, -1.0], fov: 42 },
    { t: 0.8, p: [1.1, 1.45, 3.4], l: [0, 1.7, -6], fov: 44 },
    { t: 0.92, p: [0.3, 1.5, 1.2], l: [0, 1.6, -8], fov: 48 },
    { t: 1, p: [0, 1.6, -2.6], l: [0, 1.5, -10], fov: 56, ease: 'power2.in' },
  ],
  // From the street, through the glass, over the shoulder, then the swing to the prototyping bench.
  'college-workspace': [
    { t: 0, p: [0.6, 2.3, 7.5], l: [0, 1.2, -1.6], fov: 38, ease: 'power2.out' },
    { t: 0.24, p: [0.2, 1.7, 2.6], l: [0, 1.05, -1.6], fov: 40 },
    { t: 0.44, p: [-1.0, 1.9, -3.5], l: [0.25, 0.95, -0.9], fov: 42 },
    { t: 0.6, p: [-0.8, 1.75, -3.2], l: [0.25, 0.95, -0.9], fov: 40 },
    { t: 0.78, p: [-0.4, 1.6, -0.45], l: [1.6, 0.95, -2.4], fov: 42 },
    { t: 1, p: [3.9, 1.75, -0.5], l: [2.1, 0.95, -2.4], fov: 40 },
  ],
  // Nightfall, laptop closes, walk out, the flyer.
  'night-flyer': [
    { t: 0, p: [3.9, 1.75, -0.5], l: [2.1, 0.95, -2.4], fov: 40 },
    { t: 0.16, p: [-1.0, 1.9, -3.5], l: [0.25, 0.95, -0.9], fov: 42 },
    { t: 0.34, p: [-1.3, 1.7, -1.2], l: [-3.4, 1.2, -0.4], fov: 44 },
    { t: 0.55, p: [-2.8, 1.8, 5.2], l: [-5, 1.2, 0.6], fov: 42 },
    { t: 0.74, p: [-4.4, 1.6, 3.6], l: [-6, 1.45, 0.2], fov: 40 },
    { t: 0.9, p: [-5.85, 1.55, 1.5], l: [-6, 1.5, 0.15], fov: 38 },
    { t: 1, p: [-6, 1.5, 0.62], l: [-6, 1.5, 0.15], fov: 34, ease: 'power2.in' },
  ],
  // Sketch → CAD lines → assembly → low wheel sweep → reveal.
  'cycle-workshop': [
    { t: 0, p: [-3.3, 2.6, -1.1], l: [-3.9, 1.2, -3.2], fov: 38, ease: 'power2.out' },
    { t: 0.12, p: [-3.45, 2.0, -1.75], l: [-3.9, 1.25, -3.2], fov: 36 },
    { t: 0.24, p: [2.6, 2.3, 4.6], l: [0, 1.1, 0], fov: 38 },
    { t: 0.38, p: [-2.6, 1.9, 4.1], l: [0, 1.0, 0], fov: 40 },
    { t: 0.55, p: [-3.6, 1.5, -2.6], l: [0, 0.75, 0], fov: 40 },
    { t: 0.68, p: [1.7, 0.32, 1.25], l: [0.62, 0.36, 0], fov: 46 },
    { t: 0.8, p: [2.9, 0.55, 2.7], l: [0.1, 0.6, 0], fov: 40 },
    { t: 0.92, p: [-0.5, 1.5, 5.6], l: [-0.6, 0.78, 0], fov: 36 },
    { t: 1, p: [-0.7, 1.55, 5.8], l: [-0.7, 0.78, 0], fov: 36 },
  ],
  // Rider-relative: wheel level, side track, rear follow, the stop, the transformation.
  'ride-transition': [
    { t: 0, p: [2.4, 0.35, -1.6], l: [0, 0.5, 0.4], fov: 44, ease: 'power2.out' },
    { t: 0.18, p: [2.9, 1.0, 0], l: [0, 0.9, 0], fov: 40 },
    { t: 0.36, p: [0.4, 1.6, 3.7], l: [0, 1.0, -4], fov: 46 },
    { t: 0.52, p: [0.5, 1.6, 3.4], l: [0.4, 1.2, -5], fov: 44 },
    { t: 0.64, p: [1.6, 1.4, 1.9], l: [3.2, 2.6, -6], fov: 40 },
    { t: 0.82, p: [-1.4, 0.9, 2.6], l: [1.5, 2.9, -8], fov: 50 },
    { t: 1, p: [0.2, 1.3, 3.0], l: [0, 1.2, -6], fov: 52 },
  ],
  'cyber-city': [
    { t: 0, p: [0.2, 1.3, 3.0], l: [0, 1.2, -6], fov: 52 },
    { t: 0.2, p: [0.3, 1.15, 2.8], l: [0, 1.1, -8], fov: 64 },
    { t: 0.4, p: [-2.6, 0.6, 0.6], l: [0, 1.0, -2], fov: 48 },
    { t: 0.58, p: [3.0, 4.2, 6], l: [2.4, 4.6, -16], fov: 46 },
    { t: 0.8, p: [0, 6, 10], l: [0, 5.5, -20], fov: 44 },
    { t: 1, p: [0, 14, 14], l: [0, 10, -30], fov: 46, ease: 'power2.in' },
  ],
  // Descend onto the rooftop, then hold steady so the billboards are easy to pick.
  'project-skyline': [
    { t: 0, p: [0, 16, 24], l: [0, 8, -10], fov: 46, ease: 'power2.out' },
    { t: 0.28, p: [1.4, 2.3, 7.2], l: [0, 5.4, -14], fov: 52 },
    { t: 0.45, p: [0, 2.1, 7.6], l: [0, 6.2, -14], fov: 56 },
    { t: 1, p: [0, 2.1, 7.8], l: [0, 6.3, -14], fov: 56 },
  ],
  // Aerial pull-back from the city into the constellation.
  'achievement-constellation': [
    { t: 0, p: [0, 6, 24], l: [0, 1, -20], fov: 50, ease: 'power2.out' },
    // rise from the city into the middle of the sky; from ~0.32 the visitor can look around 360°
    { t: 0.3, p: [0, 40, 0.5], l: [0, 46, -30], fov: 58, ease: 'power2.inOut' },
    { t: 1, p: [0, 40, 0.5], l: [0, 46, -30], fov: 58 },
  ],
  // Dawn overlook; character and globe sit right of centre so the contact panel stays clear.
  'contact-ending': [
    { t: 0, p: [-1.5, 1.2, 5.5], l: [1.5, 3.2, -10], fov: 46, ease: 'power2.out' },
    { t: 0.45, p: [-3.2, 1.6, 7.4], l: [-2.6, 2.9, -10], fov: 42 },
    { t: 1, p: [-3.3, 1.65, 7.6], l: [-2.7, 2.9, -10], fov: 42 },
  ],
}

/** Mobile portrait framing pulls the camera back so subjects stay in a narrow frame. */
export const portraitFovBoost = 14
