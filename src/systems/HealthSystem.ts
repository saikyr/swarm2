import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { HEALTH, ENEMY, PLAYER, TRANSFORM, COLLIDER, RENDERABLE, PICKUP, VELOCITY, NOVA_ATTACK, LIFETIME, REVIVE_ZONE, CollisionLayer } from '../components';
import type { Health, Enemy, Player, Transform, Collider, Renderable, NovaAttack, Lifetime, ReviveZone } from '../components';
import { emitParticles } from '../rendering/particles';
import { addScreenShake, triggerHitPause, type ScreenShake, type HitPause } from '../rendering/effects';
import { PARTICLE_DEATH_COUNT_MIN, PARTICLE_DEATH_COUNT_MAX, HIT_PAUSE_DURATION, EliteAffix, EnemyType, EnemyAIState } from '../constants';

export let screenShakeRef: ScreenShake | null = null;
export let hitPauseRef: HitPause | null = null;
export function setHealthSystemRefs(s: ScreenShake, h: HitPause): void {
  screenShakeRef = s;
  hitPauseRef = h;
}

export const HealthSystem: System = {
  name: 'HealthSystem',
  update(world: World, _dt: number) {
    // Check enemy deaths
    for (const entity of world.query(HEALTH, ENEMY, TRANSFORM)) {
      const health = world.getComponent<Health>(entity, HEALTH)!;
      if (health.current <= 0) {
        const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
        const renderable = world.getComponent<Renderable>(entity, RENDERABLE);
        const enemy = world.getComponent<Enemy>(entity, ENEMY)!;

        // Death particles
        const color = renderable?.color ?? '#ff4444';
        const count = PARTICLE_DEATH_COUNT_MIN + Math.floor(Math.random() * (PARTICLE_DEATH_COUNT_MAX - PARTICLE_DEATH_COUNT_MIN));
        emitParticles(world, transform.pos.x, transform.pos.y, count, color, {
          speed: 120,
          speedVar: 60,
          life: 0.4,
          lifeVar: 0.15,
          size: 3,
        });

        // Screen shake for elite kills
        if (enemy.isElite && screenShakeRef) {
          addScreenShake(screenShakeRef, 12);
          if (hitPauseRef) triggerHitPause(hitPauseRef, HIT_PAUSE_DURATION);
        }

        // Explosive affix: spawn death nova
        if (enemy.affixes.includes(EliteAffix.Explosive)) {
          const novaEntity = world.createEntity();
          world.addComponent<Transform>(novaEntity, TRANSFORM, {
            pos: { ...transform.pos }, prevPos: { ...transform.pos }, rotation: 0,
          });
          world.addComponent<NovaAttack>(novaEntity, NOVA_ATTACK, {
            radius: 0, maxRadius: 100, damage: enemy.damage * 2,
            timer: 0, duration: 0.3, owner: entity,
            hitEntities: new Set(), color: '#ff4400',
            isEnemyOwned: true,
          });
          world.addComponent<Lifetime>(novaEntity, LIFETIME, { remaining: 0.3 });
        }

        // Necromancer death: kill all its spawned minions
        if (enemy.type === EnemyType.Necromancer) {
          for (const otherEntity of world.query(ENEMY)) {
            const otherEnemy = world.getComponent<Enemy>(otherEntity, ENEMY);
            if (otherEnemy && otherEnemy.spawnOwner === entity) {
              const otherHealth = world.getComponent<Health>(otherEntity, HEALTH);
              if (otherHealth) otherHealth.current = 0;
            }
          }
        }

        // Splitting affix: spawn 2 smaller copies
        // Necromancers that split become Swarm to prevent recursive summoners
        if (enemy.affixes.includes(EliteAffix.Splitting)) {
          const splitType = enemy.type === EnemyType.Necromancer ? EnemyType.Swarm : enemy.type;
          for (let i = 0; i < 2; i++) {
            const splitEntity = world.createEntity();
            const offsetX = (Math.random() - 0.5) * 30;
            const offsetY = (Math.random() - 0.5) * 30;
            const splitRadius = (renderable?.radius ?? 10) * 0.7;

            world.addComponent<Transform>(splitEntity, TRANSFORM, {
              pos: { x: transform.pos.x + offsetX, y: transform.pos.y + offsetY },
              prevPos: { x: transform.pos.x + offsetX, y: transform.pos.y + offsetY },
              rotation: 0,
            });
            world.addComponent(splitEntity, VELOCITY, { x: 0, y: 0 });
            world.addComponent<Health>(splitEntity, HEALTH, {
              current: health.max * 0.3, max: health.max * 0.3, iframes: 0.2, lastHitBy: health.lastHitBy,
            });
            world.addComponent<Collider>(splitEntity, COLLIDER, {
              radius: splitRadius,
              layer: CollisionLayer.Enemy,
              mask: [CollisionLayer.PlayerProjectile],
            });
            world.addComponent<Renderable>(splitEntity, RENDERABLE, {
              shape: renderable?.shape ?? 'circle',
              radius: splitRadius,
              color: color,
              glowColor: color,
              glowSize: 6,
              alpha: 1,
              zIndex: 2,
            });
            world.addComponent<Enemy>(splitEntity, ENEMY, {
              type: splitType,
              speed: enemy.speed * 1.2,
              damage: enemy.damage * 0.3,
              xpValue: 1,
              isElite: false,
              affixes: [],
              attackCooldown: 1,
              attackTimer: 0,
              eliteName: '',
              aiState: EnemyAIState.Chase,
              aiStateTimer: 0,
              preferredRange: 0,
              projectileSpeed: 0,
              projectileDamage: 0,
              spawnOwner: 0,
            });
          }
        }

        // Credit kill to the player who dealt the killing blow
        const killer = health.lastHitBy || world.query(PLAYER)[0];
        if (killer !== undefined) {
          const p = world.getComponent<Player>(killer, PLAYER);
          if (p) p.kills++;
        }

        // Spawn XP orb
        spawnXpOrb(world, transform.pos.x, transform.pos.y, enemy.xpValue);

        // Rare drops: health pickup and XP magnet, elites have higher chance
        const dropRoll = Math.random();
        const healthChance = enemy.isElite ? 0.15 : 0.015;
        const magnetChance = enemy.isElite ? 0.05 : 0.005;
        if (dropRoll < healthChance) {
          spawnHealthPickup(world, transform.pos.x, transform.pos.y);
        } else if (dropRoll < healthChance + magnetChance) {
          spawnMagnetPickup(world, transform.pos.x, transform.pos.y);
        }

        world.destroyEntity(entity);
      }
    }

    // Check player death — enter downed state instead of destroying
    const allPlayers = world.query(HEALTH, PLAYER, TRANSFORM);
    const isMultiplayer = allPlayers.length > 1;
    for (const entity of allPlayers) {
      const health = world.getComponent<Health>(entity, HEALTH)!;
      const player = world.getComponent<Player>(entity, PLAYER)!;
      if (health.current <= 0 && !player.downed) {
        health.current = 0;
        player.downed = true;

        // Only spawn revive zone in multiplayer (another player can revive)
        if (isMultiplayer) {
          const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
          const rzEntity = world.createEntity();
          world.addComponent<Transform>(rzEntity, TRANSFORM, {
            pos: { ...transform.pos },
            prevPos: { ...transform.pos },
            rotation: 0,
          });
          world.addComponent<ReviveZone>(rzEntity, REVIVE_ZONE, {
            targetEntity: entity,
            radius: 80,
            progress: 0,
            reviveTime: 3,
            reviverInZone: false,
          });
        }
      }
    }
  },
};

