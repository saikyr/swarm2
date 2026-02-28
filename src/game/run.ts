export interface RunContext {
  timer: number;
  wave: number;
  spawnTimer: number;
  upgradesPicked: string[];
  currencyEarned: number;
  seed: number;
}

export function createRunContext(seed?: number): RunContext {
  return {
    timer: 0,
    wave: 1,
    spawnTimer: 2, // Grace period at start
    upgradesPicked: [],
    currencyEarned: 0,
    seed: seed ?? Math.floor(Math.random() * 999999),
  };
}
