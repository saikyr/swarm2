import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { INPUT, PLAYER } from '../components';
import type { InputState, Player } from '../components';
import { isTouchDevice, getTouchInput } from '../input/touch';

const keys = new Set<string>();

function setupInputListeners(): void {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
  window.addEventListener('blur', () => keys.clear());
}

let initialized = false;

/** The local player ID that this InputSystem writes keyboard input to */
let _localPlayerId = 0;
export function setInputLocalPlayerId(id: number): void {
  _localPlayerId = id;
}

export const InputSystem: System = {
  name: 'InputSystem',
  update(world: World, _dt: number) {
    if (!initialized) {
      setupInputListeners();
      initialized = true;
    }

    for (const entity of world.query(INPUT, PLAYER)) {
      const player = world.getComponent<Player>(entity, PLAYER)!;
      // Only write keyboard input to the local player's entity
      if (player.playerId !== _localPlayerId) continue;

      const input = world.getComponent<InputState>(entity, INPUT)!;
      input.moveX = 0;
      input.moveY = 0;

      if (keys.has('KeyW') || keys.has('ArrowUp')) input.moveY = -1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) input.moveY = 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) input.moveX = -1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) input.moveX = 1;

      // Normalize diagonal
      if (input.moveX !== 0 && input.moveY !== 0) {
        const inv = 1 / Math.SQRT2;
        input.moveX *= inv;
        input.moveY *= inv;
      }

      input.dash = keys.has('Space');
      input.ability = keys.has('ShiftLeft') || keys.has('ShiftRight');

      // Merge touch input when joystick is active
      if (isTouchDevice) {
        const touch = getTouchInput();
        if (touch.moveX !== 0 || touch.moveY !== 0) {
          input.moveX = touch.moveX;
          input.moveY = touch.moveY;
        }
        input.dash = input.dash || touch.dash;
        input.ability = input.ability || touch.ability;
      }
    }
  },
};

export function isKeyDown(code: string): boolean {
  return keys.has(code);
}

/** Read current keyboard state as input — used by client to send over network.
 *  Also ensures listeners are initialized even if InputSystem.update() never runs. */
export function getKeyboardInput(): { moveX: number; moveY: number; dash: boolean; ability: boolean } {
  if (!initialized) {
    setupInputListeners();
    initialized = true;
  }

  let moveX = 0;
  let moveY = 0;

  if (keys.has('KeyW') || keys.has('ArrowUp')) moveY = -1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveY = 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX = -1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveX = 1;

  if (moveX !== 0 && moveY !== 0) {
    const inv = 1 / Math.SQRT2;
    moveX *= inv;
    moveY *= inv;
  }

  let dash = keys.has('Space');
  let ability = keys.has('ShiftLeft') || keys.has('ShiftRight');

  if (isTouchDevice) {
    const touch = getTouchInput();
    if (touch.moveX !== 0 || touch.moveY !== 0) {
      moveX = touch.moveX;
      moveY = touch.moveY;
    }
    dash = dash || touch.dash;
    ability = ability || touch.ability;
  }

  return { moveX, moveY, dash, ability };
}
