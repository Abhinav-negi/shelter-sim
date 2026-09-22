'use client';

// apps/web/components/nav/PrimaryNav.tsx
//
// The three real destinations the app now has: Setup (inputs), Results
// (charts + KPIs), Compare (stub). `next/link` + `usePathname()` is the
// entire mechanism -- no router library, no active-route context needed for
// three links (ponytail: add a context only if this nav grows past one
// component).

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/setup', label: 'Setup' },
  { href: '/results', label: 'Results' },
  { href: '/compare', label: 'Compare' },
] as const;

export function PrimaryNav({ right }: { right?: ReactNode }) {
  const pathname = usePathname();

  return (
    <nav className="primary-nav" aria-label="main" data-print-hide="true">
      <div className="primary-nav__links">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}>
              {link.label}
            </Link>
          );
        })}
      </div>
      {right}
    </nav>
  );
}
