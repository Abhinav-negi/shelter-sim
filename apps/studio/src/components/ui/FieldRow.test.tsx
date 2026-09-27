import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSelection } from '../../design/selection';
import { FieldRow } from './FieldRow';

afterEach(cleanup);

beforeEach(() => {
  useSelection.setState({ hoveredPart: null, selectedPart: null });
  Element.prototype.scrollIntoView = vi.fn();
});

describe('FieldRow (G4: 3D part <-> field highlighting)', () => {
  it('hovering a row with a `part` sets it as the hovered part in 3D, clears on leave', () => {
    render(
      <FieldRow label="East window" part="window:E">
        <input />
      </FieldRow>,
    );
    const row = screen.getByText('East window').parentElement!;
    fireEvent.mouseEnter(row);
    expect(useSelection.getState().hoveredPart).toBe('window:E');
    fireEvent.mouseLeave(row);
    expect(useSelection.getState().hoveredPart).toBeNull();
  });

  it('focusing a row with a `part` also sets the hovered part (keyboard reachable)', () => {
    render(
      <FieldRow label="East window" part="window:E">
        <input />
      </FieldRow>,
    );
    const row = screen.getByText('East window').parentElement!;
    fireEvent.focus(row);
    expect(useSelection.getState().hoveredPart).toBe('window:E');
    fireEvent.blur(row);
    expect(useSelection.getState().hoveredPart).toBeNull();
  });

  it('a row with no `part` never touches hoveredPart', () => {
    render(
      <FieldRow label="Walls">
        <input />
      </FieldRow>,
    );
    const row = screen.getByText('Walls').parentElement!;
    fireEvent.mouseEnter(row);
    expect(useSelection.getState().hoveredPart).toBeNull();
  });

  it('flashes and scrolls into view when its `part` becomes the selected part', () => {
    useSelection.setState({ selectedPart: 'window:E' });
    render(
      <FieldRow label="East window" part="window:E">
        <input />
      </FieldRow>,
    );
    const row = screen.getByText('East window').parentElement!;
    expect(row.className).toContain('outline-accent');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('does not flash when the selected part does not match `part`', () => {
    useSelection.setState({ selectedPart: 'roof' });
    render(
      <FieldRow label="East window" part="window:E">
        <input />
      </FieldRow>,
    );
    const row = screen.getByText('East window').parentElement!;
    expect(row.className).not.toContain('outline-accent');
  });

  it('a `highlighted` override flashes a field with no single matching part (e.g. "Walls")', () => {
    render(
      <FieldRow label="Walls" highlighted>
        <input />
      </FieldRow>,
    );
    const row = screen.getByText('Walls').parentElement!;
    expect(row.className).toContain('outline-accent');
  });
});
