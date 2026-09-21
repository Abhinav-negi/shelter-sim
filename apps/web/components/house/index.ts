// apps/web/components/house/index.ts
export { HouseView, activateSurface, nextScrubberHour } from './HouseView';
export { deriveGeometry, deriveHeight, surfaceQuads, boundingBox, project } from './geometry';
export type { HouseGeometry, SurfaceQuad, Vec3, Point2 } from './geometry';
export { colorForTemp, tempDomainForIndex, NEUTRAL_FILL } from './color';
export { hourToTimeIndex } from './time';
export {
  computeExportPixelSize,
  exportSvgToPngDataUrl,
  PRESENTATION_EXPORT_WIDTH_PX,
} from './export';
