import type { EnvelopeV2, InputFrameV2, UpgradePickV2 } from './protocol';
import { PROTOCOL_V2 } from './protocol';

export function validateEnvelopeV2(value: unknown): EnvelopeV2 | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.v !== PROTOCOL_V2) return null;
  if (typeof v.t !== 'string') return null;
  if (typeof v.room !== 'string' || v.room.length > 8) return null;
  if (typeof v.ts !== 'number') return null;
  if (!('payload' in v)) return null;

  return v as unknown as EnvelopeV2;
}

export function validateInputFrameV2(value: unknown): InputFrameV2 | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;

  if (!isInt(p.playerId) || (p.playerId as number) < 0 || (p.playerId as number) > 3) return null;
  if (!isInt(p.seq) || (p.seq as number) < 0) return null;
  if (!isInt(p.clientTick) || (p.clientTick as number) < 0) return null;
  if (typeof p.moveX !== 'number' || p.moveX < -1 || p.moveX > 1) return null;
  if (typeof p.moveY !== 'number' || p.moveY < -1 || p.moveY > 1) return null;
  if (!isInt(p.buttons) || (p.buttons as number) < 0 || (p.buttons as number) > 7) return null;

  return {
    playerId: p.playerId as number,
    seq: p.seq as number,
    clientTick: p.clientTick as number,
    moveX: p.moveX as number,
    moveY: p.moveY as number,
    buttons: p.buttons as number,
  };
}

export function validateUpgradePickV2(value: unknown): UpgradePickV2 | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (!isInt(p.playerId) || (p.playerId as number) < 0 || (p.playerId as number) > 3) return null;
  if (!isInt(p.cardIndex) || (p.cardIndex as number) < 0 || (p.cardIndex as number) > 6) return null;
  return {
    playerId: p.playerId as number,
    cardIndex: p.cardIndex as number,
  };
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}
