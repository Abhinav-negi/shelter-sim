'use client';

// apps/web/components/inputs/MaterialStackEditor.tsx
//
// T-44's material-stack editor: opens when `store.selectedSurfaceId` is set
// by T-46's house (clicking a wall/roof/floor in the isometric view), and
// shows THAT surface's construction as named layer cards with a thickness
// slider each -- the multi-layer detail the basic wall/roof/floor dropdowns
// (one material, one default thickness) deliberately don't expose. Coordinate
// point with T-46 (CONTRACTS.md / LOG.md "Conflicts with"): this component
// only READS `store.selectedSurfaceId` and calls
// `actions.setSelectedSurfaceId(null)` to close itself -- it never redefines
// what that field means or how the house sets it.

import React from 'react';
import type { Material, SimulationRequest } from '@shelter/engine';
import { actions } from '../../lib/store';
import { setLayerThickness } from './requestOps';

export interface MaterialStackEditorProps {
  request: SimulationRequest;
  selectedSurfaceId: string;
  catalogue: Material[];
  onChange: (next: SimulationRequest) => void;
}

const MM_PER_M = 1000;

export function MaterialStackEditor({ request, selectedSurfaceId, catalogue, onChange }: MaterialStackEditorProps) {
  const surface = request.building.surfaces.find((s) => s.id === selectedSurfaceId);
  if (!surface) return null;

  function close() {
    actions.setSelectedSurfaceId(null);
  }

  return (
    <section
      data-testid="stack-editor"
      aria-label={`Material stack for ${surface!.id}`}
      style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginTop: 8 }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>{surface!.type === 'wall' ? 'Wall' : surface!.type === 'roof' ? 'Roof' : 'Floor'} layers -- {surface!.id}</strong>
        <button type="button" onClick={close} aria-label="Close material stack editor">
          Close
        </button>
      </header>
      <p style={{ fontSize: 12, color: '#475569' }}>
        Layers ordered outside (top) to inside (bottom). Drag a slider to change how thick a layer is.
      </p>
      <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {surface!.construction.map((layer, i) => {
          const material = catalogue.find((m) => m.id === layer.materialId);
          const thicknessMm = Math.round(layer.thickness * MM_PER_M);
          const inputId = `stack-thickness-${surface!.id}-${i}`;
          return (
            <li key={`${layer.materialId}-${i}`} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8 }}>
              <div style={{ fontWeight: 600 }}>{material?.name ?? layer.materialId}</div>
              {material?.blurb && <div style={{ fontSize: 12, color: '#475569' }}>{material.blurb}</div>}
              <label htmlFor={inputId} style={{ display: 'block', marginTop: 4 }}>
                Thickness: {thicknessMm} mm
              </label>
              <input
                id={inputId}
                type="range"
                min={10}
                max={600}
                step={10}
                value={thicknessMm}
                onChange={(e) => {
                  const thicknessM = Number(e.target.value) / MM_PER_M;
                  onChange(setLayerThickness(request, surface!.id, i, thicknessM, catalogue));
                }}
              />
              {material?.source && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12 }}>Where this number comes from</summary>
                  <p style={{ fontSize: 12, color: '#475569' }}>{material.source}</p>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
