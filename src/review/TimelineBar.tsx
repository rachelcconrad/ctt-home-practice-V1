import type { TimelineSegment } from './timeline';

interface TimelineBarProps {
  rowLabel: string;
  segments: TimelineSegment[];
  durationMs: number;
  scrubberPercent: number | null;
  onSeek?: (fraction: number) => void;
}

export default function TimelineBar({ rowLabel, segments, durationMs, scrubberPercent, onSeek }: TimelineBarProps) {
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(fraction);
  }

  return (
    <div className="timeline-row">
      <span className="timeline-row-label">{rowLabel}</span>
      <div className="timeline-track" onClick={onSeek ? handleClick : undefined}>
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`timeline-segment voice-${seg.voice ?? 'none'}`}
            style={{
              left: `${(seg.startMs / durationMs) * 100}%`,
              width: `${((seg.endMs - seg.startMs) / durationMs) * 100}%`,
            }}
          />
        ))}
        {scrubberPercent !== null && <div className="timeline-scrubber" style={{ left: `${scrubberPercent}%` }} />}
      </div>
    </div>
  );
}
