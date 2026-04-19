import { useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from './CustomNode';
import SelfLoopEdge from './SelfLoopEdge';
import BezierEdge from './BezierEdge';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { selfloop: SelfLoopEdge, bezierEdge: BezierEdge };

/**
 * Flow — uses React Flow's internal node/edge state so drag positions persist.
 * External `nodes` prop drives the graph structure (labels, highlight colours, etc.)
 * but position changes made by dragging are kept in local state and NOT overwritten
 * on every parent re-render.  Positions only reset when the set of node IDs changes
 * (i.e. a new automaton stage is loaded onto the canvas).
 */
function Flow({ nodes: externalNodes, edges: externalEdges }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(externalNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(externalEdges);
  const { fitView } = useReactFlow();

  // Track the last set of node IDs so we know when the graph structure changes
  const prevNodeIdsRef = useRef('');

  useEffect(() => {
    const currentIds = externalNodes.map(n => n.id).sort().join(',');

    if (currentIds !== prevNodeIdsRef.current) {
      // New graph: reset both nodes and positions, then fit view
      prevNodeIdsRef.current = currentIds;
      setNodes(externalNodes);
      setEdges(externalEdges);
      // Small delay so the DOM has settled before fitting
      setTimeout(() => fitView({ padding: 0.4, maxZoom: 1.4, duration: 300 }), 50);
    } else {
      // Same graph (e.g. highlight colour changed from simulation). Merge the
      // updated data into existing nodes so drag positions are preserved.
      setNodes(prev =>
        prev.map(n => {
          const updated = externalNodes.find(e => e.id === n.id);
          return updated ? { ...n, data: updated.data } : n;
        })
      );
      setEdges(externalEdges);
    }
  }, [externalNodes, externalEdges]);

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
        <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <p className="text-sm font-mono">No states to display</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.4, maxZoom: 1.4 }}
      minZoom={0.15}
      maxZoom={4}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
      zoomOnScroll={true}
      zoomOnPinch={true}
      panOnScroll={false}
      panOnDrag={true}
      defaultEdgeOptions={{ type: 'bezierEdge' }}
      nodeOrigin={[0.5, 0.5]}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="#21262d"
      />
      <Controls
        position="bottom-left"
        showInteractive={false}
        showFitView={true}
        style={{ bottom: 16, left: 16 }}
      />
      <MiniMap
        nodeColor={n => {
          if (n.data.isRejected)     return '#ff4444';
          if (n.data.isRejectedPath) return '#cc3333';
          if (n.data.isHighlighted)  return '#00e676';
          if (n.data.isPath)         return '#00c870';
          if (n.data.isDead)         return '#21262d';
          return '#6e56cf';
        }}
        maskColor="#06090faa"
        position="bottom-right"
        style={{ bottom: 16, right: 16, height: 90, width: 130 }}
      />
    </ReactFlow>
  );
}

export default function GraphView({ nodes, edges }) {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <Flow nodes={nodes} edges={edges} />
      </div>
    </ReactFlowProvider>
  );
}
