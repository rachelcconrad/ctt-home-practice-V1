import type { TimelineSegment } from './timeline';

interface TimelineBarProps {
  rowLabel: string;
  segments: TimelineSegment[];
  durationMs: number;
}

// Read-only colored bar. Only used for sessions recorded before the
// confidence slider, to show their voice-button "Felt" timeline.
export default function TimelineBar({ rowLabel, segments, durationMs }: TimelineBarProps) {
  return (
    <div className="timeline-row">
      <span className="timeline-row-label">{rowLabel}</span>
      <div className="timeline-track">
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
      </div>
    </div>
  );
}
