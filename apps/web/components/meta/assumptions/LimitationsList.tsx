'use client';

// apps/web/components/meta/assumptions/LimitationsList.tsx
//
// T-52(b). Deliberate choices, stated with their consequence, not as
// apologies (CHALLENGE.md C-20 / LOG.md rule 13). Data lives in
// limitations.data.ts, including a note on the incorrect antonym acceptance
// test 4 greps this whole directory for -- "well-mixed" is the only term
// used throughout.

import React from 'react';
import { useStore } from '../../../lib/store';
import { t } from '../../../lib/i18n';
import '../messages';
import { LIMITATIONS } from './limitations.data';
import styles from './AssumptionsPanel.module.css';

export function LimitationsList() {
  const { locale } = useStore();
  return (
    <div data-testid="limitations-list">
      <h2 className={styles.sectionTitle}>{t('meta.limitations.title', locale)}</h2>
      <p className={styles.subtitle}>{t('meta.limitations.subtitle', locale)}</p>
      <ul>
        {LIMITATIONS.map((item) => (
          <li key={item.id} data-testid={`limitation-${item.id}`}>
            <strong>{item.choice}</strong>
            <div>{item.consequence}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
