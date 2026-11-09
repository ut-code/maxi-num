import { useEffect, useRef } from "react";

// タイトル画面の背景。四角形と、演算で値が変わる数字が上から流れる（互いに重ならない）

// 四角形：各レーンに2つずつ、周期の半分ずらして置き、途切れずに流れるようにする
const CYCLE = 20;
const SQUARE_TOP = -220;
const LANES = [
  { size: 60, left: 6, offset: 0, opacity: 0.1 },
  { size: 140, left: 19, offset: 6, opacity: 0.12 },
  { size: 85, left: 32, offset: 2, opacity: 0.11 },
  { size: 45, left: 45, offset: 8, opacity: 0.1 },
  { size: 120, left: 56, offset: 4, opacity: 0.12 },
  { size: 70, left: 68, offset: 7, opacity: 0.11 },
  { size: 150, left: 80, offset: 1, opacity: 0.13 },
  { size: 55, left: 92, offset: 5, opacity: 0.09 },
];
const SQUARES = LANES.flatMap((lane) => [
  { ...lane, phase: lane.offset },
  { ...lane, phase: lane.offset + CYCLE / 2 },
]);

// 数字：画面内の最大個数・値が変わる間隔・はじまりの数の上限
const NUMBER_COUNT = 24;
const TICK_MS = 800;
const START_MAX = 99;
// 四角形の速さに対する倍率。数字ごとにランダムに選ぶ
const SPEEDS = [0.55, 1, 1.6];
// 他の要素とのすき間と、1つの数字が使える横幅の範囲（px）
const MARGIN = 6;
const MAX_BOX_W = 150;
const MIN_BOX_W = 36;
const SPAWN_Y = -40;
const SAMPLE_DT = 0.05;
const FONT = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';

function divisorCount(n: number) {
  let count = 0;
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) count += i * i === n ? 1 : 2;
  }
  return count;
}

// 今の値に関係なく重み付きランダムで選ぶ。大きくなりすぎたら変化を止める
const OPS = [
  { weight: 0.45, apply: (n: number) => n * 2 },
  { weight: 0.35, apply: (n: number) => n * 3 },
  { weight: 0.2, apply: divisorCount },
];

function step(n: number) {
  if (n > 1e9) return n;
  let r = Math.random();
  for (const op of OPS) {
    if ((r -= op.weight) < 0) return op.apply(n);
  }
  return n;
}

type FallingNumber = {
  x0: number;
  x1: number;
  y: number;
  h: number;
  v: number;
  base: number;
  value: number;
  alpha: number;
  acc: number;
};

export type FallingBackgroundProps = {
  // false にすると数字を流さず、四角形だけを流すようにする
  showNumbers?: boolean;
};

export function FallingBackground({ showNumbers = true }: FallingBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let time = 0;
    let items: FallingNumber[] = [];
    const numberCount = showNumbers ? NUMBER_COUNT : 0;
    const travel = () => height + 350;
    const squareSpeed = () => travel() / CYCLE;
    const squareY = (phase: number, t: number) => {
      const progress = ((((t + phase) / CYCLE) % 1) + 1) % 1;
      return SQUARE_TOP + progress * travel();
    };

    // 速さの違う数字が後で追いつかないよう、消えるまでの軌道を先読みして判定する
    function pathIsClear(c: Pick<FallingNumber, "x0" | "x1" | "y" | "h" | "v">) {
      const overlapsX = (x0: number, x1: number) => x1 + MARGIN > c.x0 && x0 - MARGIN < c.x1;
      const squares = SQUARES.filter((s) => {
        const x = (s.left / 100) * width;
        return overlapsX(x, x + s.size);
      });
      const others = items.filter((o) => overlapsX(o.x0, o.x1));
      for (let t = 0; ; t += SAMPLE_DT) {
        const cy = c.y + c.v * t;
        if (cy > height * 1.05) return true;
        const y0 = cy - c.h / 2 - MARGIN;
        const y1 = cy + c.h / 2 + MARGIN;
        for (const s of squares) {
          const sy = squareY(s.phase, time + t);
          if (sy + s.size > y0 && sy < y1) return false;
        }
        for (const o of others) {
          const oy = o.y + o.v * t;
          if (oy + o.h / 2 > y0 && oy - o.h / 2 < y1) return false;
        }
      }
    }

    function trySpawn(y: number) {
      const base = 14 + Math.random() * 14;
      const h = base * 1.3;
      const v = squareSpeed() * SPEEDS[Math.floor(Math.random() * SPEEDS.length)];
      const cx = Math.random() * width;
      // 広い枠から順に試し、置ける最大の幅を確保する
      for (let w = MAX_BOX_W; w >= MIN_BOX_W; w -= 24) {
        const box = {
          x0: Math.max(0, cx - w / 2),
          x1: Math.min(width, cx + w / 2),
          y,
          h,
          v,
        };
        if (box.x1 - box.x0 >= MIN_BOX_W && pathIsClear(box)) {
          items.push({
            ...box,
            base,
            value: 1 + Math.floor(Math.random() * START_MAX),
            alpha: 0.18 + Math.random() * 0.14,
            acc: Math.random() * TICK_MS,
          });
          return;
        }
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      items = [];
      for (let i = 0; i < 400 && items.length < numberCount; i++) {
        trySpawn(Math.random() * height);
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      ctx!.fillStyle = "#9ca3af";
      for (const s of SQUARES) {
        ctx!.globalAlpha = s.opacity;
        ctx!.fillRect((s.left / 100) * width, squareY(s.phase, time), s.size, s.size);
      }

      ctx!.textBaseline = "middle";
      ctx!.textAlign = "center";
      ctx!.fillStyle = "#6b7280";
      for (const p of items) {
        // 上端でフェードイン、画面の下4割でフェードアウト
        const t = p.y / height;
        const fadeIn = Math.min(1, Math.max(0, (p.y + 40) / 100));
        const fadeOut = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
        const text = String(p.value);
        let size = p.base;
        ctx!.font = `${size}px ${FONT}`;
        // 桁が増えて確保した幅を超えたら文字を縮める
        const maxW = p.x1 - p.x0;
        const textW = ctx!.measureText(text).width;
        if (textW > maxW) {
          size *= maxW / textW;
          ctx!.font = `${size}px ${FONT}`;
        }
        ctx!.globalAlpha = p.alpha * fadeIn * fadeOut;
        ctx!.fillText(text, (p.x0 + p.x1) / 2, p.y);
      }
      ctx!.globalAlpha = 1;
    }

    let frameId = 0;
    let last = performance.now();
    function frame(now: number) {
      const dt = Math.min(now - last, 50);
      last = now;
      time += dt / 1000;

      items = items.filter((p) => p.y / height <= 1.05);
      for (const p of items) {
        p.y += (p.v * dt) / 1000;
        p.acc += dt;
        while (p.acc >= TICK_MS) {
          p.acc -= TICK_MS;
          p.value = step(p.value);
        }
      }
      if (items.length < numberCount && Math.random() < 0.2) trySpawn(SPAWN_Y);

      draw();
      frameId = requestAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
    observer.observe(canvas);
    resize();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw();
    } else {
      frameId = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [showNumbers]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
