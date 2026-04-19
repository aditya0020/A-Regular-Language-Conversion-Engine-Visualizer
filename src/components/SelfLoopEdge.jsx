import { EdgeLabelRenderer } from '@xyflow/react';

/**
 * SelfLoopEdge — smooth self-loop arc with arrowhead.
 *
 * React Flow clips edge SVGs to a bounding box around source/target handles.
 * For self-loops both handles coincide, so the clip box is ~0px and most of
 * the SVG geometry gets culled.
 *
 * Solution: render everything via EdgeLabelRenderer (HTML layer, no clipping)
 * using a position:absolute inline SVG that covers the full loop region.
 */
export default function SelfLoopEdge({ sourceX, sourceY, targetX, targetY, data, style }) {
  // ── Geometry ───────────────────────────────────────────────────────
  const NODE_RADIUS = 32;
  const LOOP_HEIGHT = 88;
  const SPREAD      = 36;

  const cx   = (sourceX + targetX) / 2;
  const topY = Math.min(sourceY, targetY);   // top handle y (canvas coords)
  const cnY  = topY + NODE_RADIUS;           // node centre y

  const ANGLE_DEG  = 35;
  const ANGLE_RAD  = (ANGLE_DEG * Math.PI) / 180;
  const rimX_left  = cx  - NODE_RADIUS * Math.sin(ANGLE_RAD);
  const rimY_left  = cnY - NODE_RADIUS * Math.cos(ANGLE_RAD);
  const rimX_right = cx  + NODE_RADIUS * Math.sin(ANGLE_RAD);
  const rimY_right = cnY - NODE_RADIUS * Math.cos(ANGLE_RAD);

  const peakY = cnY - NODE_RADIUS - LOOP_HEIGHT;

  const cp1x = rimX_left  - SPREAD;
  const cp1y = peakY + 8;
  const cp2x = rimX_right + SPREAD;
  const cp2y = peakY + 8;

  // ── Arrowhead ─────────────────────────────────────────────────────
  // End tangent: direction from last control point → endpoint
  const tx  = rimX_right - cp2x;
  const ty  = rimY_right - cp2y;
  const len = Math.sqrt(tx * tx + ty * ty) || 1;
  const ux  = tx / len;
  const uy  = ty / len;
  const px  = -uy;   // perpendicular
  const py  =  ux;

  const ARROW_LEN  = 14;
  const ARROW_HALF = 7;

  // Tip sits exactly on the rim; base is pulled back along the incoming tangent
  const tipX  = rimX_right;
  const tipY  = rimY_right;
  const baseX = tipX - ux * ARROW_LEN;
  const baseY = tipY - uy * ARROW_LEN;

  // ── SVG viewport that fits the whole loop ────────────────────────
  // We need a viewport large enough to contain the arc + arrowhead.
  const PAD  = 20;   // padding around bounding box
  const svgLeft   = cx - NODE_RADIUS - SPREAD - PAD;
  const svgTop    = peakY - PAD;
  const svgRight  = cx + NODE_RADIUS + SPREAD + PAD;
  const svgBottom = rimY_right + PAD;
  const svgW = svgRight - svgLeft;
  const svgH = svgBottom - svgTop;

  // Local coords inside the SVG (subtract top-left corner)
  const lx = (v) => v - svgLeft;
  const ly = (v) => v - svgTop;

  const dLocal = [
    `M ${lx(rimX_left)} ${ly(rimY_left)}`,
    `C ${lx(cp1x)} ${ly(cp1y)}`,
    `  ${lx(cp2x)} ${ly(cp2y)}`,
    `  ${lx(rimX_right)} ${ly(rimY_right)}`,
  ].join(' ');

  const arrowLocal = [
    `${lx(tipX)},${ly(tipY)}`,
    `${lx(baseX + px * ARROW_HALF)},${ly(baseY + py * ARROW_HALF)}`,
    `${lx(baseX - px * ARROW_HALF)},${ly(baseY - py * ARROW_HALF)}`,
  ].join(' ');

  const labelX = cx;
  const labelY = peakY + 2;

  // ── Styling ────────────────────────────────────────────────────────
  const stroke       = style?.stroke || '#6e56cf';
  const strokeWidth  = style?.strokeWidth || 2;
  const isHighlighted = data?.isHighlighted;
  const isTraversing  = data?.isTraversing;
  const traverseKey   = data?.traverseKey ?? 0;

  const labelBg    = data?.labelBg    || 'rgba(7,22,40,0.93)';
  const labelColor = data?.labelColor || '#e0f6ff';

  const arrowFill = isTraversing ? '#00e676' : stroke;
  const arcStroke = isTraversing ? '#00e676' : stroke;
  const arcDash   = isHighlighted ? '4 2' : '6 3';

  return (
    <EdgeLabelRenderer>
      {/* ── Full arc SVG (bypasses React Flow's clip box) ── */}
      <svg
        width={svgW}
        height={svgH}
        style={{
          position: 'absolute',
          left: svgLeft,
          top: svgTop,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        {/* Outer glow */}
        <path d={dLocal} fill="none" stroke={stroke}
          strokeWidth={strokeWidth + 6} strokeOpacity={0.10}
          style={{ filter: 'blur(5px)' }} />

        {/* Inner glow */}
        <path d={dLocal} fill="none" stroke={stroke}
          strokeWidth={strokeWidth + 2} strokeOpacity={0.20}
          style={{ filter: 'blur(2px)' }} />

        {/* Main arc — dashed animated */}
        <path
          d={dLocal}
          fill="none"
          stroke={arcStroke}
          strokeWidth={strokeWidth}
          strokeDasharray={arcDash}
          style={{
            animation: isHighlighted
              ? 'edgeFlowFast 0.5s linear infinite'
              : 'edgeFlow 1.2s linear infinite',
            transition: 'stroke 0.3s ease',
          }}
        />

        {/* Traversal flash */}
        {/* Traversal spark: gold halo + bright core */}
        {isTraversing && (
          <>
            {/* Glow halo */}
            <path
              key={`${traverseKey}-glow`}
              d={dLocal} fill="none"
              stroke="#00e676"
              strokeWidth={strokeWidth + 10}
              strokeLinecap="round"
              style={{
                strokeDasharray: 800, strokeDashoffset: 800,
                animation: 'edgeTraverse 0.45s cubic-bezier(0.4,0,0.2,1) forwards',
                opacity: 0.25, filter: 'blur(6px)',
              }}
            />
            {/* Bright core */}
            <path
              key={`${traverseKey}-core`}
              d={dLocal} fill="none"
              stroke="#e8fff2"
              strokeWidth={strokeWidth + 2}
              strokeLinecap="round"
              style={{
                strokeDasharray: 800, strokeDashoffset: 800,
                animation: 'edgeTraverse 0.45s cubic-bezier(0.4,0,0.2,1) forwards',
                filter: 'drop-shadow(0 0 6px #00e676cc) drop-shadow(0 0 14px #00e67677)',
              }}
            />
          </>
        )}

        {/* Arrowhead */}
        <polygon
          points={arrowLocal}
          fill={arrowFill}
          stroke="rgba(6,9,15,0.7)"
          strokeWidth={1}
          style={{
            transition: 'fill 0.3s ease',
            filter: isTraversing ? 'drop-shadow(0 0 4px #ffb800aa)' : undefined,
          }}
        />
      </svg>

      {/* ── Label badge ── */}
      {data?.label && (
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: isTraversing ? 'rgba(40,28,0,0.96)' : labelBg,
            border: `1px solid ${isTraversing ? '#ffb80088' : stroke + '44'}`,
            padding: '2px 9px',
            borderRadius: 6,
            fontSize: 11,
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 700,
            color: isTraversing ? '#ffb800' : labelColor,
            pointerEvents: 'all',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(10px)',
            boxShadow: isTraversing
              ? '0 0 12px #ffb80077'
              : `0 2px 12px ${stroke}22, 0 0 0 1px ${stroke}11`,
            transition: 'color 0.3s, box-shadow 0.3s, border-color 0.3s, background 0.3s',
            letterSpacing: '0.03em',
          }}
        >
          {data.label}
        </div>
      )}
    </EdgeLabelRenderer>
  );
}
