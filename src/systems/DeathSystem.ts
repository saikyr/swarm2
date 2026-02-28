import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';

// Death handling is done in HealthSystem. This is a placeholder for additional
// death-related logic (e.g., splitting elites, explosive death).
export const DeathSystem: System = {
  name: 'DeathSystem',
  update(_world: World, _dt: number) {
    // Intentionally empty - death logic is in HealthSystem
  },
};
