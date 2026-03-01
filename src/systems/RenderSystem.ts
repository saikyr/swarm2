import type { World } from '../ecs/ecs';
import type { CanvasContext } from '../rendering/canvas';
import { TRANSFORM, RENDERABLE, DAMAGE_FLASH, TRAIL, DAMAGE_NUMBER, SWEEP_ATTACK, NOVA_ATTACK, ENEMY, PARTICLE, HEALTH, PLAYER, ORBITAL, GROUND_ZONE, RUNE_CHARGE, REVIVE_ZONE } from '../components';
import type { Transform, Renderable, DamageFlash, Trail, DamageNumberData, SweepAttack, NovaAttack, Enemy, Health, OrbitalProjectile, GroundZone, RuneCharge, Player, ReviveZone } from '../components';
import { drawCircle, drawDiamond, drawTriangle, drawSquare, drawRing, drawArc, drawArcBand, drawPolyline } from '../rendering/shapes';
import { getActiveBeamFx, type BeamFxEntry } from '../rendering/particles';
import { getCameraPos } from './CameraSystem';
import type { ScreenShake } from '../rendering/effects';
import { BG_COLOR, GRID_COLOR, GRID_SIZE, WORLD_WIDTH, WORLD_HEIGHT, EliteAffix } from '../constants';
import { lerp } from '../utils/math';

// Reusable sort array to avoid per-frame allocation
let sortBuffer: { entity: number; zIndex: number }[] = [];

