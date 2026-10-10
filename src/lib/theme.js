// Material 3 inspired theme engine.
// A single seed colour generates full light + dark tonal schemes (primary, secondary,
// tertiary, neutral surfaces, semantic colours). Users can override individual roles.
// The result is injected as CSS custom properties for both [data-theme] modes, so the
// existing light/dark switch keeps working without re-generating anything.

export const THEME_STORAGE_KEY = 'expense_pro_appearance_v1';

export const FONT_OPTIONS = [
  { id: 'roboto', label: 'Roboto (Material)', stack: "'Roboto', 'Segoe UI', system-ui, sans-serif" },
  { id: 'inter', label: 'Inter', stack: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  { id: 'jakarta', label: 'Plus Jakarta Sans', stack: "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif" },
  { id: 'poppins', label: 'Poppins', stack: "'Poppins', 'Segoe UI', system-ui, sans-serif" },
  { id: 'system', label: 'System default', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
];

export const THEME_PRESETS = [
  { id: 'indigo', label: 'Indigo', seed: '#4f5bd5' },
  { id: 'emerald', label: 'Emerald', seed: '#0f9d58' },
  { id: 'teal', label: 'Teal', seed: '#00897b' },
  { id: 'ocean', label: 'Ocean', seed: '#1a73e8' },
  { id: 'grape', label: 'Grape', seed: '#8e44ad' },
  { id: 'rose', label: 'Rose', seed: '#d81b60' },
  { id: 'amber', label: 'Amber', seed: '#e8a317' },
  { id: 'sunset', label: 'Sunset', seed: '#f4511e' },
  { id: 'forest', label: 'Forest', seed: '#2e7d32' },
  { id: 'slate', label: 'Slate', seed: '#546e7a' },
];

export const DEFAULT_APPEARANCE = {
  seed: '#4f5bd5',
  secondary: '', // empty = derived from seed
  tertiary: '', // empty = derived from seed
  income: '#1e8e3e',
  expense: '#d93025',
  radius: 16, // base corner radius in px (cards); buttons are pill-shaped
  density: 'comfortable', // 'compact' | 'comfortable' | 'spacious'
  font: 'roboto',
  fontScale: 100, // percent
  surfaceTint: 'tinted', // 'neutral' | 'tinted'
  background: 'plain', // 'plain' | 'gradient'
};

// ---------- colour math ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalizeHex(hex, fallback = '#4f5bd5') {
  if (typeof hex !== 'string') return fallback;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : fallback;
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

export function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  const k = (n) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

// Relative luminance & contrast (WCAG) – used to pick readable "on" colours
function luminance(hex) {
  const c = hexToRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// A tone in the Material sense: same hue/chroma, lightness = tone (0 black .. 100 white).
// Saturation is softened at the extremes so very light/dark tones stay natural.
function tone(hue, sat, t) {
  const edge = Math.abs(t - 50) / 50; // 0 at mid, 1 at extremes
  const s = sat * (1 - 0.35 * edge * edge);
  return hslToHex(hue, s, t);
}

function palette(hex, satCap = 90, satFloor = 0) {
  const { h, s } = hexToHsl(hex);
  const sat = clamp(s, satFloor, satCap);
  return (t) => tone(h, sat, t);
}

// Readable foreground for an arbitrary background
function onColor(bg) {
  return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#1b1b1f') ? '#ffffff' : '#1b1b1f';
}

const rgbTriplet = (hex) => hexToRgb(hex).join(', ');

function roleSet(prefix, p, mode) {
  const light = mode === 'light';
  return {
    [`--md-${prefix}`]: p(light ? 40 : 80),
    [`--md-on-${prefix}`]: p(light ? 100 : 20),
    [`--md-${prefix}-container`]: p(light ? 90 : 30),
    [`--md-on-${prefix}-container`]: p(light ? 10 : 90),
  };
}

function semantic(prefix, hex, mode) {
  const { h, s } = hexToHsl(hex);
  const sat = clamp(s, 45, 85);
  const light = mode === 'light';
  const main = tone(h, sat, light ? 38 : 72);
  return {
    [`--md-${prefix}`]: main,
    [`--md-on-${prefix}`]: onColor(main),
    [`--md-${prefix}-container`]: tone(h, sat, light ? 92 : 25),
    [`--md-on-${prefix}-container`]: tone(h, sat, light ? 12 : 90),
    [`--md-${prefix}-rgb`]: rgbTriplet(main),
  };
}

export function buildScheme(appearance, mode) {
  const a = { ...DEFAULT_APPEARANCE, ...appearance };
  const seed = normalizeHex(a.seed, DEFAULT_APPEARANCE.seed);
  const { h: seedHue, s: seedSat } = hexToHsl(seed);
  const light = mode === 'light';

  const primary = palette(seed, 85, 35);
  const secondary = a.secondary ? palette(a.secondary, 60, 15) : (t) => tone(seedHue, clamp(seedSat * 0.35, 10, 35), t);
  const tertiary = a.tertiary ? palette(a.tertiary, 75, 25) : (t) => tone(seedHue + 60, clamp(seedSat * 0.6, 25, 60), t);

  // Neutral surfaces carry a hint of the seed hue when "tinted"
  const nSat = a.surfaceTint === 'neutral' ? 2 : clamp(seedSat * 0.12, 4, 12);
  const nvSat = a.surfaceTint === 'neutral' ? 4 : clamp(seedSat * 0.2, 8, 18);
  const n = (t) => hslToHex(seedHue, nSat, t);
  const nv = (t) => hslToHex(seedHue, nvSat, t);

  const vars = {
    ...roleSet('primary', primary, mode),
    ...roleSet('secondary', secondary, mode),
    ...roleSet('tertiary', tertiary, mode),

    '--md-background': n(light ? 98 : 6),
    '--md-on-background': n(light ? 10 : 90),
    '--md-surface': n(light ? 98 : 6),
    '--md-surface-dim': n(light ? 87 : 6),
    '--md-surface-bright': n(light ? 98 : 24),
    '--md-surface-container-lowest': n(light ? 100 : 4),
    '--md-surface-container-low': n(light ? 96 : 10),
    '--md-surface-container': n(light ? 94 : 12),
    '--md-surface-container-high': n(light ? 92 : 17),
    '--md-surface-container-highest': n(light ? 90 : 22),
    '--md-on-surface': n(light ? 10 : 90),
    '--md-surface-variant': nv(light ? 90 : 30),
    '--md-on-surface-variant': nv(light ? 30 : 80),
    '--md-outline': nv(light ? 50 : 60),
    '--md-outline-variant': nv(light ? 80 : 30),
    '--md-inverse-surface': n(light ? 20 : 90),
    '--md-inverse-on-surface': n(light ? 95 : 20),
    '--md-inverse-primary': primary(light ? 80 : 40),
    '--md-scrim': '#000000',
    '--md-shadow-rgb': '0, 0, 0',

    ...semantic('success', a.income, mode),
    ...semantic('error', a.expense, mode),
    ...semantic('warning', '#e8a317', mode),
    ...semantic('info', '#1a73e8', mode),
  };

  vars['--md-primary-rgb'] = rgbTriplet(vars['--md-primary']);
  vars['--md-tertiary-rgb'] = rgbTriplet(vars['--md-tertiary']);
  vars['--md-on-surface-rgb'] = rgbTriplet(vars['--md-on-surface']);
  vars['--md-surface-rgb'] = rgbTriplet(vars['--md-surface']);

  // Legacy variables used across the existing stylesheet -> mapped to MD roles
  Object.assign(vars, {
    '--bg-main': vars['--md-surface'],
    '--bg-sidebar': vars['--md-surface-container-low'],
    '--bg-card': vars['--md-surface-container-low'],
    '--bg-card-hover': vars['--md-surface-container'],
    '--bg-input': vars['--md-surface-container-lowest'],
    '--border-subtle': vars['--md-outline-variant'],
    '--border-focus': vars['--md-primary'],
    '--border-glow': `rgba(${vars['--md-primary-rgb']}, 0.18)`,
    '--text-primary': vars['--md-on-surface'],
    '--text-secondary': vars['--md-on-surface-variant'],
    '--text-muted': vars['--md-outline'],
    '--accent-primary': vars['--md-primary'],
    '--accent-primary-hover': primary(light ? 30 : 70),
    '--accent-gradient': `linear-gradient(135deg, ${vars['--md-primary']} 0%, ${vars['--md-tertiary']} 100%)`,
    '--color-primary': vars['--md-primary'],
    '--income-color': vars['--md-success'],
    '--income-bg': `rgba(${vars['--md-success-rgb']}, 0.12)`,
    '--income-border': `rgba(${vars['--md-success-rgb']}, 0.3)`,
    '--expense-color': vars['--md-error'],
    '--expense-bg': `rgba(${vars['--md-error-rgb']}, 0.12)`,
    '--expense-border': `rgba(${vars['--md-error-rgb']}, 0.3)`,
    '--color-danger': vars['--md-error'],
  });

  return vars;
}

function shapeAndType(appearance) {
  const a = { ...DEFAULT_APPEARANCE, ...appearance };
  const r = clamp(Number(a.radius) || 0, 0, 32);
  const font = FONT_OPTIONS.find((f) => f.id === a.font) || FONT_OPTIONS[0];
  const density = { compact: 0.8, comfortable: 1, spacious: 1.2 }[a.density] || 1;
  return {
    '--md-radius-xs': `${Math.round(r * 0.25)}px`,
    '--md-radius-sm': `${Math.round(r * 0.5)}px`,
    '--md-radius-md': `${Math.round(r * 0.75)}px`,
    '--md-radius-lg': `${r}px`,
    '--md-radius-xl': `${Math.round(r * 1.75)}px`,
    '--md-radius-full': r === 0 ? '4px' : '999px',
    '--md-density': String(density),
    '--md-space': `${(1 * density).toFixed(2)}rem`,
    '--md-font': font.stack,
    '--md-font-scale': String(clamp(Number(a.fontScale) || 100, 85, 125) / 100),
    '--font-sans': font.stack,
    '--font-display': font.stack,
  };
}

const toCss = (vars) =>
  Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

export function buildThemeCss(appearance) {
  const a = { ...DEFAULT_APPEARANCE, ...appearance };
  const common = shapeAndType(a);
  const lightVars = buildScheme(a, 'light');
  const darkVars = buildScheme(a, 'dark');
  const gradient = (vars) =>
    a.background === 'gradient'
      ? `radial-gradient(circle at 10% 0%, rgba(${vars['--md-primary-rgb']}, 0.12) 0%, transparent 45%), radial-gradient(circle at 90% 10%, rgba(${vars['--md-tertiary-rgb']}, 0.10) 0%, transparent 45%)`
      : 'none';

  return `:root {\n${toCss(common)}\n${toCss(darkVars)}\n  --md-bg-image: ${gradient(darkVars)};\n  color-scheme: dark;\n}
:root[data-theme="light"], :root.light {\n${toCss(lightVars)}\n  --md-bg-image: ${gradient(lightVars)};\n  color-scheme: light;\n}
:root[data-theme="dark"], :root.dark {\n${toCss(darkVars)}\n  --md-bg-image: ${gradient(darkVars)};\n  color-scheme: dark;\n}`;
}

export function loadAppearance(scope = 'guest') {
  try {
    const raw =
      localStorage.getItem(`${THEME_STORAGE_KEY}_${scope}`) || localStorage.getItem(`${THEME_STORAGE_KEY}_guest`);
    if (raw) return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_APPEARANCE };
}

export function saveAppearance(appearance, scope = 'guest') {
  try {
    localStorage.setItem(`${THEME_STORAGE_KEY}_${scope}`, JSON.stringify(appearance));
  } catch {
    /* ignore */
  }
}

export function applyAppearance(appearance) {
  if (typeof document === 'undefined') return;
  let tag = document.getElementById('md-theme-vars');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'md-theme-vars';
    document.head.appendChild(tag);
  }
  tag.textContent = buildThemeCss(appearance);
}
