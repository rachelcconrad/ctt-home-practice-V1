export interface PaintBlob {
  key: string;
  // 0-100, or null when there is no data (nothing is drawn).
  percent: number | null;
  color: string;
  // Short text drawn under the percentage, inside the blob.
  label: string;
  // Rough starting direction for this blob (top-left, top-right, ...).
  dir: [number, number];
  seed: number;
}

// Radius of a 100% blob, in layout units (the frame is fitted to the layout,
// so this number only sets the scale the math works in).
const R_FULL = 100;
// How far a blob may reach toward a neighbor: the centers are kept at least
// (bigger radius + OVERLAP_K * smaller radius) apart. The smaller blob's
// middle (where its text sits) is therefore never covered — the blobs only
// overlap at their edges.
const OVERLAP_K = 0.8;

// Width (not area) is proportional to the percent: a 50% blob is half as wide
// as a 100% blob.
export function radiusFor(percent: number): number {
  return Math.max(6, (R_FULL * Math.min(100, Math.max(0, percent))) / 100);
}

interface Placed {
  blob: PaintBlob;
  cx: number;
  cy: number;
  r: number;
}

// Spread the blobs so every pair keeps its minimum distance (so they only
// overlap at the edges), then pull them gently together so the group stays
// compact. Deterministic: same data, same picture.
export function layoutBlobs(blobs: PaintBlob[]): Placed[] {
  const items = blobs
    .filter((b): b is PaintBlob & { percent: number } => b.percent !== null)
    .map((b) => ({ blob: b, r: radiusFor(b.percent), x: b.dir[0] * R_FULL * 1.2, y: b.dir[1] * R_FULL * 1.2 }));

  const separate = () => {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const want = Math.max(a.r, b.r) + OVERLAP_K * Math.min(a.r, b.r);
        if (dist < want) {
          const push = (want - dist) / 2;
          a.x -= (dx / dist) * push;
          a.y -= (dy / dist) * push;
          b.x += (dx / dist) * push;
          b.y += (dy / dist) * push;
        }
      }
    }
  };

  for (let iter = 0; iter < 300; iter++) {
    separate();
    const mx = items.reduce((sum, it) => sum + it.x, 0) / items.length;
    const my = items.reduce((sum, it) => sum + it.y, 0) / items.length;
    for (const it of items) {
      it.x += (mx - it.x) * 0.03;
      it.y += (my - it.y) * 0.03;
    }
  }
  // Final passes with no pull, so the spacing rule holds exactly.
  for (let iter = 0; iter < 200; iter++) separate();

  return items.map((it) => ({ blob: it.blob, cx: it.x, cy: it.y, r: it.r }));
}

// A soft, slightly irregular rounded-square outline (the CTT logo shapes),
// built as a smooth closed curve through 8 jittered points.
function blobPath(cx: number, cy: number, r: number, seed: number): string {
  const N = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + seed * 0.4;
    const squareness = 1 - 0.04 * Math.cos(4 * (a - seed * 0.4));
    const jitter = 1 + 0.028 * Math.sin(i * 2.3 + seed * 1.7);
    const rad = r * squareness * jitter;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + ' Z';
}

// Greedy word wrap by estimated character width, so labels stay inside their
// own blob instead of the blob being resized to fit its label.
function wrapLabel(text: string, maxWidth: number, fontSize: number): string[] {
  const maxChars = Math.max(5, Math.floor(maxWidth / (fontSize * 0.55)));
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    if (current && `${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function PaintCluster({ blobs }: { blobs: PaintBlob[] }) {
  const placed = layoutBlobs(blobs);
  if (placed.length === 0) return null;

  // Fit the frame to the group so the shapes are as large as the screen allows.
  const pad = 10;
  const minX = Math.min(...placed.map((p) => p.cx - p.r * 1.08)) - pad;
  const maxX = Math.max(...placed.map((p) => p.cx + p.r * 1.08)) + pad;
  const minY = Math.min(...placed.map((p) => p.cy - p.r * 1.08)) - pad;
  const maxY = Math.max(...placed.map((p) => p.cy + p.r * 1.08)) + pad;

  return (
    <svg
      className="paint-cluster"
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      role="img"
      aria-label="Your daily percentages"
    >
      {[false, true].map((textLayer) =>
        placed.map((p, i) => (
          <g key={`${p.blob.key}-${textLayer}`} className="bloom" style={{ animationDelay: `${i * 140}ms` }}>
            {textLayer ? (
              <BlobText cx={p.cx} cy={p.cy} r={p.r} percent={p.blob.percent as number} label={p.blob.label} />
            ) : (
              <path d={blobPath(p.cx, p.cy, p.r, p.blob.seed)} fill={p.blob.color} fillOpacity={0.88} />
            )}
          </g>
        )),
      )}
    </svg>
  );
}

function BlobText({ cx, cy, r, percent, label }: { cx: number; cy: number; r: number; percent: number; label: string }) {
  const numberSize = Math.max(14, r * 0.36);
  const labelSize = Math.max(10, r * 0.14);
  const lines = wrapLabel(label, r * 1.15, labelSize);
  const lineHeight = labelSize * 1.2;
  const blockHeight = numberSize + 4 + lines.length * lineHeight;
  const top = cy - blockHeight / 2;
  return (
    <>
      <text
        x={cx}
        y={top + numberSize / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={numberSize}
        className="paint-number"
      >
        {percent}%
      </text>
      {lines.map((line, k) => (
        <text
          key={k}
          x={cx}
          y={top + numberSize + 4 + (k + 0.5) * lineHeight}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={labelSize}
          className="paint-label"
        >
          {line}
        </text>
      ))}
    </>
  );
}