function spawnHealthPickup(world: World, x: number, y: number): void {
  const entity = world.createEntity();
  const offsetX = (Math.random() - 0.5) * 16;
  const offsetY = (Math.random() - 0.5) * 16;
  world.addComponent(entity, TRANSFORM, {
    pos: { x: x + offsetX, y: y + offsetY },
    prevPos: { x: x + offsetX, y: y + offsetY },
    rotation: 0,
  });
  world.addComponent(entity, RENDERABLE, {
    shape: 'diamond',
    radius: 6,
    color: '#ff4466',
    glowColor: '#ff4466',
    glowSize: 10,
    alpha: 1,
    zIndex: 1,
  });
  world.addComponent(entity, COLLIDER, {
    radius: 6,
    layer: CollisionLayer.Pickup,
    mask: [CollisionLayer.Player],
  });
  world.addComponent(entity, PICKUP, {
    type: 'health',
    value: 15,
    magnetRadius: 50,
    pickupRadius: 8,
    attracted: false,
  });
}

function spawnMagnetPickup(world: World, x: number, y: number): void {
  const entity = world.createEntity();
  world.addComponent(entity, TRANSFORM, {
    pos: { x, y },
    prevPos: { x, y },
    rotation: 0,
  });
  world.addComponent(entity, RENDERABLE, {
    shape: 'circle',
    radius: 7,
    color: '#ffdd44',
    glowColor: '#ffdd44',
    glowSize: 14,
    alpha: 1,
    zIndex: 1,
  });
  world.addComponent(entity, COLLIDER, {
    radius: 7,
    layer: CollisionLayer.Pickup,
    mask: [CollisionLayer.Player],
  });
  world.addComponent(entity, PICKUP, {
    type: 'magnet',
    value: 0,
    magnetRadius: 60,
    pickupRadius: 10,
    attracted: false,
  });
}

function spawnXpOrb(world: World, x: number, y: number, value: number): void {
  const entity = world.createEntity();
  const offsetX = (Math.random() - 0.5) * 20;
  const offsetY = (Math.random() - 0.5) * 20;
  world.addComponent(entity, TRANSFORM, {
    pos: { x: x + offsetX, y: y + offsetY },
    prevPos: { x: x + offsetX, y: y + offsetY },
    rotation: 0,
  });
  world.addComponent(entity, RENDERABLE, {
    shape: 'circle',
    radius: 4,
    color: '#44ff88',
    glowColor: '#44ff88',
    glowSize: 8,
    alpha: 1,
    zIndex: 1,
  });
  world.addComponent(entity, COLLIDER, {
    radius: 4,
    layer: CollisionLayer.Pickup,
    mask: [CollisionLayer.Player],
  });
  world.addComponent(entity, PICKUP, {
    type: 'xp',
    value,
    magnetRadius: 40,
    pickupRadius: 6,
    attracted: false,
  });
}
