import { useRef, useState, useCallback } from 'react';
import Icon from '../ui/Icon';

const COLS = 12;
const MIN_W = 3;
const MAX_H = 14;
const MIN_H = 2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * 12-column dashboard grid. In edit mode every widget can be:
 *  - resized: drag the right edge (width), bottom edge (height) or corner (both)
 *  - reordered: drag the widget, or use the arrow buttons (works on touch / keyboard)
 *  - hidden: eye button
 * Rows are fixed-height units so widths/heights snap to a clean grid.
 */
export default function WidgetGrid({ items, onChange, editing, renderWidget, meta }) {
  const gridRef = useRef(null);
  const [live, setLive] = useState(null); // { id, w, h } while resizing
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const visible = items.filter((i) => i.enabled);

  const metrics = () => {
    const el = gridRef.current;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const gap = parseFloat(cs.columnGap) || 16;
    const rowH = parseFloat(cs.gridAutoRows) || 72;
    const colW = (el.clientWidth - gap * (COLS - 1)) / COLS;
    return { gap, rowH, colW };
  };

  const commit = useCallback(
    (id, patch) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    [items, onChange]
  );

  const startResize = (e, item, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const m = metrics();
    if (!m) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = item.w;
    const startH = item.h;
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);
    let current = { id: item.id, w: startW, h: startH };
    setLive(current);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let w = startW;
      let h = startH;
      if (dir !== 'bottom') w = clamp(Math.round(startW + dx / (m.colW + m.gap)), MIN_W, COLS);
      if (dir !== 'right') h = clamp(Math.round(startH + dy / (m.rowH + m.gap)), MIN_H, MAX_H);
      if (w !== current.w || h !== current.h) {
        current = { id: item.id, w, h };
        setLive(current);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setLive(null);
      if (current.w !== startW || current.h !== startH) commit(item.id, { w: current.w, h: current.h });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const move = (id, delta) => {
    const order = [...items];
    const visIdx = visible.findIndex((v) => v.id === id);
    const target = visible[visIdx + delta];
    if (!target) return;
    const a = order.findIndex((i) => i.id === id);
    const b = order.findIndex((i) => i.id === target.id);
    [order[a], order[b]] = [order[b], order[a]];
    onChange(order);
  };

  const dropBefore = (srcId, targetId) => {
    if (!srcId || srcId === targetId) return;
    const order = items.filter((i) => i.id !== srcId);
    const src = items.find((i) => i.id === srcId);
    const idx = order.findIndex((i) => i.id === targetId);
    order.splice(idx, 0, src);
    onChange(order);
  };

  const nudgeSize = (item, dw, dh) =>
    commit(item.id, { w: clamp(item.w + dw, MIN_W, COLS), h: clamp(item.h + dh, MIN_H, MAX_H) });

  return (
    <div ref={gridRef} className={`widget-grid ${editing ? 'editing' : ''}`}>
      {visible.map((item, idx) => {
        const size = live?.id === item.id ? live : item;
        const content = renderWidget(item.id, size);
        const label = meta[item.id]?.label || item.id;
        return (
          <div
            key={item.id}
            className={`widget-frame ${dragId === item.id ? 'dragging' : ''} ${overId === item.id && dragId !== item.id ? 'drop-target' : ''} ${live?.id === item.id ? 'resizing' : ''}`}
            style={{ gridColumn: `span ${size.w}`, gridRow: `span ${size.h}` }}
            onDragOver={(e) => {
              if (!editing || !dragId) return;
              e.preventDefault();
              if (overId !== item.id) setOverId(item.id);
            }}
            onDragLeave={() => overId === item.id && setOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              dropBefore(dragId || e.dataTransfer.getData('text/plain'), item.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            aria-label={label}
          >
            {editing && (
              <div className="widget-edit-bar" role="toolbar" aria-label={`${label} layout controls`}>
                <span
                  className="widget-drag-handle"
                  title="Drag to move"
                  draggable
                  onDragStart={(e) => {
                    setDragId(item.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.id);
                    const frame = e.currentTarget.closest('.widget-frame');
                    if (frame) e.dataTransfer.setDragImage(frame, 20, 20);
                  }}
                >
                  <Icon name="drag_indicator" size={18} />
                </span>
                <button type="button" title="Move earlier" aria-label={`Move ${label} earlier`} disabled={idx === 0} onClick={() => move(item.id, -1)}>
                  <Icon name="chevron_left" size={18} />
                </button>
                <button type="button" title="Move later" aria-label={`Move ${label} later`} disabled={idx === visible.length - 1} onClick={() => move(item.id, 1)}>
                  <Icon name="chevron_right" size={18} />
                </button>
                <button type="button" title="Narrower" aria-label={`Make ${label} narrower`} onClick={() => nudgeSize(item, -1, 0)}>
                  <Icon name="keyboard_arrow_left" size={18} />
                </button>
                <span className="widget-size-label">{size.w}×{size.h}</span>
                <button type="button" title="Wider" aria-label={`Make ${label} wider`} onClick={() => nudgeSize(item, 1, 0)}>
                  <Icon name="keyboard_arrow_right" size={18} />
                </button>
                <button type="button" title="Shorter" aria-label={`Make ${label} shorter`} onClick={() => nudgeSize(item, 0, -1)}>
                  <Icon name="keyboard_arrow_up" size={18} />
                </button>
                <button type="button" title="Taller" aria-label={`Make ${label} taller`} onClick={() => nudgeSize(item, 0, 1)}>
                  <Icon name="keyboard_arrow_down" size={18} />
                </button>
                <button type="button" title="Hide widget" aria-label={`Hide ${label}`} onClick={() => commit(item.id, { enabled: false })}>
                  <Icon name="visibility" size={18} />
                </button>
              </div>
            )}

            <div className="widget-body">
              {content || (
                <div className="widget-empty">
                  <Icon name={meta[item.id]?.icon || 'widgets'} size={28} />
                  <span>{meta[item.id]?.empty || `${label}: nothing to show yet`}</span>
                </div>
              )}
            </div>

            {editing && (
              <>
                <span className="widget-resize-handle right" onPointerDown={(e) => startResize(e, item, 'right')} title="Drag to change width" />
                <span className="widget-resize-handle bottom" onPointerDown={(e) => startResize(e, item, 'bottom')} title="Drag to change height" />
                <span className="widget-resize-handle corner" onPointerDown={(e) => startResize(e, item, 'corner')} title="Drag to resize" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
