import { MarkerType } from '@xyflow/react';

// ── BFS hierarchical layout ───────────────────────────────────────────────────
/**
 * Returns { [stateId]: { x, y, col } }
 * `col` is stored so edge-routing logic can compare columns.
 */
function bfsLayout(states, start, getNeighbors) {
  const colMap  = new Map();
  const visited = new Set([start]);
  const queue   = [[start, 0]];
  colMap.set(start, 0);

  while (queue.length) {
    const [state, col] = queue.shift();
    getNeighbors(state).forEach(n => {
      if (!visited.has(n)) {
        visited.add(n);
        colMap.set(n, col + 1);
        queue.push([n, col + 1]);
      }
    });
  }

  // Disconnected states go one column past the rightmost reachable
  let maxCol = Math.max(0, ...Array.from(colMap.values()));
  states.forEach(s => {
    if (!visited.has(s)) {
      colMap.set(s, ++maxCol);
      visited.add(s);
    }
  });

  const columns = {};
  states.forEach(s => {
    const col = colMap.get(s);
    if (!columns[col]) columns[col] = [];
    columns[col].push(s);
  });

  const X_GAP = 230;
  const Y_GAP = 145;
  const positions = {};

  Object.entries(columns).forEach(([col, list]) => {
    list.sort(); // deterministic vertical order
    list.forEach((state, i) => {
      positions[state] = {
        col: parseInt(col),
        x:   parseInt(col) * X_GAP + 80,
        y:   (i - (list.length - 1) / 2) * Y_GAP + 240,
      };
    });
  });

  return positions;
}

// ── Edge map helpers ──────────────────────────────────────────────────────────
function buildEdgeMap(states, getTransitions) {
  const edgeMap = {};
  states.forEach(from => {
    getTransitions(from).forEach(({ to, label }) => {
      const key = `${from}|||${to}`;
      if (!edgeMap[key]) edgeMap[key] = { from, to, labels: [] };
      if (!edgeMap[key].labels.includes(label)) edgeMap[key].labels.push(label);
    });
  });
  return edgeMap;
}

function findBidirectional(edgeMap) {
  const bidi = new Set();
  Object.keys(edgeMap).forEach(key => {
    const { from, to } = edgeMap[key];
    if (from !== to && edgeMap[`${to}|||${from}`]) bidi.add(key);
  });
  return bidi;
}

// ── Colour palette ───────────────────────────────────────────────────────────
const COLORS = {
  nfa:       { stroke: '#38bdf8', label: '#e0f6ff', labelBg: 'rgba(7,22,40,0.93)',  markerColor: '#38bdf8' },
  dfa:       { stroke: '#38bdf8', label: '#e0f6ff', labelBg: 'rgba(7,22,40,0.93)',  markerColor: '#38bdf8' },
  highlight: { stroke: '#00e676', markerColor: '#00e676' },
  path:      { stroke: '#00c870', markerColor: '#00c870' },
};

// ══════════════════════════════════════════════════════════════════════════════
// Smart Port Mapping
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Decide which handles to use based on the geometric relationship of two nodes.
 *
 * Rules (matching the handles declared in CustomNode.jsx):
 *
 *   Self-loop      → source:'top'       target:'top-in'
 *                    Forces loop arc to stay ABOVE the node — always visible.
 *
 *   Forward edge   → source:'right'     target:'left'
 *   (src.x < tgt.x)  Clean left-to-right flow. No overlap with node body.
 *
 *   Back-edge      → source:'bottom'    target:'bottom-in'
 *   (src.x > tgt.x)  Arc travels BELOW the row — underpass, no occlusion.
 *
 *   Same column    → source for top/bottom based on y relationship:
 *   (src.x ≈ tgt.x)   src above tgt → source:'bottom' target:'bottom-in'
 *                      src below tgt → source:'top'    target:'top-in'
 *
 * Bidirectional pair (A↔B):
 *   The A→B edge keeps the rules above. B→A is detected as a back-edge and
 *   routes via bottom handles → the two arcs naturally separate.
 *
 * @returns { sourceHandle, targetHandle, curvature }
 */
