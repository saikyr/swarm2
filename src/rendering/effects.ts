import { SCREEN_SHAKE_DECAY } from '../constants';

export interface ScreenShake {
  intensity: number;
  offsetX: number;
  offsetY: number;
}

export function createScreenShake(): ScreenShake {
  return { intensity: 0, offsetX: 0, offsetY: 0 };
}

export function addScreenShake(shake: ScreenShake, amount: number): void {
  shake.intensity = Math.max(shake.intensity, amount);
}

export function updateScreenShake(shake: ScreenShake, dt: number): void {
  if (shake.intensity > 0.1) {
    shake.offsetX = (Math.random() - 0.5) * 2 * shake.intensity;
    shake.offsetY = (Math.random() - 0.5) * 2 * shake.intensity;
    shake.intensity *= Math.exp(-SCREEN_SHAKE_DECAY * dt);
  } else {
    shake.intensity = 0;
    shake.offsetX = 0;
    shake.offsetY = 0;
  }
}

export interface HitPause {
  remaining: number;
}

export function createHitPause(): HitPause {
  return { remaining: 0 };
}

export function triggerHitPause(hp: HitPause, duration: number): void {
  hp.remaining = duration;
}

export function updateHitPause(hp: HitPause, dt: number): boolean {
  if (hp.remaining > 0) {
    hp.remaining -= dt;
    return true; // paused
  }
  return false;
}
