import type uPlot from 'uplot';

export function attachChartScrubbing(chart: uPlot, onSelect: (index: number) => void): () => void {
  const target = chart.over;
  const previousTouchAction = target.style.touchAction;
  let pointerId: number | null = null;
  target.style.touchAction = 'pan-y';

  const select = (event: PointerEvent) => {
    const bounds = target.getBoundingClientRect();
    chart.setCursor({
      left: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      top: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    });
    if (chart.cursor.idx != null && chart.cursor.idx >= 0) onSelect(chart.cursor.idx);
  };
  const start = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary) return;
    pointerId = event.pointerId;
    target.setPointerCapture(pointerId);
    select(event);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId === pointerId || event.pointerType === 'mouse') select(event);
  };
  const end = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
  };

  target.addEventListener('pointerdown', start);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
  return () => {
    target.style.touchAction = previousTouchAction;
    target.removeEventListener('pointerdown', start);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
  };
}
