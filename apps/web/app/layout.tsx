import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShelterSim',
  description: 'Passive shelter thermal simulation for Ladakh — DRDO/DIHAR, SIH problem statement 26051.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
