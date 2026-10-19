import { useId, type CSSProperties, type ReactElement } from "react";
import "../styles/scenes.css";

/* ════════════════════════════════════════════════════════════════════
   Hero artwork for the Home screen. Every scene is drawn on a 400×300 canvas and cropped with "slice",
   so it fills the hero on any screen. The lower half of each scene is kept dark so the headline stays readable.

   <Scene variant="dusk" live />
     · variant — which scene. "dusk" is the demo clip in the editor, so thumbnails always use it.
     · live    — turns on that scene's own ambient animation (see SCENE_CSS at the bottom). Thumbnails leave it off.
   SCENES — the list Home picks from on each app open. To add one: write a component below, register it in SCENE_ART,
            append its id to SCENES, and give its moving parts classes + keyframes in SCENE_CSS.
   Motion rules: transform / opacity only (cheap), nothing wider than the canvas moves sideways (no gaps at the edges),
   and everything is off under prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════════ */

interface ArtProps {
  u: string;
  live: boolean;
}

export interface SceneProps {
  variant?: string;
  live?: boolean;
  className?: string;
}

// Small seeded random generator so the trees / stars / particles are identical on every render.
function rng(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n: number) => Math.round(n * 10) / 10;

/* ───────────── dusk over a mountain lake ───────────── */
const DUSK_FAR =
  "0,176 0,128 40,112 70,134 110,100 150,130 190,108 240,138 290,104 330,128 372,110 400,126 400,176";
const DUSK_MID =
  "0,176 0,146 50,124 92,150 140,120 186,152 236,126 280,154 330,130 400,152 400,176";
const DUSK_NEAR = "0,176 0,160 60,152 120,164 190,155 260,166 330,156 400,164 400,176";
const BIRD = "M0 0q4 -4 8 0q4 -4 8 0";
const LAKE_GLINTS = [
  ["M30 196h70", 0],
  ["M210 204h96", -1.4],
  ["M120 222h60", -2.6],
  ["M280 236h80", -0.8],
  ["M60 252h90", -3.4],
];

