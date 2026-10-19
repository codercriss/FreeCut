import type { ReactElement } from "react";
import { lcg } from "../../util/random";

/* ───────────── generated footage (no remote images) ───────────── */
const TREE_COLORS = ["#1b4430", "#235a3a", "#173a2a", "#2b6a44"];

const MORAINE = (() => {
  const R = lcg(42);
  const ridge: Array<[number, number]> = [
    [0, 125],
    [0, 12],
    [20, 2],
    [44, 14],
    [58, 6],
    [88, 34],
    [100, 26],
    [118, 4],
    [146, 38],
    [158, 22],
    [172, 8],
    [196, 44],
    [212, 30],
    [236, 14],
    [262, 52],
    [276, 40],
    [304, 62],
    [322, 54],
    [352, 70],
    [376, 62],
    [400, 74],
    [400, 125],
  ];
  const shade: string[] = [];
  const light: string[] = [];
  const snow: string[] = [];
  const streaks: number[][] = [];
  for (let i = 1; i < ridge.length - 1; i++) {
    const [px, py] = ridge[i];
    const [bx, by] = ridge[i - 1];
    const [nx, ny] = ridge[i + 1];
    if (!(py < by && py < ny && by < 125 && ny < 125)) continue;
    const d = 10 + (125 - py) * 0.08; // taller peaks carry deeper snow caps
    shade.push(`${px},${py} ${nx},${ny} ${nx},${ny + 58} ${px + (nx - px) * 0.3},${py + 84}`);
    light.push(`${px},${py} ${bx},${by} ${bx},${by + 46} ${px - (px - bx) * 0.4},${py + 70}`);
    const w1 = 7 + R() * 5;
    const w2 = 7 + R() * 5;
    snow.push(
      `${px},${py - 0.5} ${px + w2},${py + d + R() * 6} ${px + w2 * 0.5},${py + d * 0.8} ${px + 2},${py + d * 1.5 + R() * 5} ${px - 2},${py + d * 0.85} ${px - w1 * 0.6},${py + d * 1.3 + R() * 5} ${px - w1},${py + d}`,
    );
    for (let k = 0; k < 3; k++) {
      const sx = px + (R() * 12 - 6);
      streaks.push([sx, py + d, sx + (R() * 14 - 7), py + 36 + R() * 32]);
    }
  }
  const lineY = (x: number) => 112 - ((x - 140) / 260) * 34;
  const trees: Array<{ x: number; top: number; h: number; w: number; c: string }> = [];
  for (let x = 140; x <= 404; x += 3.1) {
    const top = lineY(x) - 2 + R() * 5;
    const h = 12 + R() * 6;
    const w = 3.4 + R() * 1.6;
    trees.push({ x, top, h, w, c: TREE_COLORS[Math.floor(R() * 4)] });
  }
  for (let x = -2; x < 142; x += 3.4) {
    const top = 109 + R() * 4;
    const h = 125 - top + 1;
    const w = 3.2 + R() * 1.4;
    trees.push({ x, top, h, w, c: TREE_COLORS[Math.floor(R() * 4)] });
  }
  const ripples: number[][] = [];
  for (let i = 0; i < 24; i++) {
    const y = 129 + i * 5 + R() * 2;
    const x1 = R() * 360;
    ripples.push([x1, y, x1 + 22 + R() * 60, 0.06 + R() * 0.1]);
  }
  return {
    ridgePts: ridge.map((p) => p.join(",")).join(" "),
    shade,
    light,
    snow,
    streaks,
    trees,
    ripples,
    forestBase: `140,125 140,${lineY(140) + 8} 400,${lineY(400) + 6} 400,125`,
  };
})();

const smallTrees = (
  seed: number,
  x0: number,
  x1: number,
  yTop: number,
  yBase: number,
  colors: string[],
) => {
  const R = lcg(seed);
  const out: ReactElement[] = [];
  for (let x = x0; x < x1; x += 4 + R() * 2) {
    const top = yTop - R() * 5;
    const w = 2.4 + R() * 1.6;
    out.push(
      <polygon
        key={`${seed}-${x}`}
        points={`${x},${top} ${x - w},${yBase} ${x + w},${yBase}`}
        fill={colors[Math.floor(R() * colors.length)]}
      />,
    );
  }
  return out;
};

