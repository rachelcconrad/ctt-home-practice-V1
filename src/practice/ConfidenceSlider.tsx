import { useRef, useState } from 'react';

interface ConfidenceSliderProps {
  ariaLabel: string;
  // Called once, with a 0-100 value, when the patient lets go. Never displayed.
  onCommit: (value: number) => void;
}

const KEY_STEP = 5;

// Thumbs-down (0) to thumbs-up (100) slider that takes ONE rating: touch or
// drag, and the rating is locked in on release. The thumb stays visible at the
// chosen spot; the parent remounts the slider (via `key`) when the practice
// period changes. Starts unanswered, as a faint outline.
export default function ConfidenceSlider({ ariaLabel, onCommit }: ConfidenceSliderProps) {
  const [value, setValue] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function valueFromPointer(e: React.PointerEvent): number {
    const rect = trackRef.current!.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return Math.round(fraction * 100);
  }

  function commit(next: number) {
    setValue(next);
    setLocked(true);
    onCommit(next);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setValue(valueFromPointer(e));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current) setValue(valueFromPointer(e));
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    commit(valueFromPointer(e));
  }

  // Keyboard: arrows move, Enter/Space locks in the rating.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (locked) return;
    const current = value ?? 50;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setValue(Math.min(100, current + KEY_STEP));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setValue(Math.max(0, current - KEY_STEP));
    else if (e.key === 'Home') setValue(0);
    else if (e.key === 'End') setValue(100);
    else if ((e.key === 'Enter' || e.key === ' ') && value !== null) commit(value);
    else return;
    e.preventDefault();
  }

  return (
    <div
      ref={trackRef}
      className={`confidence-slider${locked ? ' locked' : ''}`}
      role="slider"
      tabIndex={locked ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-readonly={locked}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      <div className="confidence-rail" />
      <div
        className={`confidence-thumb${value === null ? ' untouched' : ''}`}
        style={{ left: `${value ?? 50}%` }}
      />
    </div>
  );
}
