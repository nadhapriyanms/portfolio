# Nadhapriyan M. S. — An Engineering Story

An interactive, scroll-driven 3D comic portfolio. Ten chapters run from a floating globe, through school, college, the cycle workshop and a cyberpunk security layer, to a project skyline, an achievement constellation and a dawn contact scene.

## Run locally

Requires Node 20+ (tested with Node 24).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173.

## Production build

```bash
npm run build
```

The static site lands in `dist/`. It is a plain static bundle with no backend.

## Deploy

Any static host works. Examples:

- **Vercel / Netlify**: import the repository, build command `npm run build`, output directory `dist`.
- **GitHub Pages**: run `npm run build` and publish `dist/`. If the site lives under a sub-path (e.g. `/portfolio/`), set `base: '/portfolio/'` in `vite.config.ts` and update `profile.resume` in `src/content/profile.ts`.

GSAP 3 (including ScrollTrigger) is free for commercial use under GSAP's standard licence since 2024; review https://gsap.com/licensing/ before deploying.

## Editing content

All text lives in `src/content/profile.ts`, `src/content/achievements.ts` and `src/projects/projectData.ts`. The downloadable résumé is `public/docs/Nadhapriyan-M-S-Resume.pdf`. See `CLAUDE.md` for architecture notes and `docs/ASSET-INVENTORY.md` for source materials.
