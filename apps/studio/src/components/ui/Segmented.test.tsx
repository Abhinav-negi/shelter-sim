import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Segmented } from './Segmented';

function Harness() {
  const [value, setValue] = useState<'a' | 'b'>('a');
  return (
    <Segmented
      aria-label="Test"
      value={value}
      onChange={setValue}
      options={[
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]}
    />
  );
}

describe('Segmented', () => {
  it('checks the option matching value and switches on click', async () => {
    render(<Harness />);
    const a = screen.getByRole('radio', { name: 'A' }) as HTMLInputElement;
    const b = screen.getByRole('radio', { name: 'B' }) as HTMLInputElement;
    expect(a.checked).toBe(true);
    expect(b.checked).toBe(false);

    b.click();

    expect(a.checked).toBe(false);
    expect(b.checked).toBe(true);
  });
});
