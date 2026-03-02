import type { EffectLaneEntity, EnemyLaneEntity, PickupLaneEntity, PlayerLaneEntity, ProjectileLaneEntity, WeaponLaneEntity } from './protocol';

interface ViewerContext {
  viewerEntityId: number | null;
  viewerPos: { x: number; y: number } | null;
}

// Higher caps reduce per-snapshot entity churn that can present as flicker/stutter on clients.
const MAX_ENEMIES_NEAR = 40;
const MAX_ENEMIES_MID = 20;
const MAX_PROJECTILES_NEAR = 24;
const MAX_PICKUPS_NEAR = 40;
const MAX_EFFECTS_NEAR = 36;

export function buildViewerContext(players: PlayerLaneEntity[], viewerPlayerId: number): ViewerContext {
  for (const p of players) {
    if (p.player.playerId === viewerPlayerId) {
      return { viewerEntityId: p.id, viewerPos: p.transform.pos };
    }
  }
  return { viewerEntityId: null, viewerPos: null };
}

export function filterEnemiesForViewer(
  enemies: EnemyLaneEntity[],
  viewerPos: { x: number; y: number } | null,
): EnemyLaneEntity[] {
  if (!viewerPos) return enemies;
  const near: Array<{ e: EnemyLaneEntity; d: number }> = [];
  const mid: Array<{ e: EnemyLaneEntity; d: number }> = [];
  for (const e of enemies) {
    const d = dist(viewerPos.x, viewerPos.y, e.transform.pos.x, e.transform.pos.y);
    if (d <= 1200) {
      near.push({ e, d });
    } else if (d <= 2200) {
      mid.push({ e, d });
    }
  }
  near.sort((a, b) => a.d - b.d);
  mid.sort((a, b) => a.d - b.d);

  return [
    ...near.slice(0, MAX_ENEMIES_NEAR).map((x) => x.e),
    ...mid.slice(0, MAX_ENEMIES_MID).map((x) => x.e),
  ];
}

export function filterProjectilesForViewer(
  projectiles: ProjectileLaneEntity[],
  viewerPos: { x: number; y: number } | null,
): ProjectileLaneEntity[] {
  if (!viewerPos) return projectiles;
  const out: Array<{ p: ProjectileLaneEntity; d: number }> = [];
  for (const p of projectiles) {
    const d = dist(viewerPos.x, viewerPos.y, p.transform.pos.x, p.transform.pos.y);
    if (d <= 1400) out.push({ p, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, MAX_PROJECTILES_NEAR).map((x) => x.p);
}

export function filterPickupsForViewer(
  pickups: PickupLaneEntity[],
  viewerPos: { x: number; y: number } | null,
): PickupLaneEntity[] {
  if (!viewerPos) return pickups;
  const out: Array<{ p: PickupLaneEntity; d: number }> = [];
  for (const p of pickups) {
    const d = dist(viewerPos.x, viewerPos.y, p.transform.pos.x, p.transform.pos.y);
    if (d <= 1600) out.push({ p, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, MAX_PICKUPS_NEAR).map((x) => x.p);
}

export function filterEffectsForViewer(
  effects: EffectLaneEntity[],
  viewerPos: { x: number; y: number } | null,
): EffectLaneEntity[] {
  if (!viewerPos) return effects;
  const out: Array<{ fx: EffectLaneEntity; d: number }> = [];
  for (const fx of effects) {
    const d = dist(viewerPos.x, viewerPos.y, fx.transform.pos.x, fx.transform.pos.y);
    if (d <= 1800) out.push({ fx, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, MAX_EFFECTS_NEAR).map((x) => x.fx);
}

export function filterWeaponsForViewer(
  weapons: WeaponLaneEntity[],
  viewerEntityId: number | null,
): WeaponLaneEntity[] {
  if (viewerEntityId == null) return weapons;
  const out: WeaponLaneEntity[] = [];
  for (const w of weapons) {
    if (w.owner.owner === viewerEntityId) out.push(w);
  }
  return out;
}

function dist(x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return Math.hypot(dx, dy);
}
