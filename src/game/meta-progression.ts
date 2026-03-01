const STORAGE_KEY = 'swarm_meta';

export interface MetaProgression {
  currency: number;
  totalRuns: number;
  bestTime: number;
  bestKills: number;
  unlocks: Record<string, boolean>;
  permanentBuffs: {
    maxHp: number;
    damage: number;
    speed: number;
    pickupRadius: number;
  };
}

export function loadMeta(): MetaProgression {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return defaultMeta();
}

export function saveMeta(meta: MetaProgression): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

function defaultMeta(): MetaProgression {
  return {
    currency: 0,
    totalRuns: 0,
    bestTime: 0,
    bestKills: 0,
    unlocks: {},
    permanentBuffs: { maxHp: 0, damage: 0, speed: 0, pickupRadius: 0 },
  };
}
