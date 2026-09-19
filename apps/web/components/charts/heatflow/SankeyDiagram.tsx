// apps/web/components/charts/heatflow/SankeyDiagram.tsx
'use client';

import React from 'react';
import { formatEnergy } from '../../../lib/units';
import styles from './HeatFlowPanel.module.css';
import { buildSankeyLayout, linkPath, type LaidOutLink, type LaidOutNode } from './sankey';

const WIDTH = 640;
const HEIGHT = 340;

export function SankeyDiagram({ dailyTotalsKWh }: { dailyTotalsKWh: Record<string, number> }) {
  const graph = buildSankeyLayout(dailyTotalsKWh, WIDTH, HEIGHT);
  const nodes = graph.nodes as LaidOutNode[];
  const links = graph.links as LaidOutLink[];

  return (
    <div className={styles.scrollBox} data-testid="heatflow-sankey">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Where the shelter's heat comes from and where it goes" className={styles.svg}>
        {links.map((link, i) => (
          <path
            key={i}
            d={linkPath(link)}
            stroke={link.color}
            strokeOpacity={0.45}
            strokeWidth={Math.max(1, link.width ?? 1)}
            fill="none"
            data-testid={`sankey-link-${link.label.replace(/\s+/g, '-')}`}
          />
        ))}
        {nodes.map((node) => (
          <g key={node.id} data-testid={`sankey-node-${node.id}`}>
            <rect x={node.x0} y={node.y0} width={(node.x1 ?? 0) - (node.x0 ?? 0)} height={Math.max(1, (node.y1 ?? 0) - (node.y0 ?? 0))} fill={node.color} />
            <text
              x={(node.x0 ?? 0) < WIDTH / 2 ? (node.x1 ?? 0) + 6 : (node.x0 ?? 0) - 6}
              y={((node.y0 ?? 0) + (node.y1 ?? 0)) / 2}
              dy="0.32em"
              textAnchor={(node.x0 ?? 0) < WIDTH / 2 ? 'start' : 'end'}
              className={styles.sankeyLabel}
            >
              {node.id === 'shelter' ? node.label : `${node.label} — ${formatEnergy(node.value ?? 0)}`}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
