import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { PLAYER } from '../components';
import type { Player } from '../components';
import { XP_BASE_PER_LEVEL, XP_LEVEL_SCALE } from '../constants';

export type LevelUpCallback = (playerEntity: number) => void;

let onLevelUp: LevelUpCallback | null = null;
export function setLevelUpCallback(cb: LevelUpCallback): void {
  onLevelUp = cb;
}

export const XPSystem: System = {
  name: 'XPSystem',
  update(world: World, _dt: number) {
    for (const entity of world.query(PLAYER)) {
      const player = world.getComponent<Player>(entity, PLAYER)!;

      while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.xpToNext = Math.floor(XP_BASE_PER_LEVEL * Math.pow(XP_LEVEL_SCALE, player.level - 1));
        if (onLevelUp) onLevelUp(entity);
      }
    }
  },
};
