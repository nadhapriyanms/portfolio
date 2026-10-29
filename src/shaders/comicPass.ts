import * as THREE from 'three'

const fullscreenVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/** Bright-pass and separable blur used to build the bloom texture at quarter resolution. */
export function createBloomMaterials() {
  const bright = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { tColor: { value: null }, uThreshold: { value: 0.75 } },
    vertexShader: fullscreenVert,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor;
      uniform float uThreshold;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tColor, vUv).rgb;
        // NaN/Inf guard: comparisons with NaN are false, so bad pixels drop to black here
        // instead of being blurred into large black blocks
        if (!(c.r >= 0.0 && c.r < 6.0e4 && c.g >= 0.0 && c.g < 6.0e4 && c.b >= 0.0 && c.b < 6.0e4)) c = vec3(0.0);
        c = min(c, vec3(16.0));
        float m = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.35, m), 1.0);
      }
    `,
  })
  const blur = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { tColor: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uDir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: fullscreenVert,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor;
      uniform vec2 uTexel, uDir;
      varying vec2 vUv;
      void main() {
        vec2 o = uDir * uTexel;
        vec3 c = texture2D(tColor, vUv).rgb * 0.227;
        c += (texture2D(tColor, vUv + o * 1.38).rgb + texture2D(tColor, vUv - o * 1.38).rgb) * 0.316;
        c += (texture2D(tColor, vUv + o * 3.23).rgb + texture2D(tColor, vUv - o * 3.23).rgb) * 0.07;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  })
  return { bright, blur }
}

/**
 * Single full-screen pass that gives the world its illustrated finish:
 * depth + colour ink outlines, halftone shading, paper grain and vignette, bloom and
 * the anime grade, plus the story effects (iris wipe, glitch, fisheye, dim, flash).
 */
export function createComicMaterial() {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      tBloom: { value: null },
      uBloom: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 400 },
      uTime: { value: 0 },
      uIris: { value: 1 },
      uGlitch: { value: 0 },
      uFisheye: { value: 0 },
      uDim: { value: 0 },
      uFlash: { value: 0 },
      uCyber: { value: 0 },
      uEdge: { value: 1 },
      uDpr: { value: 1 },
      uHalftone: { value: 1 },
      uInk: { value: new THREE.Color('#1d1a24') },
      uInkCyber: { value: new THREE.Color('#05061a') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform sampler2D tBloom;
      uniform float uBloom;
      uniform vec2 uRes;
      uniform float uNear, uFar, uTime, uIris, uGlitch, uFisheye, uDim, uFlash, uCyber, uEdge, uHalftone, uDpr;
      uniform vec3 uInk, uInkCyber;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float linDepth(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        float z = d * 2.0 - 1.0;
        return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
      }

      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

      void main() {
        float aspect = uRes.x / uRes.y;
        vec2 c = vUv - 0.5;
        c.x *= aspect;

        // Controlled barrel distortion for the globe descent.
        float r2 = dot(c, c);
        vec2 dc = c * (1.0 + uFisheye * r2 * 1.4) / (1.0 + uFisheye * 0.35);
        dc.x /= aspect;
        vec2 uv = dc + 0.5;

        // Glitch: horizontal block tearing, only while the effect is active.
        float g = uGlitch;
        if (g > 0.001) {
          float tick = floor(uTime * 14.0);
          float row = floor(uv.y * 28.0);
          float r = hash(vec2(row, tick));
          if (r > 1.0 - g * 0.32) uv.x += (hash(vec2(row, tick + 3.0)) - 0.5) * 0.14 * g;
        }

        vec2 px = 1.0 / uRes;
        // chromatic fringe grows toward the frame edges, like an old anime camera lens
        float split = 0.0035 * g + uCyber * (0.0006 + 0.0028 * r2);
        vec3 col;
        col.r = texture2D(tColor, uv + vec2(split, 0.0)).r;
        col.g = texture2D(tColor, uv).g;
        col.b = texture2D(tColor, uv - vec2(split, 0.0)).b;
        // an invalid pixel from any material becomes ink rather than a hole
        if (!(col.r >= 0.0 && col.g >= 0.0 && col.b >= 0.0 && col.r < 6.0e4 && col.g < 6.0e4 && col.b < 6.0e4)) col = uInk;

        // Ink outlines from depth discontinuities and colour contrast.
        if (uEdge > 0.0) {
          float w = max(1.0, uDpr * 0.9);
          float dC = linDepth(uv);
          float dL = linDepth(uv - vec2(px.x * w, 0.0));
          float dR = linDepth(uv + vec2(px.x * w, 0.0));
          float dU = linDepth(uv + vec2(0.0, px.y * w));
          float dD = linDepth(uv - vec2(0.0, px.y * w));
          float dEdge = (abs(dL - dR) + abs(dU - dD)) / max(dC, 0.001);
          float farAll = step(uFar * 0.85, min(min(dL, dR), min(dU, dD)));
          float eD = smoothstep(0.035, 0.09, dEdge) * (1.0 - farAll);
          float lL = luma(texture2D(tColor, uv - vec2(px.x, 0.0)).rgb);
          float lR = luma(texture2D(tColor, uv + vec2(px.x, 0.0)).rgb);
          float lU = luma(texture2D(tColor, uv + vec2(0.0, px.y)).rgb);
          float lD = luma(texture2D(tColor, uv - vec2(0.0, px.y)).rgb);
          float eC = smoothstep(0.1, 0.24, abs(lL - lR) + abs(lU - lD)) * 0.5;
          float fade = 1.0 - smoothstep(60.0, 180.0, dC);
          float edge = clamp(max(eD, eC) * uEdge * mix(0.35, 1.0, fade), 0.0, 1.0);
          col = mix(col, mix(uInk, uInkCyber, uCyber), edge * 0.92);
        }

        // Halftone dots in the shadows.
        if (uHalftone > 0.0) {
          float l = luma(col);
          vec2 cell = fract(gl_FragCoord.xy / (5.0 * uDpr)) - 0.5;
          float dotR = clamp((0.22 - l) * 1.6, 0.0, 0.5);
          float aa = 0.6 / (5.0 * uDpr);
          float dotMask = 1.0 - smoothstep(dotR - aa, dotR + aa, length(cell));
          col *= 1.0 - dotMask * 0.1 * uHalftone;
        }

        // Bloom: neon halos, with a magenta halation edge in the security layer (cel-anime glow).
        vec3 bl = texture2D(tBloom, uv).rgb;
        if (!(bl.r >= 0.0 && bl.g >= 0.0 && bl.b >= 0.0 && bl.r < 6.0e4)) bl = vec3(0.0);
        col += bl * uBloom * mix(vec3(1.0), vec3(1.15, 0.85, 1.2), uCyber);

        // 90s anime grade for the security layer: lifted violet shadows, cool highlights.
        float lum = luma(col);
        col = mix(col, col * vec3(0.92, 0.96, 1.1) + vec3(0.035, 0.0, 0.07) * (1.0 - lum), uCyber * 0.85);

        // Paper grain (still) by day; animated film grain at night.
        float grain = hash(floor(gl_FragCoord.xy / uDpr) + floor(uTime * 24.0) * uCyber * 17.0);
        col *= 0.985 + (0.015 + 0.035 * uCyber) * grain;
        col *= 1.0 - 0.28 * pow(length(vUv - 0.5) * 1.25, 2.4);

        // Scanlines for the security layer.
        float scan = step(0.5, fract(gl_FragCoord.y * 0.5));
        col *= 1.0 - (0.05 * uCyber + 0.14 * g) * scan;

        // Focus dim: darkens the surroundings, keeps the subject in the centre lit.
        col *= 1.0 - 0.7 * uDim * smoothstep(0.12, 0.75, length(c));
        col = mix(col, vec3(1.0, 0.98, 0.94), uFlash);

        // Ink iris wipe between environments.
        float ang = atan(c.y, c.x);
        float rad = uIris * 1.25 + 0.012 * sin(ang * 9.0 + uTime * 1.5) * step(0.001, 1.0 - uIris);
        float inner = smoothstep(rad - 0.004, rad, length(c));
        col = mix(col, mix(uInk, uInkCyber, uCyber), inner);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}
