# Nadhapriyan M. S. — cinematic 3D comic portfolio

React 19 + TypeScript + Vite 8, Three.js r186 via React Three Fiber 9 / Drei 10, GSAP 3 ScrollTrigger, Zustand 5.

## Commands

- `npm run dev` — dev server on http://localhost:5173
- `npm run typecheck` — TypeScript 7 (`tsc -b --noEmit`)
- `npm run build` — typecheck + production bundle in `dist/`
- `npm run preview` — serve `dist/`

QA switches: `?nowebgl` shows the designed no-3D fallback. In dev only, `?nofx` disables the comic post pass, and `window.__story` exposes the live story clock.

## Architecture

- `src/content/` and `src/projects/projectData.ts` — **all** facts. Each entry traces to the résumé or a supplied document (`source` field on projects). Never add claims without evidence; omit unknown fields.
- `src/content/chapters.ts` — chapter ids, scene keys and `weight` (section height in viewports = timeline length).
- `src/animation/storyTimeline.ts` — one GSAP master timeline. It owns the camera rig (`story.rig`) and effect values (`story.fx`). Every tween is a `fromTo`, so scrubbing and jumping are deterministic.
- `src/animation/cameraShots.ts` — camera keyframes per chapter (local time 0–1). In the school and city scenes they are relative to `story.anchor` (the walking/riding character). `sx` is a screen-space framing shift (view offset) that keeps a subject beside the HTML text at any aspect ratio; it is ignored in portrait.
- `src/animation/storyController.ts` — ScrollTrigger wiring, `jumpToChapter()`.
- `src/world/` — `WorldCanvas` (fixed, aria-hidden), `SceneManager` (lazy-loads only the current chapter's scene), `CameraDirector` (applies rig + interactive focus override), `PostFX` (render target → `shaders/comicPass.ts`: ink outlines, halftone, grain, iris wipe, glitch, fisheye, dim).
- `src/scenes/*Scene.tsx` — one environment each. Scenes read `story.time` / `localTime()` in `useFrame` and never write the camera.
- Scene slots (`world/SceneManager.tsx`, `world/SceneContext.tsx`): the current scene mounts at once, neighbours at idle time, and on desktop qualities a built scene stays mounted (hidden). Hidden slots are prewarmed by one offscreen, unculled render (shaders + shadow shaders + textures). Only the active scene may write globals: gate `useFrame` with `useActiveRef()`, use `<Atmosphere>` for fog/background/cel mood (never `attach="fog"`), and put effects that must react to activation in small child components using `useSceneActive()`.
- `src/world/kit/` — detailed procedural assets. `Kit` merges primitives per material slot with painted grime in vertex colours; `Townhouse` (Japanese-style houses/shops), `Towers` (8 instanced tower archetypes), `Trees` (instanced), `StreetProps` (one merged mesh per street), `CyberDistrict` (wet road reflections, GPU rain, light cones, neon signage incl. Japanese words, cables, elevated line, sky traffic, searchlights, hologram, steam).
- Shading: every `toon()` material is patched by `makeCel()` — two-tone ramp with a coloured shadow tint and a rim light (`celUniforms`). Post: bloom chain + 90s-anime grade in the security chapters (`shaders/comicPass.ts`).
- Scrolling: Lenis smooth scroll drives ScrollTrigger from GSAP's ticker; `setScrollLocked()` for dialogs.
- Resolution: native DPR (min 1 on desktop qualities, max 2), MSAA ×4/×2 on the main target, and drei `PerformanceMonitor` that only trims resolution on sustained slowness. Quality auto-detects phones by pointer type, never by window width.
- `src/character/` — primitive-built avatar on a 13-joint rig; `poses.ts` holds procedural poses blended by the scene's `Actor`. `ik.ts` solves arms onto real targets (handlebar grips, keyboard — solved once at load) and legs onto the pedals every frame (`ride` pose phase = crank angle). If you move the chair, desk, cycle mount or rig proportions, update the constants in `poses.ts`/`ik.ts` together.
- `src/world/props/Cycle.tsx` — procedural CLUX e-cycle, parts assemble via `controls.assemble`.
- `src/components/` — HTML layer: HUD, story sections (all content is real HTML), dialogs.

### Animation ownership

GSAP: scroll→time, camera rig, effect uniforms, HTML reveals. Three/useFrame: per-frame transforms of characters and props, derived from story time. React: UI state only. Interactive camera shots go through `world/cameraOverride.ts`, never by writing the camera directly.

## Conventions

- Materials: `toon()` / `flat()` from `utils/materials.ts` are cached and shared. Never mutate a cached material; create a keyed or owned one for anything animated.
- Text in 3D: `canvasTexture()` (cached by key), drawn after fonts load.
- Procedural randomness uses `rng(seed)` so the world is identical every visit.
- Reduced motion: no glitch, fisheye, handheld drift or idle animation; scroll still drives the story.
- No external 3D assets yet; `public/models/` is the place for future GLB files (Draco/KTX2).

## Testing checklist

Typecheck + build. Then in a browser: scroll all chapters both ways, use the chapter menu, open/close every project (mouse, keyboard Esc), open the cycle inspector, toggle reduced motion and quality, check a 375px viewport and `?nowebgl`.
