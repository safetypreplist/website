import { useEffect, useRef } from "react";

const COLORS = ["#c75a2b", "#d9784c", "#556b2f", "#637a3a", "#c4a07a", "#e3b34c", "#fbf8f1"];
const DURATION_MS = 5200;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  ratio: number;
  angle: number;
  spin: number;
  wobble: number;
  wobbleSpeed: number;
  color: string;
  round: boolean;
};

function burst(originX: number, originY: number, count: number, aimDeg: number, spreadDeg: number, speed: number): Piece[] {
  return Array.from({ length: count }, () => {
    const angle = ((aimDeg + (Math.random() - 0.5) * spreadDeg) * Math.PI) / 180;
    const velocity = speed * (0.55 + Math.random() * 0.6);
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      size: 7 + Math.random() * 7,
      ratio: 0.4 + Math.random() * 0.5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.05 + Math.random() * 0.08,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.2,
    };
  });
}

export function Confetti({ fire }: { fire: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!fire || fired.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    fired.current = true;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const speed = Math.max(14, Math.min(22, width / 55));
    const pieces = [
      ...burst(width * 0.5, height * 0.38, 110, -90, 360, speed * 0.9),
      ...burst(0, height * 0.75, 70, -55, 40, speed * 1.25),
      ...burst(width, height * 0.75, 70, -125, 40, speed * 1.25),
    ];

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const fade = elapsed > DURATION_MS - 1200 ? Math.max(0, (DURATION_MS - elapsed) / 1200) : 1;
      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.32;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.cos(p.wobble) * 0.6;
        p.y += p.vy;
        p.angle += p.spin;
        if (p.y > height + 20) continue;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.scale(1, Math.abs(Math.cos(p.wobble)) * 0.8 + 0.2);
          ctx.fillRect(-p.size / 2, (-p.size * p.ratio) / 2, p.size, p.size * p.ratio);
        }
        ctx.restore();
      }
      if (elapsed < DURATION_MS) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, width, height);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      fired.current = false;
    };
  }, [fire]);

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