function resolveHandles(from, to, positions, isBidi) {
  if (from === to) {
    // Self-loop: straight up out of 'top', back into 'top-in'
    return { sourceHandle: 'top', targetHandle: 'top-in', curvature: 0 };
  }

  const fp = positions[from] || { x: 0, y: 0, col: 0 };
  const tp = positions[to]   || { x: 0, y: 0, col: 0 };

  const dx = tp.x - fp.x;
  const dy = tp.y - fp.y;
  const THRESH = 60; // pixel tolerance for "same column"

  if (Math.abs(dx) < THRESH) {
    // Vertically stacked — use top/bottom based on which is above
    if (dy < 0) {
      // target is above source
      return { sourceHandle: 'top', targetHandle: 'bottom-in', curvature: 0.35 };
    } else {
      // target is below source
      return { sourceHandle: 'bottom', targetHandle: 'top-in', curvature: 0.35 };
    }
  }

  if (dx > 0) {
    // ── Forward edge: exits right, enters left ────────────────────────────
    // Bidirectional forward: arc upward (positive curvature)
    // Single forward:        gentle arc (smaller curvature)
    const colDiff   = (tp.col || 0) - (fp.col || 0);
    const curvature = isBidi
      ? 0.28
      : colDiff > 1
        ? 0.30 + colDiff * 0.04
        : 0.15;
    return { sourceHandle: 'right', targetHandle: 'left', curvature };
  }

  // ── Back-edge: exits bottom, enters bottom ────────────────────────────
  // Arc swings below the row, clearly separated from forward edges
  const colDiff   = (fp.col || 0) - (tp.col || 0);  // always positive
  const curvature = isBidi
    ? -0.28                                            // mirror of forward
    : -(0.35 + colDiff * 0.05);                       // deeper arc for long jumps
  return { sourceHandle: 'bottom', targetHandle: 'bottom-in', curvature };
}