function Dusk({ u, live }: ArtProps) {
  return (
    <>
      <defs>
        <linearGradient id={u + "s"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151c52" />
          <stop offset=".45" stopColor="#2b6f9c" />
          <stop offset=".6" stopColor="#f0a867" />
        </linearGradient>
        <linearGradient id={u + "l"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f7d92" />
          <stop offset="1" stopColor="#0d2a3f" />
        </linearGradient>
        <radialGradient id={u + "g"} cx=".68" cy=".58" r=".34">
          <stop offset="0" stopColor="#ffe2b0" stopOpacity=".95" />
          <stop offset="1" stopColor="#ffe2b0" stopOpacity="0" />
        </radialGradient>
        <clipPath id={u + "c"}>
          <rect x="0" y="176" width="400" height="124" />
        </clipPath>
      </defs>
      <rect width="400" height="176" fill={`url(#${u}s)`} />
      <rect className="sc-breathe" width="400" height="176" fill={`url(#${u}g)`} />
      <polygon points={DUSK_FAR} fill="#35507f" />
      <polygon points={DUSK_MID} fill="#223d63" />
      <polygon points={DUSK_NEAR} fill="#10243a" />
      <g fill="#f4f7fb" opacity=".92">
        <polygon points="110,100 102,114 108,111 112,116 118,112" />
        <polygon points="190,108 183,119 188,116 192,120 197,117" />
        <polygon points="290,104 282,118 288,115 292,120 299,116" />
      </g>
      {live && (
        <g
          className="sc-extra"
          fill="none"
          stroke="#0e1c33"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g className="sc-glide" style={{ animationDuration: "38s", animationDelay: "-14s" }}>
            <g transform="translate(0 84)">
              <path className="sc-bob" d={BIRD} />
            </g>
          </g>
          <g className="sc-glide" style={{ animationDuration: "52s", animationDelay: "-31s" }}>
            <g transform="translate(0 98) scale(.7)">
              <path className="sc-bob" style={{ animationDelay: "-.7s" }} d={BIRD} />
            </g>
          </g>
        </g>
      )}
      <rect y="176" width="400" height="124" fill={`url(#${u}l)`} />
      <g clipPath={`url(#${u}c)`} transform="translate(0,352) scale(1,-1)" opacity=".38">
        <polygon points={DUSK_FAR} fill="#35507f" />
        <polygon points={DUSK_MID} fill="#223d63" />
        <polygon points={DUSK_NEAR} fill="#10243a" />
      </g>
      <g stroke="#fff" strokeOpacity=".14" strokeWidth="1">
        {LAKE_GLINTS.map(([d, delay]) => (
          <path
            key={String(d)}
            className="sc-shim"
            d={String(d)}
            style={{ animationDelay: delay + "s" }}
          />
        ))}
      </g>
    </>
  );
}

/* ───────────── neon city at night ───────────── */
const CITY_FAR = [
  [0, 34, 60],
  [30, 28, 92],
  [56, 40, 70],
  [92, 26, 112],
  [116, 44, 78],
  [158, 30, 126],
  [186, 38, 84],
  [222, 28, 102],
  [248, 46, 66],
  [292, 30, 120],
  [320, 40, 80],
  [358, 42, 98],
];
const CITY_NEAR = [
  [8, 38, 46],
  [58, 30, 60],
  [96, 44, 40],
  [150, 34, 72],
  [198, 40, 50],
  [252, 36, 64],
  [300, 44, 42],
  [350, 50, 58],
];
const CITY_LIGHTS = (() => {
  const cols = ["#7ff3ff", "#ff7ac8", "#ffd27a"];
  const out: Array<[number, number, string]> = [];
  CITY_FAR.forEach(([x, w, h], bi) => {
    for (let wy = 176 - h + 8; wy < 168; wy += 9) {
      for (let wx = x + 5; wx < x + w - 5; wx += 8) {
        if ((wx * 7 + wy * 3 + bi) % 5 < 2) out.push([wx, wy, cols[(wx + wy + bi) % 3]]);
      }
    }
  });
  return out;
})();
const RAIN = (() => {
  const r = rng(5);
  return Array.from({ length: 16 }, () => [
    Math.round(r() * 430),
    r1(1.1 + r() * 0.7),
    r1(-r() * 2),
  ]);
})();

function CityShapes() {
  return (
    <>
      {CITY_FAR.map(([x, w, h]) => (
        <rect key={"f" + x} x={x} y={176 - h} width={w} height={h} fill="#2a1253" />
      ))}
      {CITY_NEAR.map(([x, w, h]) => (
        <rect key={"n" + x} x={x} y={176 - h} width={w} height={h} fill="#150a2e" />
      ))}
    </>
  );
}

function Neon({ u, live }: ArtProps) {
  return (
    <>
      <defs>
        <linearGradient id={u + "s"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c0524" />
          <stop offset=".5" stopColor="#4b1670" />
          <stop offset=".82" stopColor="#c4357f" />
          <stop offset="1" stopColor="#ff7a6b" />
        </linearGradient>
        <linearGradient id={u + "l"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a0f52" />
          <stop offset="1" stopColor="#07040f" />
        </linearGradient>
        <radialGradient id={u + "g"} cx=".5" cy=".95" r=".6">
          <stop offset="0" stopColor="#ff9ad0" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff9ad0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={u + "m"} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffe7f2" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffe7f2" stopOpacity="0" />
        </radialGradient>
        <clipPath id={u + "c"}>
          <rect x="0" y="176" width="400" height="124" />
        </clipPath>
      </defs>
      <rect width="400" height="176" fill={`url(#${u}s)`} />
      <rect width="400" height="176" fill={`url(#${u}g)`} />
      <circle className="sc-breathe" cx="292" cy="58" r="40" fill={`url(#${u}m)`} />
      <circle cx="292" cy="58" r="13" fill="#ffe7f2" opacity=".92" />
      <CityShapes />
      <g>
        {CITY_LIGHTS.map(([x, y, c], i) => {
          const blink = live && i % 6 === 0;
          return (
            <rect
              key={x + "-" + y}
              x={x}
              y={y}
              width="3"
              height="4"
              fill={c}
              opacity=".85"
              className={blink ? "sc-twinkle" : undefined}
              style={
                blink
                  ? {
                      animationDuration: r1(2.4 + (x % 7) * 0.45) + "s",
                      animationDelay: -r1(((x * 3 + y) % 20) / 3) + "s",
                    }
                  : undefined
              }
            />
          );
        })}
      </g>
      <rect className="sc-flicker" x="62" y="130" width="22" height="3" rx="1.5" fill="#ff4fa3" />
      <rect
        className="sc-flicker"
        style={{ animationDelay: "-2.2s", animationDuration: "6.5s" }}
        x="154"
        y="118"
        width="26"
        height="3"
        rx="1.5"
        fill="#33e6ff"
      />
      <rect
        className="sc-flicker"
        style={{ animationDelay: "-4.1s", animationDuration: "7.5s" }}
        x="304"
        y="140"
        width="30"
        height="3"
        rx="1.5"
        fill="#ffd27a"
      />
      <rect y="176" width="400" height="124" fill={`url(#${u}l)`} />
      <g clipPath={`url(#${u}c)`} transform="translate(0,352) scale(1,-1)" opacity=".28">
        <CityShapes />
      </g>
      <g strokeWidth="1.4" strokeLinecap="round">
        <path className="sc-pulse" d="M60 184v70" stroke="#ff7ac8" strokeOpacity=".28" />
        <path
          className="sc-pulse"
          style={{ animationDelay: "-1s" }}
          d="M118 186v52"
          stroke="#33e6ff"
          strokeOpacity=".22"
        />
        <path
          className="sc-pulse"
          style={{ animationDelay: "-2s" }}
          d="M168 184v84"
          stroke="#33e6ff"
          strokeOpacity=".26"
        />
        <path
          className="sc-pulse"
          style={{ animationDelay: "-3s" }}
          d="M232 186v60"
          stroke="#ff7ac8"
          strokeOpacity=".2"
        />
        <path
          className="sc-pulse"
          style={{ animationDelay: "-1.5s" }}
          d="M310 184v76"
          stroke="#ffd27a"
          strokeOpacity=".24"
        />
        <path
          className="sc-pulse"
          style={{ animationDelay: "-2.6s" }}
          d="M352 186v48"
          stroke="#ff7ac8"
          strokeOpacity=".22"
        />
      </g>
      {live && (
        <g
          className="sc-extra"
          stroke="#cfeaff"
          strokeOpacity=".3"
          strokeWidth="1"
          strokeLinecap="round"
        >
          {RAIN.map(([x, dur, delay], i) => (
            <path
              key={i}
              className="sc-rain"
              d={`M${x} 0l-3 10`}
              style={{ animationDuration: dur + "s", animationDelay: delay + "s" }}
            />
          ))}
        </g>
      )}
    </>
  );
}

/* ───────────── desert dunes at sunrise ───────────── */
const DUNE_1 = "M0 176C60 150 110 140 170 160S300 150 400 168";
const DUNE_2 = "M0 200C70 170 130 190 200 186S330 168 400 192";
const DUNE_3 = "M0 232C80 214 150 236 230 226S350 214 400 230";
const DUNE_4 = "M0 266C90 252 170 272 260 262S360 256 400 268";
const SAND = (() => {
  const r = rng(3);
  return Array.from({ length: 16 }, () => [
    Math.round(r() * 300) - 20,
    Math.round(150 + r() * 110),
    r1(5 + r() * 4),
    r1(-r() * 9),
  ]);
})();

function Dunes({ u, live }: ArtProps) {
  return (
    <>
      <defs>
        <linearGradient id={u + "s"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#271a52" />
          <stop offset=".5" stopColor="#8f3b78" />
          <stop offset=".8" stopColor="#ee7a68" />
          <stop offset="1" stopColor="#ffc27a" />
        </linearGradient>
        <radialGradient id={u + "g"} cx=".65" cy=".82" r=".4">
          <stop offset="0" stopColor="#ffe3a8" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffe3a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${u}s)`} />
      <rect className="sc-breathe" width="400" height="200" fill={`url(#${u}g)`} />
      <circle className="sc-rise" cx="262" cy="150" r="30" fill="#fff0c2" />
      <path d={DUNE_1 + "V300H0Z"} fill="#8a3a55" />
      <path d={DUNE_2 + "V300H0Z"} fill="#5a2748" />
      <path d={DUNE_3 + "V300H0Z"} fill="#341a3c" />
      <path d={DUNE_4 + "V300H0Z"} fill="#1c1030" />
      <g fill="none" strokeLinecap="round" stroke="#ffc27a">
        <path d={DUNE_1} strokeOpacity=".5" strokeWidth="1.2" />
        <path d={DUNE_2} strokeOpacity=".32" strokeWidth="1" />
        <path d={DUNE_3} strokeOpacity=".18" strokeWidth="1" />
      </g>
      {live && (
        <g className="sc-extra" fill="#ffd9a0">
          {SAND.map(([x, y, dur, delay], i) => (
            <circle
              key={i}
              className="sc-sand"
              cx={x}
              cy={y}
              r="0.9"
              style={{ animationDuration: dur + "s", animationDelay: delay + "s" }}
            />
          ))}
        </g>
      )}
    </>
  );
}

/* ───────────── aurora over snowy peaks ───────────── */
const STARS = (() => {
  const r = rng(7);
  return Array.from({ length: 46 }, () => [
    Math.round(r() * 400),
    Math.round(r() * 140),
    0.5 + r() * 0.9,
    0.35 + r() * 0.55,
  ]);
})();
const AU_FAR =
  "0,176 0,134 36,118 66,140 104,104 146,138 190,112 236,142 284,108 326,136 366,116 400,132 400,176";
const AU_NEAR = "0,176 0,158 56,150 120,162 196,153 262,164 336,154 400,162 400,176";
const AU_RIBBON_1 =
  "M-10 130C50 70 110 120 170 84S300 50 410 96V140C320 104 260 150 190 118S60 160 -10 150Z";
const AU_RIBBON_2 =
  "M-10 110C60 50 140 90 210 56S340 30 410 70V100C330 76 270 112 200 90S70 120 -10 128Z";

function AuroraShapes({ u }: { u: string }) {
  return (
    <>
      <path className="sc-wave2" d={AU_RIBBON_2} fill={`url(#${u}b)`} />
      <g className="sc-wave1">
        <path d={AU_RIBBON_1} fill={`url(#${u}a)`} />
        <path
          d="M-10 130C50 70 110 120 170 84S300 50 410 96"
          fill="none"
          stroke="#b8ffe6"
          strokeOpacity=".5"
          strokeWidth="1.2"
        />
      </g>
      <polygon points={AU_FAR} fill="#1b3a66" />
      <g fill="#eaf4ff" opacity=".9">
        <polygon points="104,104 96,118 102,115 106,120 113,116" />
        <polygon points="190,112 183,123 188,120 192,124 197,121" />
        <polygon points="284,108 276,122 282,119 286,124 293,120" />
      </g>
      <polygon points={AU_NEAR} fill="#081528" />
    </>
  );
}

function Aurora({ u, live }: ArtProps) {
  return (
    <>
      <defs>
        <linearGradient id={u + "s"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#040816" />
          <stop offset="1" stopColor="#0f3358" />
        </linearGradient>
        <linearGradient id={u + "a"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#43ffb8" stopOpacity="0" />
          <stop offset=".45" stopColor="#43ffb8" stopOpacity=".6" />
          <stop offset="1" stopColor="#43ffb8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={u + "b"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a6bff" stopOpacity="0" />
          <stop offset=".5" stopColor="#35e0d0" stopOpacity=".45" />
          <stop offset="1" stopColor="#35e0d0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={u + "l"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d2f4d" />
          <stop offset="1" stopColor="#050d1c" />
        </linearGradient>
        <clipPath id={u + "c"}>
          <rect x="0" y="176" width="400" height="124" />
        </clipPath>
      </defs>
      <rect width="400" height="176" fill={`url(#${u}s)`} />
      <g fill="#fff">
        {STARS.map(([x, y, r, o], i) => {
          const tw = live && i % 2 === 0;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              opacity={o}
              className={tw ? "sc-star" : undefined}
              style={
                tw
                  ? {
                      animationDuration: r1(2.2 + (i % 5) * 0.8) + "s",
                      animationDelay: -r1((i * 0.37) % 4) + "s",
                    }
                  : undefined
              }
            />
          );
        })}
      </g>
      {live && (
        <g className="sc-extra" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round">
          <path
            className="sc-shoot"
            style={{ animationDuration: "9s", animationDelay: "-2s" }}
            d="M300 16l-20 7"
          />
          <path
            className="sc-shoot"
            style={{ animationDuration: "13s", animationDelay: "-8s" }}
            d="M214 40l-18 6"
          />
        </g>
      )}
      <AuroraShapes u={u} />
      <rect y="176" width="400" height="124" fill={`url(#${u}l)`} />
      <g clipPath={`url(#${u}c)`} transform="translate(0,352) scale(1,-1)" opacity=".3">
        <AuroraShapes u={u} />
      </g>
      <g stroke="#fff" strokeOpacity=".1" strokeWidth="1">
        <path d="M40 200h80M220 210h100M110 230h70M270 244h90" />
      </g>
    </>
  );
}

/* ───────────── sunset over the sea ───────────── */
const SUN_STREAKS = [
  [178, 70, 0.55],
  [184, 62, 0.5],
  [191, 82, 0.46],
  [199, 56, 0.4],
  [208, 90, 0.34],
  [218, 60, 0.28],
  [230, 98, 0.2],
  [244, 66, 0.14],
];
const GLINTS = [
  [262, 184],
  [300, 188],
  [278, 196],
  [316, 204],
  [252, 212],
  [290, 222],
  [270, 236],
  [310, 246],
];

function Ocean({ u, live }: ArtProps) {
  return (
    <>
      <defs>
        <linearGradient id={u + "s"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16215e" />
          <stop offset=".45" stopColor="#6a3a8c" />
          <stop offset=".75" stopColor="#ff8f66" />
          <stop offset="1" stopColor="#ffd9a0" />
        </linearGradient>
        <linearGradient id={u + "l"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a85a7e" />
          <stop offset=".35" stopColor="#1c2a5a" />
          <stop offset="1" stopColor="#07122a" />
        </linearGradient>
        <radialGradient id={u + "g"} cx=".71" cy=".97" r=".42">
          <stop offset="0" stopColor="#fff0c0" stopOpacity=".85" />
          <stop offset="1" stopColor="#fff0c0" stopOpacity="0" />
        </radialGradient>
        <clipPath id={u + "c"}>
          <rect x="0" y="0" width="400" height="176" />
        </clipPath>
      </defs>
      <rect width="400" height="176" fill={`url(#${u}s)`} />
      <rect className="sc-breathe" width="400" height="176" fill={`url(#${u}g)`} />
      <g fill="#ffb0a0" opacity=".45">
        <ellipse
          className="sc-cloud"
          style={{ animationDuration: "18s" }}
          cx="90"
          cy="96"
          rx="60"
          ry="4"
        />
        <ellipse
          className="sc-cloud"
          style={{ animationDuration: "24s", animationDelay: "-9s" }}
          cx="300"
          cy="82"
          rx="70"
          ry="3.5"
        />
        <ellipse
          className="sc-cloud"
          style={{ animationDuration: "21s", animationDelay: "-15s" }}
          cx="236"
          cy="124"
          rx="50"
          ry="3"
        />
      </g>
      <g clipPath={`url(#${u}c)`}>
        <circle className="sc-sink" cx="285" cy="172" r="38" fill="#fff3d0" />
      </g>
      <polygon points="318,176 332,162 350,154 368,158 386,150 400,152 400,176" fill="#20184a" />
      <rect y="176" width="400" height="124" fill={`url(#${u}l)`} />
      <g fill="#ffdca8">
        {SUN_STREAKS.map(([y, w, o], i) => (
          <rect
            key={y}
            className="sc-shim"
            style={{ animationDelay: -r1(i * 0.7) + "s" }}
            x={285 - w / 2}
            y={y}
            width={w}
            height="2.2"
            rx="1.1"
            fillOpacity={o}
          />
        ))}
      </g>
      <g stroke="#fff" strokeOpacity=".1" strokeWidth="1">
        <path d="M30 200h60M120 216h50M40 240h80M170 258h70" />
      </g>
      {live && (
        <g className="sc-extra" fill="#fff6dc">
          {GLINTS.map(([x, y], i) => (
            <circle
              key={i}
              className="sc-star"
              cx={x}
              cy={y}
              r="1.1"
              style={{
                animationDuration: r1(1.8 + (i % 4) * 0.7) + "s",
                animationDelay: -r1(i * 0.6) + "s",
              }}
            />
          ))}
        </g>
      )}
    </>
  );
}

/* ───────────── pine forest in morning mist ───────────── */
function pineRow(
  seed: number,
  base: number,
  step: number,
  minH: number,
  maxH: number,
  wRatio: number,
) {
  const r = rng(seed);
  let d = "";
  for (let x = -6; x < 410; x += step) {
    const h = minH + r() * (maxH - minH);
    const w = h * wRatio;
    const top = base - h;
    const m = top + h * 0.5;
    const cx = r1(x + (r() - 0.5) * step * 0.6);
    d += `M${cx} ${r1(top)}L${r1(cx + w * 0.34)} ${r1(m)}L${r1(cx + w * 0.18)} ${r1(m)}L${r1(cx + w * 0.5)} ${base}L${r1(cx - w * 0.5)} ${base}L${r1(cx - w * 0.18)} ${r1(m)}L${r1(cx - w * 0.34)} ${r1(m)}Z`;
  }
  return d;
}
const PINES_FAR = pineRow(11, 176, 14, 34, 56, 0.42);
const PINES_MID = pineRow(23, 196, 18, 56, 88, 0.44);
const PINES_NEAR = pineRow(37, 232, 26, 90, 140, 0.46);
const FIREFLIES = (() => {
  const r = rng(9);
  return Array.from({ length: 9 }, () => [
    Math.round(30 + r() * 340),
    Math.round(190 + r() * 72),
    r1(6 + r() * 4),
    r1(-r() * 8),
  ]);
})();

function Pines({ u, live }: ArtProps) {
  return (
    <>
      <defs>
        <linearGradient id={u + "s"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f3d4a" />
          <stop offset=".55" stopColor="#3a9d8f" />
          <stop offset="1" stopColor="#e8f6c8" />
        </linearGradient>
        <radialGradient id={u + "g"} cx=".5" cy=".62" r=".45">
          <stop offset="0" stopColor="#fff6c8" stopOpacity=".85" />
          <stop offset="1" stopColor="#fff6c8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u + "m"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".26" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={u + "h"} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u + "r"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8d0" stopOpacity=".3" />
          <stop offset="1" stopColor="#fff8d0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${u}s)`} />
      <rect className="sc-breathe" width="400" height="200" fill={`url(#${u}g)`} />
      <path
        className="sc-sway"
        style={{ "--sw": "0.4deg", animationDuration: "7s" } as CSSProperties}
        d={PINES_FAR}
        fill="#2a7468"
        opacity=".85"
      />
      <rect y="150" width="400" height="50" fill={`url(#${u}m)`} />
      {live && (
        <g className="sc-extra" fill={`url(#${u}h)`}>
          <ellipse
            className="sc-mist"
            style={{ animationDuration: "17s" }}
            cx="110"
            cy="168"
            rx="120"
            ry="14"
          />
          <ellipse
            className="sc-mist"
            style={{ animationDuration: "21s", animationDelay: "-10s" }}
            cx="290"
            cy="158"
            rx="130"
            ry="12"
          />
        </g>
      )}
      <path
        className="sc-sway"
        style={
          { "--sw": "0.6deg", animationDuration: "6s", animationDelay: "-2s" } as CSSProperties
        }
        d={PINES_MID}
        fill="#14504a"
      />
      {live && (
        <g className="sc-extra" fill={`url(#${u}r)`}>
          <polygon className="sc-ray" points="190,118 204,118 118,236 52,236" />
          <polygon
            className="sc-ray"
            style={{ animationDelay: "-3s", animationDuration: "9s" }}
            points="198,118 208,118 218,236 168,236"
          />
          <polygon
            className="sc-ray"
            style={{ animationDelay: "-5s", animationDuration: "8s" }}
            points="204,118 214,118 330,236 262,236"
          />
        </g>
      )}
      <rect y="188" width="400" height="40" fill={`url(#${u}m)`} opacity=".7" />
      <path
        className="sc-sway"
        style={
          { "--sw": "0.8deg", animationDuration: "5.2s", animationDelay: "-1s" } as CSSProperties
        }
        d={PINES_NEAR}
        fill="#0a2a2c"
      />
      <rect y="228" width="400" height="72" fill="#061a1c" />
      {live && (
        <g className="sc-extra" fill="#f2ffb0">
          {FIREFLIES.map(([x, y, dur, delay], i) => (
            <circle
              key={i}
              className="sc-firefly"
              cx={x}
              cy={y}
              r="1.5"
              style={{ animationDuration: dur + "s", animationDelay: delay + "s" }}
            />
          ))}
        </g>
      )}
    </>
  );
}

/* ───────────── registry + component ───────────── */
const SCENE_ART: Record<string, (p: ArtProps) => ReactElement> = {
  dusk: Dusk,
  neon: Neon,
  dunes: Dunes,
  aurora: Aurora,
  ocean: Ocean,
  pines: Pines,
};

export const SCENES = ["dusk", "neon", "dunes", "aurora", "ocean", "pines"];

export function Scene({ variant = "dusk", live = false, className = "" }: SceneProps) {
  const u = "hm-" + useId().replace(/:/g, "");
  const Art = SCENE_ART[variant] || Dusk;
  const cls = "hm-scene" + (live ? " hm-live" : "") + (className ? " " + className : "");
  return (
    <svg
      className={cls}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <Art u={u} live={live} />
    </svg>
  );
}
