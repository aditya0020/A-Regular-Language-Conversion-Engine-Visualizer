import { Handle, Position } from '@xyflow/react';
import { useEffect, useState } from 'react';

const SIZE = 64; // visual circle diameter

/**
 * CustomNode — four named handles at compass positions.
 *
 * Handle IDs match what graphLayout.js assigns to edges:
 *   'right'  →  forward edges  (source exits right, target enters left)
 *   'left'   →  incoming forward edges
 *   'bottom' →  back-edges / self-loop underpass
 *   'top'    →  self-loop overpass
 *
 * All handles are invisible (opacity:0) — their sole job is to give
 * React Flow precise anchor coordinates at the node rim.
 */
export default function CustomNode({ data }) {
  const { label, isAccept, isStart, isHighlighted, isPath, isDead, isRejected, isRejectedPath } = data;
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (isHighlighted) {
      setPulse(false);
      const t = setTimeout(() => setPulse(true), 10);
      return () => clearTimeout(t);
    } else {
      setPulse(false);
    }
  }, [isHighlighted, isRejected]);

  let border    = '2px solid #38bdf8';
  let bg        = '#0c1a26';
  let color     = '#e0f6ff';
  let glow      = '0 0 10px #38bdf822';
  let transform = 'scale(1)';
  let animation = 'none';

  if (isDead) {
    border = '2px solid #30363d';
    bg     = '#0d1117';
    color  = '#6e7681';
    glow   = 'none';
  }
  // Visited / path nodes
  if (isRejectedPath) {
    border    = '2px solid #cc3333';
    bg        = '#1a0000';
    color     = '#fca5a5';
    glow      = '0 0 10px #cc333355, 0 0 22px #cc333322';
  } else if (isPath) {
    border    = '2px solid #00c870';
    bg        = '#001a0e';
    color     = '#a7f3d0';
    glow      = '0 0 10px #00c87055, 0 0 22px #00c87022';
  }
  // Active / current node
  if (isRejected) {
    border    = '3px solid #ff4444';
    bg        = '#1a0000';
    color     = '#ffcccc';
    glow      = '0 0 20px #ff444499, 0 0 44px #ff444433';
    transform  = pulse ? 'scale(1.18)' : 'scale(1.08)';
    animation = 'nodeRejectPulse 1.6s ease-in-out infinite';
  } else if (isHighlighted) {
    border    = '3px solid #00e676';
    bg        = '#001a0d';
    color     = '#ccffe8';
    glow      = '0 0 20px #00e67699, 0 0 44px #00e67633';
    transform  = pulse ? 'scale(1.18)' : 'scale(1.08)';
    animation = 'nodeActivePulse 1.6s ease-in-out infinite';
  }

  const tooltip = [
    label,
    isStart  ? '(start)'  : '',
    isAccept ? '(accept)' : '',
    isDead   ? '(dead/trap)' : '',
  ].filter(Boolean).join(' ');

  // Invisible handles — zero visual footprint, precise rim placement
  const h = (id, type, position) => (
    <Handle
      id={id}
      type={type}
      position={position}
      style={{ opacity: 0, width: 6, height: 6, background: 'transparent', border: 'none' }}
    />
  );

  return (
    <>
      {/* ── Four named docking points ── */}
      {h('left',   'target', Position.Left)}
      {h('right',  'source', Position.Right)}
      {h('top',    'source', Position.Top)}
      {h('bottom', 'source', Position.Bottom)}

      {/* Duplicate target handles so an edge can arrive from any direction */}
      {h('top-in',    'target', Position.Top)}
      {h('bottom-in', 'target', Position.Bottom)}
      {h('right-in',  'target', Position.Right)}

      <div
        title={tooltip}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {isStart && (
          <div style={{
            position: 'absolute',
            left: -38,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#38bdf8',
            fontSize: 20,
            fontWeight: 900,
            lineHeight: 1,
            filter: 'drop-shadow(0 0 6px #38bdf899)',
          }}>▶</div>
        )}

        {/* Ripple burst on state entry */}
        {isHighlighted && pulse && (
          <div style={{
            position: 'absolute',
            width: SIZE + 28, height: SIZE + 28, borderRadius: '50%',
            border: `3px solid ${isRejected ? '#ff4444' : '#00e676'}`,
            animation: 'nodeRipple 0.7s cubic-bezier(0.2,0,0.8,1) forwards',
            pointerEvents: 'none',
          }} />
        )}
        {/* Soft path ripple */}
        {isPath && pulse && (
          <div style={{
            position: 'absolute',
            width: SIZE + 20, height: SIZE + 20, borderRadius: '50%',
            border: `2px solid ${isRejectedPath ? '#cc3333' : '#00c870'}`,
            animation: 'nodeRipple 0.5s cubic-bezier(0.2,0,0.8,1) forwards',
            pointerEvents: 'none', opacity: 0.6,
          }} />
        )}

        {/* Accept state double ring */}
        {isAccept && (
          <div style={{
            position: 'absolute',
            width: SIZE + 14, height: SIZE + 14,
            borderRadius: '50%',
            border: isRejected    ? '2px solid #ff4444'
              : isHighlighted  ? '2px solid #00e676'
              : isRejectedPath ? '2px solid #cc3333'
              : isPath         ? '2px solid #00c870'
              :                  '2px solid #34d399',
            boxShadow: isRejected    ? '0 0 16px #ff444466'
              : isHighlighted  ? '0 0 16px #00e67666'
              : isRejectedPath ? '0 0 10px #cc333355'
              : isPath         ? '0 0 10px #00c87055'
              :                  '0 0 10px #34d39944',
            opacity: 0.85,
            transition: 'all 0.35s ease',
          }} />
        )}

        {/* Main circle */}
        <div style={{
          width: SIZE, height: SIZE,
          borderRadius: '50%',
          border, background: bg, boxShadow: glow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: label.length > 6 ? 9 : label.length > 4 ? 10 : 12,
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 700, color,
          textAlign: 'center', padding: 4,
          userSelect: 'none',
          transition: 'all 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform,
          animation,
          cursor: 'default', lineHeight: 1.2,
        }}>
          {label}
        </div>
      </div>
    </>
  );
}
