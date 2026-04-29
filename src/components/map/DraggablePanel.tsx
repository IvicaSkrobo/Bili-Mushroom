import { type ReactNode, useEffect, useState } from 'react';

interface DraggablePanelProps {
  children: (props: { dragHandleProps: { onPointerDown: (event: React.PointerEvent) => void } }) => ReactNode;
  initialPosition: { x: number; y: number };
  className?: string;
  storageKey?: string;
}

export function DraggablePanel({
  children,
  initialPosition,
  className = '',
  storageKey,
}: DraggablePanelProps) {
  const [position, setPosition] = useState(() => {
    if (!storageKey) return initialPosition;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return initialPosition;
    try {
      return { ...initialPosition, ...JSON.parse(saved) };
    } catch {
      return initialPosition;
    }
  });
  const [drag, setDrag] = useState<null | { dx: number; dy: number }>(null);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(position));
  }, [position, storageKey]);

  useEffect(() => {
    if (!drag) return undefined;
    function onPointerMove(event: PointerEvent) {
      const maxX = Math.max(8, window.innerWidth - 96);
      const maxY = Math.max(8, window.innerHeight - 96);
      setPosition({
        x: Math.min(Math.max(8, event.clientX - drag.dx), maxX),
        y: Math.min(Math.max(8, event.clientY - drag.dy), maxY),
      });
    }
    function onPointerUp() {
      setDrag(null);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [drag]);

  return (
    <div
      className={className}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {children({
        dragHandleProps: {
          onPointerDown: (event) => {
            event.preventDefault();
            setDrag({
              dx: event.clientX - position.x,
              dy: event.clientY - position.y,
            });
          },
        },
      })}
    </div>
  );
}
