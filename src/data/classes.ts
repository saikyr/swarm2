import { ClassType, PLAYER_SPEED, PLAYER_DASH_SPEED, PLAYER_DASH_DURATION, PLAYER_DASH_COOLDOWN } from '../constants';
import type { Player } from '../components';

export interface ClassDef {
  classType: ClassType;
  shape: 'diamond' | 'circle';
  color: string;
  glowColor: string;
  player: Omit<Player, 'playerId' | 'kills' | 'level' | 'xp' | 'xpToNext'>;
  weapons: string[];
}

export const CLASS_DEFS: Record<ClassType, ClassDef> = {
  [ClassType.Warrior]: {
    classType: ClassType.Warrior,
    shape: 'diamond',
    color: '#00ffff',
    glowColor: '#00ffff',
    player: {
      classType: ClassType.Warrior,
      speed: PLAYER_SPEED,
      dashSpeed: PLAYER_DASH_SPEED,
      dashDuration: PLAYER_DASH_DURATION,
      dashCooldown: PLAYER_DASH_COOLDOWN,
      dashTimer: 0,
      dashCooldownTimer: 0,
      isDashing: false,
      downed: false,
      damageMultiplier: 1,
      speedMultiplier: 1,
      pickupRadiusMultiplier: 1,
      chilledTimer: 0,
    },
    weapons: ['warrior_cleave', 'warrior_axes', 'warrior_banner', 'warrior_flail', 'warrior_stomp', 'warrior_javelin', 'warrior_trap', 'warrior_spiral'],
  },
  [ClassType.Caster]: {
    classType: ClassType.Caster,
    shape: 'circle',
    color: '#aa44ff',
    glowColor: '#aa44ff',
    player: {
      classType: ClassType.Caster,
      speed: PLAYER_SPEED * 0.9,
      dashSpeed: PLAYER_DASH_SPEED * 0.8,
      dashDuration: PLAYER_DASH_DURATION,
      dashCooldown: PLAYER_DASH_COOLDOWN * 1.2,
      dashTimer: 0,
      dashCooldownTimer: 0,
      isDashing: false,
      downed: false,
      damageMultiplier: 1,
      speedMultiplier: 1,
      pickupRadiusMultiplier: 1,
      chilledTimer: 0,
    },
    weapons: ['caster_bolt', 'caster_chain', 'caster_frostorbs', 'caster_runes', 'caster_beam', 'caster_frostnova', 'caster_mines', 'caster_vortex'],
  },
};
