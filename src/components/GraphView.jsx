import { useEffect, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import BezierEdge from './BezierEdge';
import CustomNode from './CustomNode';
import SelfLoopEdge from './SelfLoopEdge';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { selfloop: SelfLoopEdge, bezierEdge: BezierEdge };

function Flow({ nodes: externalNodes, edges: externalEdges }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(externalNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(externalEdges);
  const { fitView } = useReactFlow();
  const prevNodeIdsRef = useRef('');

  useEffect(() => {
    const currentIds = externalNodes.map((node) => node.id).sort().join(',');

    if (currentIds !== prevNodeIdsRef.current) {
      prevNodeIdsRef.current = currentIds;
      setNodes(externalNodes);
      setEdges(externalEdges);
      setTimeout(() => fitView({ padding: 0.4, maxZoom: 1.4, duration: 300 }), 50);
      return;
    }

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const updated = externalNodes.find((candidate) => candidate.id === node.id);
        return updated ? { ...node, data: updated.data } : node;
      })
    );
    setEdges(externalEdges);
  }, [externalEdges, externalNodes, fitView, setEdges, setNodes]);

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
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      zoomOnScroll
      zoomOnPinch
      panOnScroll={false}
      panOnDrag
      defaultEdgeOptions={{ type: 'bezierEdge' }}
      nodeOrigin={[0.5, 0.5]}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#21262d" />
      <Controls position="bottom-left" showInteractive={false} showFitView style={{ bottom: 16, left: 16 }} />
      <MiniMap
        nodeColor={(node) => {
          if (node.data.isRejected) return '#ff4444';
          if (node.data.isRejectedPath) return '#cc3333';
          if (node.data.isHighlighted) return '#00e676';
          if (node.data.isPath) return '#00c870';
          if (node.data.isDead) return '#21262d';
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