// ── Marker end with correct refX so arrowhead sits at the handle ─────────────
function makeMarker(color) {
  return {
    type:   MarkerType.ArrowClosed,
    color,
    width:  14,
    height: 14,
    // refX 0 means the tip of the arrowhead is exactly at the path endpoint
    // (which is already on the node rim thanks to the named handle)
    refX: 0,
    refY: 0,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// NFA → ReactFlow data
// ══════════════════════════════════════════════════════════════════════════════
export function nfaToFlowData(nfa) {
  const { states, alphabet, start, accept, transitions, epsilon } = nfa;

  const getNeighbors = s => {
    const ns = new Set();
    alphabet.forEach(sym => (transitions[s]?.[sym] || []).forEach(t => ns.add(t)));
    (epsilon[s] || []).forEach(t => ns.add(t));
    return [...ns];
  };

  const positions = bfsLayout(states, start, getNeighbors);

  const getTransitions = from => {
    const result = [];
    alphabet.forEach(sym =>
      (transitions[from]?.[sym] || []).forEach(to => result.push({ to, label: sym }))
    );
    (epsilon[from] || []).forEach(to => result.push({ to, label: 'ε' }));
    return result;
  };

  const edgeMap = buildEdgeMap(states, getTransitions);
  const bidi    = findBidirectional(edgeMap);
  const c       = COLORS.nfa;

  const nodes = states.map(state => ({
    id:       state,
    type:     'custom',
    position: { x: positions[state]?.x || 80, y: positions[state]?.y || 240 },
    data: {
      label:         state,
      isAccept:      accept.includes(state),
      isStart:       state === start,
      isHighlighted: false,
      isPath:        false,
      isDead:        false,
    },
  }));

  const edges = Object.entries(edgeMap).map(([key, { from, to, labels }]) => {
    const isSelf = from === to;
    const isBidiEdge = bidi.has(key);
    const { sourceHandle, targetHandle, curvature } =
      resolveHandles(from, to, positions, isBidiEdge);

    return {
      id:     `nfa-${key}`,
      source: from,
      target: to,
      sourceHandle,
      targetHandle,
      type:   isSelf ? 'selfloop' : 'bezierEdge',
      data: {
        label:      labels.join(', '),
        curvature,
        labelColor: c.label,
        labelBg:    c.labelBg,
      },
      style:     { stroke: c.stroke, strokeWidth: 2 },
      markerEnd: makeMarker(c.markerColor),
    };
  });

  return { nodes, edges };
}

// ══════════════════════════════════════════════════════════════════════════════
// DFA → ReactFlow data
// ══════════════════════════════════════════════════════════════════════════════
export function dfaToFlowData(dfa, highlightedNodes = [], pathNodes = [], activeEdge = null, simRejected = false) {
  const { states, transitions, start, accept } = dfa;

  const getNeighbors = s => [...new Set(Object.values(transitions[s] || {}))];
  const positions    = bfsLayout(states, start, getNeighbors);

  const getTransitions = from =>
    Object.entries(transitions[from] || {}).map(([label, to]) => ({ to, label }));

  const edgeMap = buildEdgeMap(states, getTransitions);
  const bidi    = findBidirectional(edgeMap);

  // Dynamic palette: green while running, red on reject
  const SIM = simRejected
    ? { hl: '#ff4444', hlMap: '#cc2222', path: '#cc2222', pathMap: '#aa1111' }
    : { hl: '#00e676', hlMap: '#00e676', path: '#00c870', pathMap: '#00c870' };

  const nodes = states.map(state => ({
    id:       state,
    type:     'custom',
    position: { x: positions[state]?.x || 80, y: positions[state]?.y || 240 },
    data: {
      label:         state === '∅' ? '∅' : `{${state}}`,
      isAccept:      accept.includes(state),
      isStart:       state === start,
      isHighlighted: highlightedNodes.includes(state),
      isPath:        pathNodes.includes(state),
      isDead:        state === '∅',
      isRejected:    simRejected && highlightedNodes.includes(state),
      isRejectedPath: simRejected && pathNodes.includes(state),
    },
  }));

  const edges = Object.entries(edgeMap).map(([key, { from, to, labels }]) => {
    const isSelf        = from === to;
    const isBidiEdge    = bidi.has(key);
    const isHighlighted = highlightedNodes.includes(from) && highlightedNodes.includes(to);
    const isOnPath      = pathNodes.includes(from) && pathNodes.includes(to);
    const isTraversing  = !!activeEdge && activeEdge.from === from && activeEdge.to === to;

    const stroke = isOnPath      ? SIM.path
                 : isHighlighted ? SIM.hl
                 :                 COLORS.dfa.stroke;

    const markerColor = isOnPath      ? SIM.pathMap
                      : isHighlighted ? SIM.hlMap
                      :                 COLORS.dfa.markerColor;

    const width = isHighlighted || isOnPath || isTraversing ? 3 : 2;

    const { sourceHandle, targetHandle, curvature } =
      resolveHandles(from, to, positions, isBidiEdge);

    return {
      id:     `dfa-${key}`,
      source: from,
      target: to,
      sourceHandle,
      targetHandle,
      type:   isSelf ? 'selfloop' : 'bezierEdge',
      data: {
        label:       labels.join(', '),
        curvature,
        isHighlighted: isHighlighted || isOnPath,
        isTraversing,
        traverseKey:   isTraversing ? activeEdge.key : 0,
        labelColor:    COLORS.dfa.label,
        labelBg:       COLORS.dfa.labelBg,
        simRejected,
      },
      style:     { stroke, strokeWidth: width },
      markerEnd: makeMarker(markerColor),
    };
  });

  return { nodes, edges };
}