export function render(
  world: World,
  cc: CanvasContext,
  alpha: number,
  shake: ScreenShake,
): void {
  const { ctx, width, height } = cc;
  const now = Date.now();

  // Reset transform (devicePixelRatio scaling)
  ctx.setTransform(cc.dpr, 0, 0, cc.dpr, 0, 0);

  // Clear
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // Camera offset (interpolated between ticks for smooth movement)
  const cam = getCameraPos(alpha);
  const camX = cam.x - width / 2 + shake.offsetX;
  const camY = cam.y - height / 2 + shake.offsetY;

  ctx.save();
  ctx.translate(-camX, -camY);

  // Draw grid
  drawGrid(ctx, camX, camY, width, height);

  // Draw world border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Draw ground zones (below entities)
  for (const entity of world.query(GROUND_ZONE, TRANSFORM)) {
    const zone = world.getComponent<GroundZone>(entity, GROUND_ZONE)!;
    const zoneT = world.getComponent<Transform>(entity, TRANSFORM)!;
    const zx = zoneT.pos.x;
    const zy = zoneT.pos.y;

    // Pulsing fill
    const pulse = 0.15 + Math.sin(now * 0.006) * 0.1;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = zone.color;
    ctx.beginPath();
    ctx.arc(zx, zy, zone.radius, 0, Math.PI * 2);
    ctx.fill();

    // Ring outline
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zx, zy, zone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Draw revive zones (below entities)
  for (const entity of world.query(REVIVE_ZONE, TRANSFORM)) {
    const rz = world.getComponent<ReviveZone>(entity, REVIVE_ZONE)!;
    const rzT = world.getComponent<Transform>(entity, TRANSFORM)!;
    const rx = rzT.pos.x;
    const ry = rzT.pos.y;

    // Pulsing fill
    const pulse = 0.1 + Math.sin(now * 0.004) * 0.05;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#44ffaa';
    ctx.beginPath();
    ctx.arc(rx, ry, rz.radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#44ffaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, rz.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Progress ring (fills clockwise)
    if (rz.progress > 0) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(rx, ry, rz.radius - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rz.progress);
      ctx.stroke();
    }

    // "Reviving..." text when someone is in zone
    if (rz.reviverInZone) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Reviving... ${Math.floor(rz.progress * 100)}%`, rx, ry - rz.radius - 8);
    } else if (rz.progress > 0) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffaa44';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Hold to revive', rx, ry - rz.radius - 8);
    }

    ctx.globalAlpha = 1;
  }

  // Gather and sort entities by zIndex — reuse buffer
  const renderables = world.query(TRANSFORM, RENDERABLE);
  const count = renderables.length;

  // Grow buffer if needed
  while (sortBuffer.length < count) {
    sortBuffer.push({ entity: 0, zIndex: 0 });
  }

  for (let i = 0; i < count; i++) {
    const e = renderables[i];
    sortBuffer[i].entity = e;
    sortBuffer[i].zIndex = world.getComponent<Renderable>(e, RENDERABLE)!.zIndex;
  }

  // Sort only the portion we're using (in-place, no .slice())
  const usedBuffer = sortBuffer;
  for (let i = 1; i < count; i++) {
    const key = usedBuffer[i];
    let j = i - 1;
    while (j >= 0 && usedBuffer[j].zIndex > key.zIndex) {
      usedBuffer[j + 1] = usedBuffer[j];
      j--;
    }
    usedBuffer[j + 1] = key;
  }

  // Frustum bounds
  const cullMinX = camX - 50;
  const cullMaxX = camX + width + 50;
  const cullMinY = camY - 50;
  const cullMaxY = camY + height + 50;

  // Collect elite entities to draw health bars after main pass (to render on top)
  const eliteEntities: number[] = [];
  const elitePositions: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    const entity = usedBuffer[i].entity;
    const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
    const renderable = world.getComponent<Renderable>(entity, RENDERABLE)!;

    // Interpolate position
    const x = lerp(transform.prevPos.x, transform.pos.x, alpha);
    const y = lerp(transform.prevPos.y, transform.pos.y, alpha);

    // Update rotation for spinning projectiles
    if (renderable.rotationSpeed) {
      transform.rotation += renderable.rotationSpeed * 0.016;
    }

    // Frustum cull
    if (x < cullMinX || x > cullMaxX || y < cullMinY || y > cullMaxY) {
      continue;
    }

    // Draw trail
    const trail = world.getComponent<Trail>(entity, TRAIL);
    if (trail && trail.positions.length > 1) {
      drawTrail(ctx, trail, renderable.alpha);
    }

    // Check if this is a downed player — render with reduced alpha
    const isPlayer = world.hasComponent(entity, PLAYER);
    const playerComp = isPlayer ? world.getComponent<Player>(entity, PLAYER) : null;
    const isDowned = playerComp?.downed === true;

    ctx.globalAlpha = isDowned ? 0.3 : renderable.alpha;

    // Damage flash: draw white
    const flash = world.getComponent<DamageFlash>(entity, DAMAGE_FLASH);
    const fillColor = flash ? '#ffffff' : (isDowned ? '#888888' : renderable.color);

    // Elite visuals
    const enemy = world.getComponent<Enemy>(entity, ENEMY);
    if (enemy?.isElite) {
      // Elite base pulse glow — apply shadow for this draw only
      const pulseSize = renderable.radius * 1.8 + Math.sin(now * 0.005) * 4;
      ctx.shadowColor = '#ffcc44';
      ctx.shadowBlur = 20;
      drawCircle(ctx, x, y, pulseSize, 'rgba(255, 204, 68, 0.1)');
      ctx.shadowBlur = 0;

      // Shielded affix: cyan ring
      if (enemy.affixes.includes(EliteAffix.Shielded)) {
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, renderable.radius * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = renderable.alpha;
      }

      // Explosive affix: pulsing red glow (no shadow)
      if (enemy.affixes.includes(EliteAffix.Explosive)) {
        const glowSize = renderable.radius * 1.4 + Math.sin(now * 0.008) * 3;
        ctx.globalAlpha = 0.2;
        drawCircle(ctx, x, y, glowSize, 'rgba(255, 50, 0, 0.2)');
        ctx.globalAlpha = renderable.alpha;
      }

      // Track for health bar pass
      eliteEntities.push(entity);
      elitePositions.push({ x, y });
    }

    // Player gets shadow glow
    if (isPlayer) {
      ctx.shadowColor = renderable.glowColor || renderable.color;
      ctx.shadowBlur = renderable.glowSize || 10;
    }

    // Apply rotation for shapes with rotationSpeed
    const hasRotation = renderable.rotationSpeed && (renderable.shape === 'diamond' || renderable.shape === 'square');
    if (hasRotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(transform.rotation);
      ctx.translate(-x, -y);
    }

    switch (renderable.shape) {
      case 'circle':
        drawCircle(ctx, x, y, renderable.radius, fillColor);
        break;
      case 'diamond':
        drawDiamond(ctx, x, y, renderable.radius, fillColor);
        break;
      case 'triangle':
        drawTriangle(ctx, x, y, renderable.radius, fillColor, transform.rotation - Math.PI / 2);
        break;
      case 'square':
        drawSquare(ctx, x, y, renderable.radius, fillColor);
        break;
      case 'ring':
        drawRing(ctx, x, y, renderable.radius, fillColor, 2);
        break;
    }

    if (hasRotation) {
      ctx.restore();
    }

    // Orbital outer ring stroke
    const orbital = world.getComponent<OrbitalProjectile>(entity, ORBITAL);
    if (orbital) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = renderable.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, renderable.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = renderable.alpha;
    }

    // Rune charge: draw blast radius preview ring
    const rune = world.getComponent<RuneCharge>(entity, RUNE_CHARGE);
    if (rune && !rune.detonated) {
      const chargeProgress = Math.min(1, rune.timer / rune.chargeTime);
      ctx.globalAlpha = 0.15 + chargeProgress * 0.15;
      ctx.strokeStyle = rune.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, rune.blastRadius * chargeProgress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = renderable.alpha;
    }

    // Reset shadow after player draw
    if (isPlayer) {
      ctx.shadowBlur = 0;

      // Draw player number label above player
      if (playerComp) {
        ctx.globalAlpha = isDowned ? 0.3 : 1;
        ctx.fillStyle = isDowned ? '#888888' : renderable.color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`P${playerComp.playerId + 1}`, x, y - renderable.radius - 8);
        if (isDowned) {
          ctx.fillStyle = '#ff4444';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('DOWNED', x, y + renderable.radius + 14);
        }
      }
    }

    ctx.globalAlpha = 1.0;
  }

  // Draw elite health bars and names (on top of all entities)
  for (let i = 0; i < eliteEntities.length; i++) {
    const entity = eliteEntities[i];
    const enemy2 = world.getComponent<Enemy>(entity, ENEMY)!;
    const health = world.getComponent<Health>(entity, HEALTH);
    const renderable2 = world.getComponent<Renderable>(entity, RENDERABLE)!;
    if (!health) continue;

    const ex = elitePositions[i].x;
    const ey = elitePositions[i].y;

    const barW = 50;
    const barH = 5;
    // Stack upward: bar → name → affixes, all well above the enemy sprite
    const barY2 = ey - renderable2.radius - 22;

    // Health bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(ex - barW / 2 - 1, barY2 - 1, barW + 2, barH + 2);

    // Health bar fill
    const hpPct = Math.max(0, health.current / health.max);
    ctx.fillStyle = hpPct > 0.5 ? '#ff4444' : hpPct > 0.25 ? '#ff8800' : '#ff2222';
    ctx.fillRect(ex - barW / 2, barY2, barW * hpPct, barH);

    // Elite name above bar
    let labelY = barY2 - 5;
    ctx.textAlign = 'center';
    if (enemy2.eliteName) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(enemy2.eliteName, ex, labelY);
      labelY -= 12;
    }

    // Affix tags above the name — readable short names with color coding
    if (enemy2.affixes.length > 0) {
      const affixColors: Record<string, string> = {
        fast: '#ffaa00', tough: '#88aaff', splitting: '#ff66ff',
        teleporter: '#cc66ff', shielded: '#00ddff',
        explosive: '#ff4400', chilling: '#88eeff',
      };
      const affixLabels: Record<string, string> = {
        fast: 'Fast', tough: 'Tough', splitting: 'Split',
        teleporter: 'Tele', shielded: 'Shield',
        explosive: 'Boom', chilling: 'Chill',
      };
      ctx.font = 'bold 8px monospace';
      const totalWidth = enemy2.affixes.reduce((sum, a) => sum + ctx.measureText(affixLabels[a] || a).width + 6, -6);
      let ax = ex - totalWidth / 2;
      for (const affix of enemy2.affixes) {
        const label = affixLabels[affix] || affix;
        ctx.fillStyle = affixColors[affix] || '#ccc';
        ctx.textAlign = 'left';
        ctx.fillText(label, ax, labelY);
        ax += ctx.measureText(label).width + 6;
      }
    }
  }

  // Draw sweep attacks (arc band)
  for (const entity of world.query(SWEEP_ATTACK, TRANSFORM)) {
    const sweep = world.getComponent<SweepAttack>(entity, SWEEP_ATTACK)!;
    const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
    const progress = sweep.timer / sweep.duration;
    const alpha2 = 0.55 * (1 - progress);
    const innerR = sweep.range * 0.3;
    drawArcBand(ctx, transform.pos.x, transform.pos.y,
      innerR, sweep.range,
      sweep.angle - sweep.arc / 2, sweep.angle + sweep.arc / 2,
      '#e0f0ff', '#ffffff', alpha2);
  }

  // Draw nova attacks
  for (const entity of world.query(NOVA_ATTACK, TRANSFORM)) {
    const nova = world.getComponent<NovaAttack>(entity, NOVA_ATTACK)!;
    const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
    const progress = nova.timer / nova.duration;
    const nx = transform.pos.x;
    const ny = transform.pos.y;
    const fadeAlpha = 1 - progress;

    // Primary ring (thicker)
    drawRing(ctx, nx, ny, nova.radius, nova.color, 4 * fadeAlpha);

    // Echo ring at 72% radius
    ctx.globalAlpha = 0.4 * fadeAlpha;
    drawRing(ctx, nx, ny, nova.radius * 0.72, nova.color, 2 * fadeAlpha);
    ctx.globalAlpha = 1;

    // Frost nova ice crystal lines (detect by color)
    const isFrost = nova.color === '#88eeff' || nova.color === '#44bbff';
    if (isFrost && nova.radius > 5) {
      const crystalCount = 8;
      ctx.save();
      ctx.globalAlpha = 0.6 * fadeAlpha;
      ctx.strokeStyle = '#ccf4ff';
      ctx.lineWidth = 1.5;
      for (let ci = 0; ci < crystalCount; ci++) {
        const a = (ci / crystalCount) * Math.PI * 2;
        const r0 = nova.radius * 0.85;
        const r1 = nova.radius * 1.05;
        ctx.beginPath();
        ctx.moveTo(nx + Math.cos(a) * r0, ny + Math.sin(a) * r0);
        ctx.lineTo(nx + Math.cos(a) * r1, ny + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Draw chain lightning beam FX
  const beams = getActiveBeamFx();
  for (let i = beams.length - 1; i >= 0; i--) {
    const beam = beams[i];
    beam.timer -= 0.016; // approximate dt
    if (beam.timer <= 0) {
      beams.splice(i, 1);
      continue;
    }
    const beamAlpha = beam.timer / beam.duration;
    drawPolyline(ctx, beam.points, '#ffff44', 3.5, beamAlpha * 0.8);
    drawPolyline(ctx, beam.points, '#ffffff', 1.2, beamAlpha);
  }

  // Draw damage numbers
  for (const entity of world.query(DAMAGE_NUMBER, TRANSFORM)) {
    const dmgNum = world.getComponent<DamageNumberData>(entity, DAMAGE_NUMBER)!;
    const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
    const progress = dmgNum.timer / dmgNum.duration;
    const alpha3 = 1 - progress;

    ctx.globalAlpha = alpha3;
    ctx.fillStyle = dmgNum.color;
    ctx.font = `bold ${dmgNum.fontSize}px monospace`;
    ctx.textAlign = 'center';
    if (dmgNum.isCrit) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
    }
    ctx.fillText(Math.round(dmgNum.value).toString(), transform.pos.x, transform.pos.y);
    if (dmgNum.isCrit) {
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1.0;
  }

  ctx.restore(); // End camera transform
}

function drawGrid(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;

  const startX = Math.floor(camX / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(camY / GRID_SIZE) * GRID_SIZE;

  ctx.beginPath();
  for (let x = startX; x < camX + w + GRID_SIZE; x += GRID_SIZE) {
    if (x < 0 || x > WORLD_WIDTH) continue;
    ctx.moveTo(x, Math.max(0, camY));
    ctx.lineTo(x, Math.min(WORLD_HEIGHT, camY + h));
  }
  for (let y = startY; y < camY + h + GRID_SIZE; y += GRID_SIZE) {
    if (y < 0 || y > WORLD_HEIGHT) continue;
    ctx.moveTo(Math.max(0, camX), y);
    ctx.lineTo(Math.min(WORLD_WIDTH, camX + w), y);
  }
  ctx.stroke();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: Trail, baseAlpha: number): void {
  if (trail.positions.length < 2) return;
  // Index 0 = oldest, index length-1 = newest
  // Skip the newest position (it's the current entity position)
  for (let i = 0; i < trail.positions.length - 1; i++) {
    const p = trail.positions[i];
    const t = i / trail.positions.length;
    const alpha = baseAlpha * t * 0.4;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = trail.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, trail.width * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}
