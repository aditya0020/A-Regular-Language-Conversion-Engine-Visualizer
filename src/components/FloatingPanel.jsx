import { useCallback, useEffect, useRef, useState } from 'react';

export default function FloatingPanel({
  title,
  icon,
  onClose,
  children,
  defaultPosition = { x: 120, y: 120 },
  width = 380,
  height = 460,
}) {
  const panelRef = useRef(null);
  const dragState = useRef(null);
  const [pos, setPos] = useState(defaultPosition);

  const onMouseMove = useCallback((event) => {
    if (!dragState.current) return;

    const nextX = event.clientX - dragState.current.startX;
    const nextY = event.clientY - dragState.current.startY;
    const panel = panelRef.current;

    if (!panel) {
      setPos({ x: nextX, y: nextY });
      return;
    }

    const maxX = window.innerWidth - panel.offsetWidth - 8;
    const maxY = window.innerHeight - panel.offsetHeight - 8;
    setPos({
      x: Math.max(8, Math.min(nextX, maxX)),
      y: Math.max(8, Math.min(nextY, maxY)),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragState.current = null;
    window.removeEventListener('mousemove', onMouseMove);
  }, [onMouseMove]);

  const onMouseDown = useCallback(
    (event) => {
      if (event.button !== 0) return;

      dragState.current = {
        startX: event.clientX - pos.x,
        startY: event.clientY - pos.y,
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp, { once: true });
      event.preventDefault();
    },
    [onMouseMove, onMouseUp, pos.x, pos.y]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <div ref={panelRef} className="floating-panel" style={{ left: pos.x, top: pos.y, width, height }}>
      <div
        className="floating-panel-handle flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: 'rgba(48,54,61,0.7)',
          background: 'rgba(22,27,34,0.6)',
        }}
        onMouseDown={onMouseDown}
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-base opacity-80">{icon}</span>}
          <span
            className="text-sm font-semibold text-slate-100 select-none"
            style={{ fontFamily: '"Inter", sans-serif', letterSpacing: '-0.01em' }}
          >
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onClose}
            title="Close"
            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors flex items-center justify-center group"
            style={{ boxShadow: '0 0 4px rgba(255,68,68,0.4)' }}
          >
            <span className="opacity-0 group-hover:opacity-100 text-red-900 text-[8px] font-bold leading-none">×</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
