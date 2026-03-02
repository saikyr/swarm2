import { AudioEngine } from './audio-engine';
import { camera } from '../systems/CameraSystem';
import * as recipes from './sound-recipes';
import type { DroneState } from './sound-recipes';
import { emitRunEvent } from '../sim-core/events';
import type { NetSoundEvent } from '../net-v2/protocol';

export type SoundEvent = NetSoundEvent;

let engine: AudioEngine | null = null;
let drone: DroneState | null = null;

// Per-event cooldowns in ms
const COOLDOWNS: Partial<Record<SoundEvent, number>> = {
  hit_projectile: 30,
  hit_sweep: 50,
  hit_nova: 50,
  hit_zone: 100,
  enemy_death: 20,
  xp_pickup: 50,
  fire_beam: 100,
};

const lastPlayed = new Map<SoundEvent, number>();
const CULL_DISTANCE = 800;

export function initAudio(): void {
  if (engine) return;
  engine = new AudioEngine();
}

export function unlockAudio(): void {
  engine?.unlock();
}

export function suspendAudio(): void {
  engine?.suspend();
}

export function resumeAudio(): void {
  engine?.resume();
}

export function playSound(
  event: SoundEvent,
  worldX: number,
  worldY: number,
  isCaster = false,
): void {
  if (!engine || !engine.canPlay()) return;

  // Cooldown check
  const cd = COOLDOWNS[event];
  if (cd) {
    const now = performance.now();
    const last = lastPlayed.get(event) || 0;
    if (now - last < cd) return;
    lastPlayed.set(event, now);
  }

  // Positional audio
  const dx = worldX - camera.x;
  const dy = worldY - camera.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Centered sounds (level_up) skip distance culling
  const centered = event === 'level_up';
  if (!centered && dist > CULL_DISTANCE) return;

  // Create panner + volume for position
  const panner = engine.ctx.createStereoPanner();
  const halfScreen = (typeof window !== 'undefined' ? window.innerWidth : 960) * 0.5;
  panner.pan.value = centered ? 0 : Math.max(-1, Math.min(1, dx / halfScreen));

  const posGain = engine.ctx.createGain();
  if (centered) {
    posGain.gain.value = 1.0;
  } else {
    const vol = 1.0 - Math.min(dist / CULL_DISTANCE, 1);
    posGain.gain.value = vol * vol; // quadratic falloff
  }

  panner.connect(posGain).connect(engine.sfxGain);
  const dest = panner;

  let dur = 0;
  switch (event) {
    // Hits
    case 'hit_projectile': dur = recipes.hitProjectile(engine, dest); break;
    case 'hit_sweep': dur = recipes.hitSweep(engine, dest); break;
    case 'hit_nova': dur = recipes.hitNova(engine, dest); break;
    case 'hit_zone': dur = recipes.hitZone(engine, dest); break;
    // Weapon fire
    case 'fire_projectile': dur = recipes.fireProjectile(engine, dest, isCaster); break;
    case 'fire_spread': dur = recipes.fireSpread(engine, dest, isCaster); break;
    case 'fire_sweep': dur = recipes.fireSweep(engine, dest); break;
    case 'fire_nova': dur = recipes.fireNova(engine, dest, isCaster); break;
    case 'fire_chain': dur = recipes.fireChain(engine, dest); break;
    case 'fire_boomerang': dur = recipes.fireBoomerang(engine, dest); break;
    case 'fire_ground_zone': dur = recipes.fireGroundZone(engine, dest); break;
    case 'fire_runic': dur = recipes.fireRunic(engine, dest); break;
    case 'fire_beam': dur = recipes.fireBeam(engine, dest); break;
    case 'fire_spiral': dur = recipes.fireSpiral(engine, dest); break;
    // Enemy
    case 'enemy_death': dur = recipes.enemyDeath(engine, dest); break;
    case 'elite_death': dur = recipes.eliteDeath(engine, dest); break;
    // Player
    case 'dash': dur = recipes.dashSound(engine, dest); break;
    case 'player_hit': dur = recipes.playerHit(engine, dest); break;
    case 'level_up': dur = recipes.levelUp(engine, dest); break;
    case 'xp_pickup': dur = recipes.xpPickup(engine, dest); break;
    case 'health_pickup': dur = recipes.healthPickup(engine, dest); break;
  }

  if (dur > 0) engine.addVoice(dur);
}

export function playSyncedSound(
  event: SoundEvent,
  worldX: number,
  worldY: number,
  isCaster = false,
): void {
  playSound(event, worldX, worldY, isCaster);
  emitRunEvent({
    type: 'sfx',
    event,
    x: worldX,
    y: worldY,
    isCaster: isCaster || undefined,
  });
}

// ── Ambient Drone ──

export function startAmbientDrone(): void {
  if (!engine || drone) return;
  drone = recipes.startDrone(engine);
}

export function updateAmbientDrone(wave: number): void {
  if (drone) recipes.updateDrone(drone, wave);
}

export function stopAmbientDrone(): void {
  if (drone) {
    recipes.stopDrone(drone);
    drone = null;
  }
}