export function SceneDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="ve-g-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a86c2" />
          <stop offset="1" stopColor="#a9d3ec" />
        </linearGradient>
        <linearGradient id="ve-g-rock" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8c7f74" />
          <stop offset=".55" stopColor="#7b7873" />
          <stop offset="1" stopColor="#6f7a8a" />
        </linearGradient>
        <linearGradient id="ve-g-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcebf5" stopOpacity="0" />
          <stop offset="1" stopColor="#dcebf5" stopOpacity=".32" />
        </linearGradient>
        <linearGradient id="ve-g-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4cc9d8" />
          <stop offset=".4" stopColor="#2a9fbf" />
          <stop offset="1" stopColor="#1b6f98" />
        </linearGradient>
        <linearGradient id="ve-g-tint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1eaac8" stopOpacity=".26" />
          <stop offset="1" stopColor="#08467a" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id="ve-g-cave" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3036" />
          <stop offset=".55" stopColor="#808b93" />
          <stop offset="1" stopColor="#20262b" />
        </linearGradient>
        <radialGradient id="ve-g-glow">
          <stop offset="0" stopColor="#f1ece0" stopOpacity=".5" />
          <stop offset="1" stopColor="#f1ece0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ve-g-sea" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#dff5f5" />
          <stop offset=".2" stopColor="#7fd3de" />
          <stop offset=".42" stopColor="#2fb2d3" />
          <stop offset=".7" stopColor="#1b78b4" />
          <stop offset="1" stopColor="#124a8c" />
        </linearGradient>
        <linearGradient id="ve-g-bay-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d95d3" />
          <stop offset="1" stopColor="#c2e3f4" />
        </linearGradient>
        <linearGradient id="ve-g-bay-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3aa3c2" />
          <stop offset="1" stopColor="#1f7fa8" />
        </linearGradient>
        <linearGradient id="ve-g-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a6b0ae" />
          <stop offset="1" stopColor="#d9dfdc" />
        </linearGradient>
        <linearGradient id="ve-g-mistband" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="ve-soft" x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation=".8" />
        </filter>

        {/* Moraine Lake — top half (mirrored for the reflection) */}
        <g id="ve-moraine-top">
          <rect width="400" height="125" fill="url(#ve-g-sky)" />
          <polygon
            points="250,125 250,70 280,56 310,66 340,48 370,60 400,44 400,125"
            fill="#8ea4bd"
            opacity=".55"
          />
          <polygon points={MORAINE.ridgePts} fill="url(#ve-g-rock)" />
          <polygon points="0,125 0,12 20,2 44,14 58,6 72,32 64,125" fill="#4f3f36" opacity=".38" />
          {MORAINE.shade.map((p, i) => (
            <polygon key={`sh${i}`} points={p} fill="#1c1722" opacity=".26" />
          ))}
          {MORAINE.light.map((p, i) => (
            <polygon key={`li${i}`} points={p} fill="#fff1dc" opacity=".12" />
          ))}
          {MORAINE.snow.map((p, i) => (
            <polygon key={`sn${i}`} points={p} fill="#f5f8fb" opacity=".93" />
          ))}
          {MORAINE.streaks.map(([x1, y1, x2, y2], i) => (
            <line
              key={`st${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#fff"
              strokeOpacity=".5"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          ))}
          <polygon
            points="0,125 0,82 40,66 80,86 130,62 180,88 230,68 290,94 350,76 400,92 400,125"
            fill="#5d6061"
            opacity=".6"
          />
          <rect y="62" width="400" height="63" fill="url(#ve-g-haze)" />
          <polygon points={MORAINE.forestBase} fill="#1d4630" />
          {MORAINE.trees.map((t, i) => (
            <polygon
              key={`tr${i}`}
              points={`${t.x},${t.top} ${t.x - t.w},${t.top + t.h} ${t.x + t.w},${t.top + t.h}`}
              fill={t.c}
            />
          ))}
          <rect y="121" width="400" height="4" fill="#11291d" />
        </g>
      </defs>

      {/* 1 ─ Moraine Lake (player + timeline frames) */}
      <symbol id="ve-sc-moraine" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
        <rect y="125" width="400" height="125" fill="url(#ve-g-lake)" />
        <use href="#ve-moraine-top" />
        <use
          href="#ve-moraine-top"
          transform="translate(0 250) scale(1 -1)"
          opacity=".8"
          filter="url(#ve-soft)"
        />
        <rect y="125" width="400" height="125" fill="url(#ve-g-tint)" />
        {MORAINE.ripples.map(([x1, y, x2, o], i) => (
          <line
            key={i}
            x1={x1}
            y1={y}
            x2={x2}
            y2={y}
            stroke="#fff"
            strokeOpacity={o}
            strokeWidth=".7"
            strokeLinecap="round"
          />
        ))}
      </symbol>

      {/* 1b ─ cheap variant for filmstrip frames */}
      <symbol id="ve-sc-moraine-lite" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
        <rect y="125" width="400" height="125" fill="url(#ve-g-lake)" />
        <use href="#ve-moraine-top" />
        <use href="#ve-moraine-top" transform="translate(0 250) scale(1 -1)" opacity=".8" />
        <rect y="125" width="400" height="125" fill="url(#ve-g-tint)" />
      </symbol>

      {/* 2 ─ dark rock arch */}
      <symbol id="ve-sc-cave" viewBox="0 0 200 135" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="135" fill="url(#ve-g-cave)" />
        <circle cx="112" cy="70" r="44" fill="url(#ve-g-glow)" opacity=".7" />
        <polygon points="58,106 88,66 100,77 118,54 138,76 150,68 184,106" fill="#7d8991" />
        <polygon points="88,64 94,75 83,71" fill="#eef2f5" />
        <polygon points="118,50 124,62 113,59" fill="#eef2f5" />
        <polygon points="150,66 155,73 145,72" fill="#eef2f5" />
        <polygon points="58,106 184,106 184,135 58,135" fill="#3b4248" opacity=".85" />
        <polygon points="0,0 78,0 66,22 52,40 44,62 30,84 20,112 0,135" fill="#14171a" />
        <polygon points="78,0 200,0 200,24 168,34 140,22 110,31 86,20" fill="#191c1f" />
        <polygon points="200,38 184,52 176,78 188,100 200,135" fill="#1d2125" />
        <polygon points="0,135 30,110 70,119 120,113 170,121 200,109 200,135" fill="#0f1113" />
        <polyline
          points="78,0 66,22 52,40 44,62 30,84"
          fill="none"
          stroke="#3a4046"
          strokeWidth="1"
        />
      </symbol>

      {/* 3 ─ aerial ocean, portrait strip */}
      <symbol id="ve-sc-ocean" viewBox="0 0 200 135" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="135" fill="#000" />
        <svg x="64" y="0" width="74" height="135" viewBox="0 0 74 135" preserveAspectRatio="none">
          <rect width="74" height="135" fill="url(#ve-g-sea)" />
          <polygon points="0,0 30,0 18,14 0,28" fill="#cdbb9e" />
          {[18, 44, 72, 100, 124].map((y, i) => (
            <g key={i}>
              <path
                d={`M0 ${y} C14 ${y - 8} 22 ${y + 12} 40 ${y + 4} S66 ${y + 8} 74 ${y}`}
                fill="none"
                stroke="#fff"
                strokeOpacity=".55"
                strokeWidth="3"
              />
              <path
                d={`M0 ${y + 6} C14 ${y - 2} 22 ${y + 18} 40 ${y + 10} S66 ${y + 14} 74 ${y + 6}`}
                fill="none"
                stroke="#fff"
                strokeOpacity=".3"
                strokeWidth="1.2"
              />
            </g>
          ))}
        </svg>
      </symbol>

      {/* 4 ─ forest bay */}
      <symbol id="ve-sc-bay" viewBox="0 0 200 135" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="62" fill="url(#ve-g-bay-sky)" />
        <ellipse cx="34" cy="18" rx="24" ry="5.5" fill="#fff" opacity=".55" />
        <ellipse cx="120" cy="12" rx="32" ry="5" fill="#fff" opacity=".5" />
        <polygon
          points="0,64 0,38 20,26 34,40 52,20 74,42 96,30 120,48 150,34 176,46 200,36 200,64"
          fill="#7b8fa6"
        />
        <polygon points="52,20 57,29 47,28" fill="#fff" opacity=".9" />
        <polygon points="20,26 24,33 16,32" fill="#fff" opacity=".9" />
        <rect y="62" width="200" height="73" fill="url(#ve-g-bay-water)" />
        <polygon points="26,100 60,86 96,82 128,88 142,100 120,106 60,108" fill="#1d4a2c" />
        {smallTrees(11, 30, 140, 90, 104, ["#173f26", "#245a35", "#1d4a2c"])}
        <polygon points="0,82 40,88 62,110 38,135 0,135" fill="#2a5b34" />
        {smallTrees(23, 2, 56, 94, 118, ["#1d4a2c", "#2d6a3c"])}
        <polygon points="200,98 160,104 150,120 170,135 200,135" fill="#3a6b3a" />
        <ellipse cx="112" cy="124" rx="42" ry="8" fill="#7ae6e0" opacity=".45" />
      </symbol>

      {/* 5 ─ misty ridges */}
      <symbol id="ve-sc-mist" viewBox="0 0 200 135" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="135" fill="url(#ve-g-mist)" />
        <polygon
          points="0,82 30,56 60,70 90,40 130,66 170,50 200,64 200,135 0,135"
          fill="#8e9c98"
          opacity=".85"
        />
        <rect y="68" width="200" height="26" fill="url(#ve-g-mistband)" />
        <polygon
          points="0,102 40,78 80,98 120,72 160,94 200,82 200,135 0,135"
          fill="#5f7168"
          opacity=".9"
        />
        {smallTrees(5, 0, 200, 98, 112, ["#44574d", "#394b42"])}
        <ellipse cx="60" cy="30" rx="40" ry="8" fill="#fff" opacity=".35" />
        <ellipse cx="150" cy="22" rx="36" ry="7" fill="#fff" opacity=".3" />
      </symbol>
    </svg>
  );
}

export const Scene = ({ id }: { id: string }) => (
  <svg width="100%" height="100%" style={{ display: "block" }} aria-hidden="true">
    <use href={`#${id}`} width="100%" height="100%" />
  </svg>
);
