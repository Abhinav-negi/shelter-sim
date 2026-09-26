import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SliderField } from './SliderField';

// jsdom doesn't auto-clean between tests without vitest's `globals: true`
// (vitest.config.ts leaves it off), so unmount explicitly.
afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState(20);
  return (
    <SliderField
      label="South window"
      value={value}
      onChange={setValue}
      min={0}
      max={100}
      step={5}
      unit="%"
      decimals={0}
    />
  );
}

describe('SliderField', () => {
  it('types 10 + Enter -> commits 10 and syncs the slider', () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'South window' }) as HTMLInputElement;
    const slider = screen.getByRole('slider', { name: 'South window' }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('10');
    expect(slider.value).toBe('10');
  });

  it('types 999 + Enter -> clamps to max', () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'South window' }) as HTMLInputElement;
    const slider = screen.getByRole('slider', { name: 'South window' }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('100');
    expect(slider.value).toBe('100');
  });

  it('invalid text reverts without calling onChange', () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'South window' }) as HTMLInputElement;
    const slider = screen.getByRole('slider', { name: 'South window' }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('20');
    expect(slider.value).toBe('20');
  });

  it('Escape reverts the draft', () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'South window' }) as HTMLInputElement;
    const slider = screen.getByRole('slider', { name: 'South window' }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '55' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input.value).toBe('20');
    expect(slider.value).toBe('20');
  });

  it('blur commits the draft', () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'South window' }) as HTMLInputElement;
    const slider = screen.getByRole('slider', { name: 'South window' }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '35' } });
    fireEvent.blur(input);

    expect(input.value).toBe('35');
    expect(slider.value).toBe('35');
  });

  it('ArrowUp/ArrowDown commit one step immediately, clamped', () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'South window' }) as HTMLInputElement;
    const slider = screen.getByRole('slider', { name: 'South window' }) as HTMLInputElement;

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(slider.value).toBe('25');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('15');
    expect(slider.value).toBe('15');
  });

  it('fractional steps commit clean numbers (no float noise)', () => {
    const seen: number[] = [];
    function Metres() {
      const [value, setValue] = useState(2.2);
      return (
        <SliderField
          label="Height"
          value={value}
          onChange={(v) => {
            seen.push(v);
            setValue(v);
          }}
          min={2}
          max={4}
          step={0.1}
          unit="m"
        />
      );
    }
    render(<Metres />);
    const input = screen.getByRole('spinbutton', { name: 'Height' }) as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.change(input, { target: { value: '3.14' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(seen).toEqual([2.3, 3.1]);
  });
});
