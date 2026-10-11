import type { Game, InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";

export const BACKGROUND = "#07131f";
export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";
export type Mode = "solo" | "versus";
export type Side = "left" | "right";
export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}
export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}
export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}
export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}
export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}
export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";
  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;
  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;
  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly simTime: number;
  readonly muted: boolean;
}
type Snapshot = Omit<CaromState, "ball"> & {
  version: number;
  ball: (BallState & { speed: number }) | null;
};
type Rect = { x: number; y: number; w: number; h: number };
type Pose = (s: DeepReadonly<CaromState>) => CaromState;
export interface CaromDebugApi {
  readonly version: number;
  clearWorld: Pose;
  spawnBall: Pose;
  spawnObstacle(s: DeepReadonly<CaromState>, i: number): CaromState;
  reset: Pose;
  reconcile: Pose;
  setScreen(s: DeepReadonly<CaromState>, v: Screen): CaromState;
  setMode(s: DeepReadonly<CaromState>, v: Mode): CaromState;
  setMenuIndex(s: DeepReadonly<CaromState>, v: number): CaromState;
  setTitleIndex(s: DeepReadonly<CaromState>, v: number): CaromState;
  setResumeScreen(
    s: DeepReadonly<CaromState>,
    v: "countdown" | "playing",
  ): CaromState;
  setScore(s: DeepReadonly<CaromState>, a: number, b: number): CaromState;
  setWinner(s: DeepReadonly<CaromState>, v: Side | null): CaromState;
  setReceiver(s: DeepReadonly<CaromState>, v: Side): CaromState;
  setPaddleCy(s: DeepReadonly<CaromState>, v: Side, n: number): CaromState;
  setPaddleVy(s: DeepReadonly<CaromState>, v: Side, n: number): CaromState;
  setPaddleDriven(s: DeepReadonly<CaromState>, v: Side, n: boolean): CaromState;
  setBallPosition(
    s: DeepReadonly<CaromState>,
    x: number,
    y: number,
  ): CaromState;
  setBallVelocity(
    s: DeepReadonly<CaromState>,
    x: number,
    y: number,
  ): CaromState;
  setBallSpin(s: DeepReadonly<CaromState>, n: number): CaromState;
  setBallHeld(s: DeepReadonly<CaromState>, n: boolean): CaromState;
  setBallHoldTimer(s: DeepReadonly<CaromState>, n: number): CaromState;
  setBallServeSign(s: DeepReadonly<CaromState>, n: 1 | -1): CaromState;
  drawBallServeSign: Pose;
  setAiTracking(s: DeepReadonly<CaromState>, n: boolean): CaromState;
  setAiMovement(s: DeepReadonly<CaromState>, n: boolean): CaromState;
  setMuted(s: DeepReadonly<CaromState>, n: boolean): CaromState;
  snapshot(s: DeepReadonly<CaromState>): Snapshot;
  menuItemRect(s: DeepReadonly<CaromState>, i: number): Rect | null;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const freshSign = (): 1 | -1 => (Math.random() < 0.5 ? 1 : -1);
const spawn = (): BallState => ({
  x: C.FIELD_CX,
  y: C.FIELD_CY,
  vx: 0,
  vy: 0,
  spin: 0,
  held: true,
  holdTimer: C.HOLD_TIME,
  serveSign: freshSign(),
  trail: [],
});
const world = () =>
  C.OBSTACLE_CENTERS.map((p, index) => ({ index, cx: p.x, cy: p.y }));
const initial = (muted = false, simTime = 0, titleIndex = 0): CaromState => ({
  screen: "title",
  mode: "solo",
  menuIndex: titleIndex,
  titleIndex,
  resumeScreen: "playing",
  score: { p1: 0, p2: 0 },
  winner: null,
  paddles: {
    left: { cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 },
    right: { cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 },
  },
  ai: { tracking: true, movement: true },
  receiver: "left",
  ball: spawn(),
  obstacles: world(),
  simTime,
  muted,
});
const clone = (s: DeepReadonly<CaromState>): CaromState => ({
  ...s,
  score: { ...s.score },
  paddles: { left: { ...s.paddles.left }, right: { ...s.paddles.right } },
  ai: { ...s.ai },
  ball: s.ball ? { ...s.ball, trail: [...s.ball.trail] } : null,
  obstacles: [...s.obstacles],
});
const menu = (x: Screen) =>
  x === "title"
    ? C.TITLE_ITEMS
    : x === "paused"
      ? C.PAUSE_ITEMS
      : x === "matchover"
        ? C.MATCHOVER_ITEMS
        : x === "howto"
          ? ["BACK"]
          : [];
const rect = (x: Screen, i: number): Rect | null =>
  i >= 0 && i < menu(x).length
    ? { x: 430, y: 300 + i * 62, w: 420, h: 50 }
    : null;
const need = (s: DeepReadonly<CaromState>) => {
  if (!s.ball) throw new Error("Carom: ball is absent");
  return s.ball;
};
const move = (p: PaddleState, v: number, dt: number): PaddleState => {
  const y = clamp(p.cy + v * dt, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return {
    ...p,
    cy: y,
    vy: y !== p.cy + v * dt && dt > 0 ? (y - p.cy) / dt : v,
  };
};
const pset = (
  s: DeepReadonly<CaromState>,
  side: Side,
  p: PaddleState,
): CaromState => ({ ...clone(s), paddles: { ...s.paddles, [side]: p } });
function start(s: DeepReadonly<CaromState>, mode = s.mode): CaromState {
  return {
    ...clone(s),
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: spawn(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
  };
}
const home = (s: DeepReadonly<CaromState>) =>
  initial(s.muted, s.simTime, s.titleIndex);
function confirm(s: DeepReadonly<CaromState>): CaromState {
  if (s.screen === "title") {
    if (s.menuIndex === 0) return start({ ...s, titleIndex: 0 }, "solo");
    if (s.menuIndex === 1) return start({ ...s, titleIndex: 1 }, "versus");
    return { ...clone(s), screen: "howto", titleIndex: 2, menuIndex: 0 };
  }
  if (s.screen === "howto") return home(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...clone(s), screen: s.resumeScreen }
      : s.menuIndex === 1
        ? start(s)
        : home(s);
  if (s.screen === "matchover") return s.menuIndex === 0 ? start(s) : home(s);
  return clone(s);
}
function hit(
  b: BallState,
  r: { x0: number; x1: number; y0: number; y1: number },
): { b: BallState; f: number } | null {
  if (!(
    b.x > r.x0 - C.BALL_R &&
    b.x < r.x1 + C.BALL_R &&
    b.y > r.y0 - C.BALL_R &&
    b.y < r.y1 + C.BALL_R
  ))
    return null;
  const d = [
    b.x - (r.x0 - C.BALL_R),
    r.x1 + C.BALL_R - b.x,
    b.y - (r.y0 - C.BALL_R),
    r.y1 + C.BALL_R - b.y,
  ];
  let f = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[f]) f = i;
  const n = { ...b };
  if (f === 0) {
    n.x = r.x0 - C.BALL_R;
    if (n.vx > 0) n.vx = -n.vx;
  } else if (f === 1) {
    n.x = r.x1 + C.BALL_R;
    if (n.vx < 0) n.vx = -n.vx;
  } else if (f === 2) {
    n.y = r.y0 - C.BALL_R;
    if (n.vy > 0) n.vy = -n.vy;
  } else {
    n.y = r.y1 + C.BALL_R;
    if (n.vy < 0) n.vy = -n.vy;
  }
  return { b: n, f };
}
function step(s: CaromState, dt: number, api: UpdateApi): CaromState {
  let b = s.ball;
  if (!b) return s;
  if (b.held) {
    const hold = b.holdTimer - dt;
    if (hold <= 0) {
      const d = s.receiver === "left" ? -1 : 1;
      return {
        ...s,
        screen: "playing",
        ball: {
          ...b,
          held: false,
          holdTimer: 0,
          vx: d * C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE),
          vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          trail: [],
        },
      };
    }
    return {
      ...s,
      ball: {
        ...b,
        holdTimer: hold,
        trail: [...b.trail, { x: b.x, y: b.y, t: s.simTime }].filter(
          (t) => t.t >= s.simTime - C.TRAIL_TIME,
        ),
      },
    };
  }
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  let paddle = false;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed) {
      const a = (b.spin / speed) * h,
        co = Math.cos(a),
        si = Math.sin(a);
      b = { ...b, vx: b.vx * co - b.vy * si, vy: b.vx * si + b.vy * co };
    }
    b = {
      ...b,
      spin: b.spin * Math.pow(0.5, h / C.SPIN_HALFLIFE),
      x: b.x + b.vx * h,
      y: b.y + b.vy * h,
    };
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b = { ...b, y: C.BALL_R, vy: -b.vy };
      api.audio.play(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b = { ...b, y: C.FIELD_H - C.BALL_R, vy: -b.vy };
      api.audio.play(C.CUES.wallBounce);
    }
    for (const side of ["left", "right"] as const) {
      const p = s.paddles[side],
        r =
          side === "left"
            ? {
                x0: C.P1_X0,
                x1: C.P1_X1,
                y0: p.cy - C.PADDLE_HALF,
                y1: p.cy + C.PADDLE_HALF,
              }
            : {
                x0: C.P2_X0,
                x1: C.P2_X1,
                y0: p.cy - C.PADDLE_HALF,
                y1: p.cy + C.PADDLE_HALF,
              },
        k = hit(b, r);
      if (k) {
        b = k.b;
        if (k.f < 2) {
          const v = Math.min(
              Math.hypot(b.vx, b.vy) * C.SPEED_MULT,
              C.SPEED_CAP,
            ),
            a = clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE,
            d = side === "left" ? 1 : -1;
          b = {
            ...b,
            x: side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R,
            vx: d * v * Math.cos(a),
            vy: v * Math.sin(a),
            spin: clamp(
              b.spin + p.vy * C.SPIN_FROM_PADDLE,
              -C.SPIN_CLAMP,
              C.SPIN_CLAMP,
            ),
          };
          paddle = true;
        } else api.audio.play(C.CUES.wallBounce);
      }
    }
    for (const o of s.obstacles) {
      const k = hit(b, {
        x0: o.cx - C.OBSTACLE_CENTERS[0].x + C.OBSTACLES[0].x0,
        x1: o.cx - C.OBSTACLE_CENTERS[0].x + C.OBSTACLES[0].x1,
        y0: o.cy - C.OBSTACLE_CENTERS[0].y + C.OBSTACLES[0].y0,
        y1: o.cy - C.OBSTACLE_CENTERS[0].y + C.OBSTACLES[0].y1,
      });
      if (k) {
        b = k.b;
        api.audio.play(C.CUES.obstacleBounce);
      }
    }
  }
  if (paddle) api.audio.play(C.CUES.paddleHit);
  const trail = [...b.trail, { x: b.x, y: b.y, t: s.simTime }].filter(
    (t) => t.t >= s.simTime - C.TRAIL_TIME,
  );
  if (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0) {
    const left = b.x - C.BALL_R > C.FIELD_W,
      p1 = s.score.p1 + (left ? 1 : 0),
      p2 = s.score.p2 + (left ? 0 : 1);
    api.audio.play(C.CUES.score);
    if (
      (p1 >= C.WIN_SCORE && p1 - p2 >= C.WIN_LEAD) ||
      (p2 >= C.WIN_SCORE && p2 - p1 >= C.WIN_LEAD)
    )
      return {
        ...s,
        score: { p1, p2 },
        winner: left ? "left" : "right",
        screen: "matchover",
        menuIndex: 0,
        ball: b,
      };
    return {
      ...s,
      score: { p1, p2 },
      receiver: left ? "right" : "left",
      screen: "countdown",
      ball: spawn(),
    };
  }
  return { ...s, ball: { ...b, trail } };
}
function movePaddles(s: CaromState, api: UpdateApi, dt: number): CaromState {
  let l = s.paddles.left,
    r = s.paddles.right;
  const axis = (a: string, b: string) =>
    api.input.value(b) - api.input.value(a);
  l = l.driven
    ? move(l, l.drivenVy, dt)
    : move(l, axis("p1-up", "p1-down") * C.PADDLE_SPEED, dt);
  if (r.driven) r = move(r, r.drivenVy, dt);
  else if (s.mode === "versus")
    r = move(r, axis("p2-up", "p2-down") * C.PADDLE_SPEED, dt);
  else {
    let target = C.AI_HOME_Y,
      dz = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      dz = C.AI_DEADZONE;
    }
    const d = target - r.cy,
      v =
        !s.ai.movement || Math.abs(d) <= dz
          ? 0
          : Math.sign(d) * Math.min(C.AI_SPEED, Math.abs(d) / (dt || 1));
    r = move(r, v, dt);
  }
  return { ...s, paddles: { left: l, right: r } };
}
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api: InitApi<CaromState>) {
    for (const a of C.ACTIONS)
      api.input.register(a, {
        keys: [...C.BINDINGS[a]],
        kind: a.includes("up") || a.includes("down") ? "analog" : "digital",
      });
    api.audio.define(C.CUES.paddleHit, {
      wave: "square",
      freq: 520,
      freqTo: 760,
      gain: 0.12,
      durationMs: 45,
    });
    api.audio.define(C.CUES.wallBounce, {
      wave: "triangle",
      freq: 260,
      freqTo: 180,
      gain: 0.11,
      durationMs: 55,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      wave: "sawtooth",
      freq: 330,
      freqTo: 210,
      gain: 0.1,
      durationMs: 65,
    });
    api.audio.define(C.CUES.score, {
      wave: "sine",
      freq: 660,
      freqTo: 990,
      gain: 0.16,
      durationMs: 150,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("p1", (s) => s.score.p1);
    api.diagnostics.register("p2", (s) => s.score.p2);
    api.diagnostics.register("ball", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "-",
    );
    api.diagnostics.register("speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : 0,
    );
    api.diagnostics.register("spin", (s) => s.ball?.spin ?? 0);
    api.diagnostics.register(
      "left paddle",
      (s) =>
        `${s.paddles.left.cy.toFixed(1)} / ${s.paddles.left.vy.toFixed(1)}`,
    );
    api.diagnostics.register(
      "right paddle",
      (s) =>
        `${s.paddles.right.cy.toFixed(1)} / ${s.paddles.right.vy.toFixed(1)}`,
    );
    const debug: CaromDebugApi = {
      version: C.CAROM_DEBUG_VERSION,
      clearWorld: (s) => ({ ...clone(s), ball: null, obstacles: [] }),
      spawnBall: (s) => ({ ...clone(s), ball: spawn() }),
      spawnObstacle: (s, i) => {
        const q = C.OBSTACLE_CENTERS[i];
        if (!q) throw new Error("Carom: invalid obstacle");
        return {
          ...clone(s),
          obstacles: [
            ...s.obstacles.filter((o) => o.index !== i),
            { index: i, cx: q.x, cy: q.y },
          ].sort((a, b) => a.index - b.index),
        };
      },
      reset: (s) => initial(s.muted),
      reconcile: (s) => clone(s),
      setScreen: (s, v) => ({ ...clone(s), screen: v }),
      setMode: (s, v) => ({ ...clone(s), mode: v }),
      setMenuIndex: (s, v) => ({ ...clone(s), menuIndex: v }),
      setTitleIndex: (s, v) => ({ ...clone(s), titleIndex: v }),
      setResumeScreen: (s, v) => ({ ...clone(s), resumeScreen: v }),
      setScore: (s, a, b) => ({ ...clone(s), score: { p1: a, p2: b } }),
      setWinner: (s, v) => ({ ...clone(s), winner: v }),
      setReceiver: (s, v) => ({ ...clone(s), receiver: v }),
      setPaddleCy: (s, v, n) => pset(s, v, { ...s.paddles[v], cy: n }),
      setPaddleVy: (s, v, n) => pset(s, v, { ...s.paddles[v], drivenVy: n }),
      setPaddleDriven: (s, v, n) => pset(s, v, { ...s.paddles[v], driven: n }),
      setBallPosition: (s, x, y) => ({
        ...clone(s),
        ball: { ...need(s), x, y },
      }),
      setBallVelocity: (s, x, y) => ({
        ...clone(s),
        ball: { ...need(s), vx: x, vy: y },
      }),
      setBallSpin: (s, n) => ({ ...clone(s), ball: { ...need(s), spin: n } }),
      setBallHeld: (s, n) => ({ ...clone(s), ball: { ...need(s), held: n } }),
      setBallHoldTimer: (s, n) => ({
        ...clone(s),
        ball: { ...need(s), holdTimer: n },
      }),
      setBallServeSign: (s, n) => ({
        ...clone(s),
        ball: { ...need(s), serveSign: n },
      }),
      drawBallServeSign: (s) => ({
        ...clone(s),
        ball: { ...need(s), serveSign: freshSign() },
      }),
      setAiTracking: (s, n) => ({ ...clone(s), ai: { ...s.ai, tracking: n } }),
      setAiMovement: (s, n) => ({ ...clone(s), ai: { ...s.ai, movement: n } }),
      setMuted: (s, n) => ({ ...clone(s), muted: n }),
      snapshot: (s) => ({
        ...clone(s),
        version: C.CAROM_DEBUG_VERSION,
        ball: s.ball
          ? { ...s.ball, speed: Math.hypot(s.ball.vx, s.ball.vy) }
          : null,
      }),
      menuItemRect: (s, i) => rect(s.screen, i),
    };
    return [initial(false), debug];
  },
  update(state, api, dt) {
    let s = clone(state);
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    s = { ...s, muted: api.audio.muted(), simTime: s.simTime + dt };
    const began = s.screen,
      up = api.input.pressed("p1-up") || api.input.pressed("p2-up"),
      down = api.input.pressed("p1-down") || api.input.pressed("p2-down"),
      ok = api.input.pressed("confirm"),
      back = api.input.pressed("back"),
      pause = api.input.pressed("pause");
    if (began === "countdown" || began === "playing") {
      if (pause)
        s = { ...s, screen: "paused", resumeScreen: began, menuIndex: 0 };
    } else if (began === "paused" && (pause || back))
      s = { ...s, screen: s.resumeScreen };
    else if (began === "howto" && (ok || back)) s = home(s);
    else if (began === "matchover" && back) s = home(s);
    else if (began === "title" || began === "paused" || began === "matchover") {
      const len = menu(began).length;
      if (up) s = { ...s, menuIndex: (s.menuIndex + len - 1) % len };
      else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % len };
      else if (ok) s = confirm(s);
    }
    if (s.screen === "countdown" || s.screen === "playing") {
      s = movePaddles(s, api, dt);
      s = step(s, dt, api);
    }
    return s;
  },
  render(s, api) {
    const x = api.ctx;
    x.fillStyle = BACKGROUND;
    x.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    x.strokeStyle = "#1b4255";
    x.lineWidth = 2;
    x.setLineDash([10, 12]);
    x.beginPath();
    x.moveTo(C.NET_X, 40);
    x.lineTo(C.NET_X, C.FIELD_H - 40);
    x.stroke();
    x.setLineDash([]);
    for (const o of s.obstacles) {
      x.fillStyle = "#ffb703";
      x.beginPath();
      x.roundRect(o.cx - 10, o.cy - 70, 20, 140, 10);
      x.fill();
    }
    for (const side of ["left", "right"] as const) {
      const p = s.paddles[side];
      x.fillStyle = side === "left" ? "#47d7ff" : "#ff4d83";
      x.beginPath();
      x.roundRect(
        side === "left" ? C.P1_X0 : C.P2_X0,
        p.cy - C.PADDLE_H / 2,
        C.PADDLE_W,
        C.PADDLE_H,
        8,
      );
      x.fill();
    }
    if (s.ball) {
      x.strokeStyle = "rgba(215,247,255,.35)";
      x.lineWidth = 5;
      x.beginPath();
      s.ball.trail.forEach((t, i) =>
        i ? x.lineTo(t.x, t.y) : x.moveTo(t.x, t.y),
      );
      x.stroke();
      x.fillStyle = "#f4fbff";
      x.beginPath();
      x.arc(s.ball.x, s.ball.y, C.BALL_R, 0, Math.PI * 2);
      x.fill();
    }
    if (["playing", "countdown", "paused", "matchover"].includes(s.screen)) {
      x.textAlign = "center";
      x.fillStyle = "#dceeff";
      x.font = "700 42px sans-serif";
      x.fillText(`${s.score.p1}      ${s.score.p2}`, C.FIELD_CX, 70);
      x.font = "600 14px sans-serif";
      x.fillStyle = "#79a7bd";
      x.fillText(
        s.mode === "solo" ? "SOLO // CURVE THE RALLY" : "VERSUS // LOCAL DUEL",
        C.FIELD_CX,
        108,
      );
    }
    if (s.screen === "countdown") {
      x.fillStyle = "#fff";
      x.font = "700 26px sans-serif";
      x.textAlign = "center";
      x.fillText(
        `SERVE IN ${(s.ball?.holdTimer ?? 0).toFixed(1)}`,
        C.FIELD_CX,
        650,
      );
    }
    if (s.screen !== "playing" && s.screen !== "countdown") {
      x.fillStyle = "rgba(2,10,18,.78)";
      x.fillRect(260, 150, 760, 420);
      x.textAlign = "center";
      x.fillStyle = "#eefaff";
      x.font = "800 64px sans-serif";
      x.fillText(
        s.screen === "title"
          ? C.TITLE_TEXT
          : s.screen === "howto"
            ? "HOW TO PLAY"
            : s.screen === "paused"
              ? "PAUSED"
              : `${s.winner === "left" ? "PLAYER ONE" : "PLAYER TWO"} WINS`,
        C.FIELD_CX,
        235,
      );
      if (s.screen === "howto") {
        x.font = "20px sans-serif";
        x.fillStyle = "#b9d6e4";
        x.fillText("W / S move left • Arrow keys move right", C.FIELD_CX, 305);
        x.fillText(
          "Move as you strike to bend the ball. Bank shots off amber rails.",
          C.FIELD_CX,
          340,
        );
      }
      menu(s.screen).forEach((v, i) => {
        const r = rect(s.screen, i)!;
        x.fillStyle = i === s.menuIndex ? "#47d7ff" : "#b9d6e4";
        x.font =
          i === s.menuIndex ? "700 28px sans-serif" : "500 24px sans-serif";
        x.fillText(v, C.FIELD_CX, r.y + 34);
      });
    }
  },
};
