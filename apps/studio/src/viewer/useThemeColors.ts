import { useEffect, useState } from 'react';

export interface SceneColors {
  paper: string;
  surface: string;
  ink: string;
  inkMuted: string;
  hairline: string;
  accent: string;
  /** The thermal scale's warm stop — used for the sun indicator (a data
   *  value, not decoration), never for the building/UI. */
  thermalWarm: string;
}

const CSS_VAR: Record<keyof SceneColors, string> = {
  paper: '--paper',
  surface: '--surface',
  ink: '--ink',
  inkMuted: '--ink-muted',
  hairline: '--hairline',
  accent: '--accent',
  thermalWarm: '--thermal-warm',
};

const FALLBACK: SceneColors = {
  paper: '#f6f5f2',
  surface: '#efeeea',
  ink: '#16171a',
  inkMuted: '#63676c',
  hairline: '#dcdad3',
  accent: '#26597e',
  thermalWarm: '#c98a4b',
};

function readColors(): SceneColors {
  const style = getComputedStyle(document.documentElement);
  const out = { ...FALLBACK };
  for (const key of Object.keys(CSS_VAR) as (keyof SceneColors)[]) {
    const value = style.getPropertyValue(CSS_VAR[key]).trim();
    if (value) out[key] = value;
  }
  return out;
}

/** Scene colours read from the design tokens (styles/tokens.css), so the 3D
 *  scene matches light/dark like the rest of the UI (PLAN.md §Design system).
 *  Re-reads whenever the theme changes — system preference or the explicit
 *  `data-theme` toggle (src/lib/theme.ts) — via native `matchMedia` +
 *  `MutationObserver`, no extra dependency. */
export function useThemeColors(): SceneColors {
  const [colors, setColors] = useState<SceneColors>(() =>
    typeof document === 'undefined' ? FALLBACK : readColors(),
  );

  useEffect(() => {
    const update = () => setColors(readColors());
    update();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  return colors;
}
