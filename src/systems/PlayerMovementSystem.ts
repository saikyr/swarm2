import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { TRANSFORM, VELOCITY, INPUT, PLAYER, HEALTH, COLLIDER } from '../components';
import type { Transform, Velocity, InputState, Player, Health } from '../components';
import { playSyncedSound } from '../audio/audio';
import { applyNormalPlayerVelocity, integratePlayerVelocity } from '../sim-core/local-move';

export const PlayerMovementSystem: System = {
  name: 'PlayerMovementSystem',
  update(world: World, dt: number) {
    for (const entity of world.query(PLAYER, INPUT, TRANSFORM, VELOCITY)) {
      const player = world.getComponent<Player>(entity, PLAYER)!;
      const input = world.getComponent<InputState>(entity, INPUT)!;
      const vel = world.getComponent<Velocity>(entity, VELOCITY)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
      const health = world.getComponent<Health>(entity, HEALTH);

      // Skip movement for downed players
      if (player.downed) {
        vel.x = 0;
        vel.y = 0;
        continue;
      }

      // Dash logic
      if (player.dashCooldownTimer > 0) {
        player.dashCooldownTimer -= dt;
      }

      if (player.isDashing) {
        player.dashTimer -= dt;
        if (player.dashTimer <= 0) {
          player.isDashing = false;
        }
        // During dash, maintain dash velocity (set when dash started)
        if (health) health.iframes = 0.1;
      } else if (input.dash && player.dashCooldownTimer <= 0 && (input.moveX !== 0 || input.moveY !== 0)) {
        // Start dash
        player.isDashing = true;
        player.dashTimer = player.dashDuration;
        player.dashCooldownTimer = player.dashCooldown;
        playSyncedSound('dash', transform.pos.x, transform.pos.y);
        vel.x = input.moveX * player.dashSpeed;
        vel.y = input.moveY * player.dashSpeed;
      } else {
        // Normal movement.
        applyNormalPlayerVelocity(player, vel, input.moveX, input.moveY, dt);
      }

      // Apply velocity
      integratePlayerVelocity(transform, vel, dt);

      // iframes
      if (health && health.iframes > 0) {
        health.iframes -= dt;
      }
    }
  },
};
