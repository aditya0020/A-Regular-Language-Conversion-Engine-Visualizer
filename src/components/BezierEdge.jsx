import { EdgeLabelRenderer } from '@xyflow/react';

/**
 * BezierEdge — quadratic Bézier between nodes.
 * sourceX/Y and targetX/Y come from React Flow's handles which are
 * already placed at the node border, so we use them directly.
 */
export default function BezierEdge({ id, sourceX, sourceY, targetX, targetY, data, markerEnd, style }) {
  const dx   = targetX - sourceX;
  const dy   = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Normal vector (perpendicular to edge direction) for curvature bulge
  const nx = -dy / dist;
  const ny =  dx / dist;

  const curvature = data?.curvature ?? 0.15;
  const offset    = dist * curvature;

  // Control point: midpoint shifted by curvature along the normal
  const cx = (sourceX + targetX) / 2 + nx * offset;
  const cy = (sourceY + targetY) / 2 + ny * offset;

  // Path goes directly from handle to handle (handles are at node rim)
  const path   = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;

  // Label sits at the quadratic Bézier midpoint
  const labelX = (sourceX + 2 * cx + targetX) / 4;
  const labelY = (sourceY + 2 * cy + targetY) / 4;

  const isHighlighted = data?.isHighlighted;
  const isTraversing  = data?.isTraversing;
  const traverseKey   = data?.traverseKey ?? 0;
  const edgeClass     = isHighlighted ? 'edge-animated-highlight' : 'edge-animated';
  const stroke        = style?.stroke || '#4d7aff';

  return (
    <>
      {/* Glow layer */}
      <path d={path} fill="none" stroke={stroke}
        strokeWidth={(style?.strokeWidth || 2) + 4}
        strokeOpacity={0.12} style={{ filter: 'blur(4px)' }} />

      {/* Main edge */}
      <path id={id} className={`react-flow__edge-path ${edgeClass}`} d={path}
        fill="none" markerEnd={markerEnd}
        style={{ ...style, transition: 'stroke 0.3s ease, stroke-width 0.3s ease' }} />

      {/* Traversal spark: bright gold beam that shoots along the edge */}
      {isTraversing && (
        <>
          {/* Wide glow halo */}
          <path
            key={`${traverseKey}-glow`}
            d={path} fill="none"
            stroke="#00e676"
            strokeWidth={(style?.strokeWidth || 2) + 10}
            strokeLinecap="round"
            style={{
              strokeDasharray: 1200, strokeDashoffset: 1200,
              animation: 'edgeTraverse 0.45s cubic-bezier(0.4,0,0.2,1) forwards',
              opacity: 0.25,
              filter: 'blur(6px)',
            }}
          />
          {/* Bright core */}
          <path
            key={`${traverseKey}-core`}
            d={path} fill="none"
            stroke="#e8fff2"
            strokeWidth={(style?.strokeWidth || 2) + 2}
            strokeLinecap="round"
            markerEnd={markerEnd}
            style={{
              strokeDasharray: 1200, strokeDashoffset: 1200,
              animation: 'edgeTraverse 0.45s cubic-bezier(0.4,0,0.2,1) forwards',
              filter: 'drop-shadow(0 0 6px #00e676cc) drop-shadow(0 0 14px #00e67677)',
            }}
          />
        </>
      )}

      {/* Label */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan" style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: data?.labelBg || 'rgba(18,18,26,0.92)',
            border: `1px solid ${isTraversing ? '#ffb80066' : stroke + '33'}`,
            padding: '3px 8px', borderRadius: 6,
            fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 600, color: isTraversing ? '#ffb800' : (data?.labelColor || '#d0d0e0'),
            pointerEvents: 'all', whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
            boxShadow: isTraversing ? '0 0 10px #ffb80066' : `0 0 8px ${stroke}22`,
            transition: 'color 0.3s, box-shadow 0.3s, border-color 0.3s',
          }}>
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
