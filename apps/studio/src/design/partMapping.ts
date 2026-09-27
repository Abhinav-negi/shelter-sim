// Pure PartId -> left-panel section/field mapping (G4.md condition 3):
// "window:o -> Openings / '<o> window'; wall:* -> Materials / walls;
// roof -> Materials / roof; floor -> Materials / floor." Kept separate from
// selection.ts so ControlsPanel sections (and their tests) can depend on a
// plain function instead of re-deriving this switch themselves.
import type { PartId } from './selection';

export type SectionKey = 'materials' | 'openings';

/** `field` identifies which FieldRow to open+highlight. Window fields have
 *  their own orientation-specific PartId (`part` itself); the Materials
 *  section's "Walls" field has no single-orientation part of its own (all 4
 *  `wall:<o>` map onto the same field, since that field edits the wall
 *  construction for every orientation at once), so it's named by a plain
 *  string instead. */
export interface PartMapping {
  section: SectionKey;
  field: 'walls' | 'roof' | 'floor' | PartId;
}

export function mapPartToField(part: PartId): PartMapping {
  if (part === 'roof') return { section: 'materials', field: 'roof' };
  if (part === 'floor') return { section: 'materials', field: 'floor' };
  if (part.startsWith('window:')) return { section: 'openings', field: part };
  return { section: 'materials', field: 'walls' }; // wall:<orientation>
}
