// apps/web/components/house/export.ts
//
// T-46 acceptance test 9: "a screenshot of this component... is exportable
// at presentation resolution" -- the asset `CHALLENGE.md` C-18 needs before
// the PPT gate.
//
// This subagent's environment has no jsdom/canvas/headless-rasteriser (none
// is on the approved dependency list, CONTRACTS.md §7.13, and none is
// installed in this worktree), so real rasterisation can only be exercised
// in an actual browser. `exportSvgToPngDataUrl` below is that real,
// shippable browser code path -- `XMLSerializer`, `Image` and `<canvas>` are
// native Web platform APIs, not a new dependency -- but it cannot be executed
// headlessly here, so it is not covered by an automated PASS in this
// session. `computeExportPixelSize` is the pure part of it (the actual
// target-resolution arithmetic) and *is* covered, by `house.test.ts`.

/** Target export width, px -- a 1080p-class slide asset. LOG.md rule 14:
 * named calibration constant, not a magic number. */
export const PRESENTATION_EXPORT_WIDTH_PX = 1920;

/** Pure: the pixel size a `viewBox`-sized SVG rasterises to at `targetWidthPx`,
 * preserving its aspect ratio. */
export function computeExportPixelSize(
  viewBoxWidth: number,
  viewBoxHeight: number,
  targetWidthPx: number = PRESENTATION_EXPORT_WIDTH_PX,
): { width: number; height: number } {
  const scale = targetWidthPx / viewBoxWidth;
  return { width: Math.round(targetWidthPx), height: Math.round(viewBoxHeight * scale) };
}

/**
 * Real browser export path (not executable in this headless environment --
 * see the file header). Serialises the live `<svg>` element, rasterises it
 * into an offscreen `<canvas>` sized by `computeExportPixelSize`, and
 * resolves a PNG data URL a caller can hand to `<a download>` or attach to
 * the PPT deck directly.
 */
export function exportSvgToPngDataUrl(
  svgEl: SVGSVGElement,
  targetWidthPx: number = PRESENTATION_EXPORT_WIDTH_PX,
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      new Error('exportSvgToPngDataUrl needs a browser (Image + canvas); none is available here.'),
    );
  }
  const viewBox = (svgEl.getAttribute('viewBox') ?? '0 0 1 1').split(/\s+/).map(Number);
  const [, , vbW, vbH] = viewBox;
  const { width, height } = computeExportPixelSize(vbW ?? 1, vbH ?? 1, targetWidthPx);
  const svgString = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error('2D canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG rasterisation failed'));
    };
    img.src = url;
  });
}
