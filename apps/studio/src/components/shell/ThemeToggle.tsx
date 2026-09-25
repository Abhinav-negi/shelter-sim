import { Segmented } from '../ui';
import { useTheme } from '../../lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <Segmented
      aria-label="Theme"
      value={theme}
      onChange={setTheme}
      options={[
        { value: 'system', label: 'Auto' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
    />
  );
}
