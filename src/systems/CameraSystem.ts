import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { PLAYER, TRANSFORM, HEALTH } from '../components';
import type { Transform, Player, Health } from '../components';
import { lerp, vec2DistSq } from '../utils/math';
import { CAMERA_LERP_SPEED } from '../constants';

export interface Camera {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
}

export function createCamera(): Camera {
  return { x: 0, y: 0, prevX: 0, prevY: 0, targetX: 0, targetY: 0 };
}

export let camera: Camera = createCamera();

export function resetCamera(): void {
  camera = createCamera();
}

/** Return interpolated camera position for rendering */
export function getCameraPos(alpha: number): { x: number; y: number } {
  return {
    x: lerp(camera.prevX, camera.x, alpha),
    y: lerp(camera.prevY, camera.y, alpha),
  };
}

let _localPlayerId = 0;
export function setLocalPlayerId(id: number): void {
  _localPlayerId = id;
}

export const CameraSystem: System = {
  name: 'CameraSystem',
  update(world: World, dt: number) {
    const players = world.query(PLAYER, TRANSFORM);
    if (players.length === 0) return;

    // Find the local player entity
    let target: Transform | null = null;
    for (const pe of players) {
      const p = world.getComponent<Player>(pe, PLAYER)!;
      if (p.playerId === _localPlayerId) {
        const h = world.getComponent<Health>(pe, HEALTH);
        // If local player is dead, follow nearest living player
        if (h && h.current <= 0) {
          target = findNearestLivingPlayer(world, players, world.getComponent<Transform>(pe, TRANSFORM)!);
        } else {
          target = world.getComponent<Transform>(pe, TRANSFORM)!;
        }
        break;
      }
    }

    // Fallback to first player
    if (!target) {
      target = world.getComponent<Transform>(players[0], TRANSFORM)!;
    }

    camera.targetX = target.pos.x;
    camera.targetY = target.pos.y;

    camera.prevX = camera.x;
    camera.prevY = camera.y;
    camera.x = lerp(camera.x, camera.targetX, CAMERA_LERP_SPEED * dt);
    camera.y = lerp(camera.y, camera.targetY, CAMERA_LERP_SPEED * dt);
  },
};

function findNearestLivingPlayer(world: World, players: number[], refTransform: Transform): Transform | null {
  let bestDistSq = Infinity;
  let best: Transform | null = null;
  for (const pe of players) {
    const h = world.getComponent<Health>(pe, HEALTH);
    if (h && h.current <= 0) continue;
    const t = world.getComponent<Transform>(pe, TRANSFORM)!;
    const dSq = vec2DistSq(t.pos, refTransform.pos);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = t;
    }
  }
  return best;
}
