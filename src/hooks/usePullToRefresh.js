import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 80;
const MAX_PULL = 130;

/**
 * Touch pull-to-refresh for the whole page. Only triggers when the user starts
 * pulling at the very top, outside any modal/drawer or inner scroll area.
 */
export default function usePullToRefresh(onRefresh, { enabled = true } = {}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullRef = useRef(0);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return undefined;

    const isAtTop = (el) => {
      if (document.scrollingElement && document.scrollingElement.scrollTop > 0) return false;
      let node = el;
      while (node && node !== document.body) {
        if (node.classList?.contains('modal-backdrop') || node.classList?.contains('drawer-backdrop')) return false;
        if (node.scrollTop > 0) return false;
        node = node.parentElement;
      }
      return true;
    };

    const onStart = (e) => {
      if (e.touches.length !== 1 || !isAtTop(e.target)) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };

    const onMove = (e) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const damped = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = damped;
      setPull(damped);
    };

    const onEnd = async () => {
      if (startY.current == null) return;
      const reached = pullRef.current >= THRESHOLD * 0.6;
      startY.current = null;
      pullRef.current = 0;
      if (!reached) {
        setPull(0);
        return;
      }
      setRefreshing(true);
      setPull(56);
      try {
        await refreshRef.current?.();
      } catch {
        /* errors are surfaced by the individual contexts */
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return { pull, refreshing };
}
