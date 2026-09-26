import { beforeEach, describe, expect, it } from 'vitest';
import { useSelection } from './selection';

beforeEach(() => {
  useSelection.setState({ hoveredPart: null, selectedPart: null });
});

describe('selection store', () => {
  it('starts with nothing hovered or selected', () => {
    const state = useSelection.getState();
    expect(state.hoveredPart).toBeNull();
    expect(state.selectedPart).toBeNull();
  });

  it('setHoveredPart sets and clears the hovered part independently of selection', () => {
    useSelection.getState().selectPart('roof');
    useSelection.getState().setHoveredPart('wall:S');
    expect(useSelection.getState().hoveredPart).toBe('wall:S');
    expect(useSelection.getState().selectedPart).toBe('roof');
    useSelection.getState().setHoveredPart(null);
    expect(useSelection.getState().hoveredPart).toBeNull();
  });

  it('selectPart sets the selected part', () => {
    useSelection.getState().selectPart('window:E');
    expect(useSelection.getState().selectedPart).toBe('window:E');
  });

  it('selectPart(null) clears the selection (click empty space / Esc)', () => {
    useSelection.getState().selectPart('floor');
    useSelection.getState().selectPart(null);
    expect(useSelection.getState().selectedPart).toBeNull();
  });

  it('clearSelection clears both hovered and selected', () => {
    useSelection.getState().selectPart('wall:N');
    useSelection.getState().setHoveredPart('wall:N');
    useSelection.getState().clearSelection();
    expect(useSelection.getState().selectedPart).toBeNull();
    expect(useSelection.getState().hoveredPart).toBeNull();
  });
});
