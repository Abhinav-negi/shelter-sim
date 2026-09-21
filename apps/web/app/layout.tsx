import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { PwaRegister } from './_pwa-register';

export const metadata: Metadata = {
  title: 'ShelterSim',
  description: 'Passive shelter thermal simulation for Ladakh — DRDO/DIHAR, SIH problem statement 26051.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
