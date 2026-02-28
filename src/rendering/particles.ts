import type { World } from '../ecs/ecs';
import { PARTICLE, TRANSFORM, RENDERABLE, LIFETIME } from '../components';
import type { Particle, Transform, Renderable, Lifetime } from '../components';
import { randomRange, TAU } from '../utils/math';
import { buildJitterPolyline } from './shapes';

// Lightweight beam FX for chain lightning
export interface BeamFxEntry {
  points: { x: number; y: number }[];
  timer: number;
  duration: number;
}

const activeBeamFx: BeamFxEntry[] = [];

export function getActiveBeamFx(): BeamFxEntry[] {
  return activeBeamFx;
}

export function spawnBeamFx(
  x0: number, y0: number,
  x1: number, y1: number,
  duration = 0.1
): void {
  const dist = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
  const segments = Math.max(4, Math.floor(dist / 15));
  const jitter = Math.min(12, dist * 0.12);
  activeBeamFx.push({
    points: buildJitterPolyline(x0, y0, x1, y1, segments, jitter),
    timer: duration,
    duration,
  });
}

export function emitParticles(
  world: World,
  x: number, y: number,
  count: number,
  color: string,
  opts: {
    speed?: number;
    speedVar?: number;
    size?: number;
    sizeVar?: number;
    life?: number;
    lifeVar?: number;
    friction?: number;
  } = {}
): void {
  const speed = opts.speed ?? 100;
  const speedVar = opts.speedVar ?? 50;
  const size = opts.size ?? 3;
  const sizeVar = opts.sizeVar ?? 1.5;
  const life = opts.life ?? 0.5;
  const lifeVar = opts.lifeVar ?? 0.2;
  const friction = opts.friction ?? 3;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const spd = speed + randomRange(-speedVar, speedVar);
    const sz = Math.max(1, size + randomRange(-sizeVar, sizeVar));
    const lf = Math.max(0.1, life + randomRange(-lifeVar, lifeVar));

    const entity = world.createEntity();
    world.addComponent<Transform>(entity, TRANSFORM, {
      pos: { x, y },
      prevPos: { x, y },
      rotation: 0,
    });
    world.addComponent<Particle>(entity, PARTICLE, {
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: lf,
      maxLife: lf,
      size: sz,
      startSize: sz,
      color,
      friction,
    });
    world.addComponent<Renderable>(entity, RENDERABLE, {
      shape: 'circle',
      radius: sz,
      color,
      glowColor: color,
      glowSize: 6,
      alpha: 1,
      zIndex: 5,
    });
    world.addComponent<Lifetime>(entity, LIFETIME, { remaining: lf });
  }
}
