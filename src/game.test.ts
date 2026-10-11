import { describe, expect, it } from "vitest";
import { game } from "./game";

const initApi = {
  input: { register: () => undefined, layout: () => null },
  audio: { define: () => undefined, load: async () => undefined },
  assets: {
    loadImage: async () => null,
    loadAudio: async () => null,
    load: async () => new Blob(),
    resolve: (x: string) => x,
  },
  diagnostics: { register: () => undefined },
  events: {},
  viewport: () => ({}),
};

describe("Carom state", () => {
  it("parks and serves a new match ball", async () => {
    const [state, debug] = await game.initialize(initApi as never);
    const match = debug.setScreen(debug.spawnBall(state), "countdown");
    const zero = debug.setBallHoldTimer(match, 0);
    expect(zero.ball?.held).toBe(true);
    expect(debug.snapshot(zero).ball?.speed).toBe(0);
  });

  it("keeps debug poses immutable and exposes speed", async () => {
    const [state, debug] = await game.initialize(initApi as never);
    const next = debug.setBallVelocity(state, 3, 4);
    expect(debug.snapshot(state).ball?.speed).toBe(0);
    expect(debug.snapshot(next).ball?.speed).toBe(5);
  });
});
