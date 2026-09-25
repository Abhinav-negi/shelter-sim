import { useParams } from 'react-router';

/** Placeholder — F2 adds the 3D viewer, F3 the controls + live preview + results. */
export function Studio() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new' || !id;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold">{isNew ? 'New shelter' : 'Edit shelter'}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        This page will hold the design controls (environment, geometry, materials, openings,
        orientation, advanced) on the left, the 3D shelter viewer in the centre, and simulation
        results on the right.
      </p>
    </div>
  );
}
