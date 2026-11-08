import { useEffect, useRef, useState } from 'react';
import Avatar from './ui/Avatar';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Modal from './ui/Modal';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Modal that shows an avatar large and (when editable) lets the user reposition/zoom
// the image inside a circular frame. Uses CSS object-position/scale (no new deps).
export default function AvatarModal({ open, onClose, src, name, editable = false, onSave }) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState(null); // {sx,sy,ox,oy}
  const frameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPos({ x: 50, y: 50 });
      setZoom(1);
      setDrag(null);
    }
  }, [open, src]);

  // Max panning (px) from center for a given zoom. Matches scale() transform behavior.
  const maxPan = () => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const r = Math.min(rect.width, rect.height) / 2;
    const m = Math.max(0, (zoom - 1) * r);
    return { x: m, y: m };
  };

  const onPointerDown = (e) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y });
  };
  const onPointerMove = (e) => {
    if (!drag) return;
    const m = maxPan();
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    setPos({
      x: clamp(drag.ox + (m.x ? (dx / m.x) * 50 : 0), 0, 100),
      y: clamp(drag.oy + (m.y ? (dy / m.y) * 50 : 0), 0, 100),
    });
  };
  const onPointerUp = () => setDrag(null);

  const onZoomChange = (nextZoom) => {
    const z = Number(nextZoom);
    // When zooming out, keep position valid for the new (smaller) pan range.
    setZoom(z);
    if (z <= 1.001) setPos({ x: 50, y: 50 });
  };

  const resolved = typeof src === 'string' && src.trim() ? src.trim() : null;
  const m = editable ? maxPan() : { x: 0, y: 0 };
  const tx = ((pos.x - 50) / 50) * m.x;
  const ty = ((pos.y - 50) / 50) * m.y;

  return (
    <Modal open={open} onClose={onClose} title={name ? `${name}'s photo` : 'Profile photo'} className="max-w-lg">
      <div className="flex flex-col items-center gap-4">
        <div
          ref={frameRef}
          className={`relative h-72 w-72 overflow-hidden rounded-full bg-surface-container-low ring-1 ring-line touch-none ${editable ? (drag ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {resolved ? (
            <img
              src={resolved}
              alt={name ? `${name} avatar` : 'Avatar'}
              className="h-full w-full select-none"
              style={{
                objectFit: 'cover',
                transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
                transformOrigin: 'center',
                willChange: 'transform',
              }}
              draggable={false}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Avatar name={name} src={null} className="h-72 w-72 text-[64px]" />
            </div>
          )}
        </div>

        {editable && resolved && (
          <div className="w-full max-w-sm">
            <label className="mb-1 flex items-center justify-between text-label-sm text-secondary">
              <span className="flex items-center gap-1"><Icon name="zoom_in" className="text-[16px]" /> Zoom</span>
              <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
            </label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => onZoomChange(e.target.value)}
              className="w-full accent-primary"
            />
            <p className="mt-1 text-center text-caption text-secondary">
              {zoom > 1.01 ? 'Drag the photo to move it inside the circle.' : 'Zoom in, then drag to reposition.'}
            </p>
          </div>
        )}

        <div className="flex w-full justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {editable && resolved && onSave && (
            <Button onClick={() => onSave({ x: pos.x, y: pos.y, zoom })}>Apply framing</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

