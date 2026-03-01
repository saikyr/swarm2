import type { CanvasContext } from './canvas';
import type { Player, Health, Transform, Weapon } from '../components';
import { TRANSFORM, ENEMY, PICKUP } from '../components';
import { RARITY_COLORS, type Rarity, WORLD_WIDTH, WORLD_HEIGHT } from '../constants';
import type { RunContext } from '../game/run';
import type { Vec2 } from '../utils/math';
import type { World } from '../ecs/ecs';
import type { Lobby } from '../game/lobby';
import { isTouchDevice } from '../input/touch';
import { WEAPON_UNLOCK_LEVELS } from '../game/player-manager';

/** Portrait phone: narrow width + touch */
function isNarrow(width: number): boolean {
  return isTouchDevice && width < 600;
}

/** Any touch device (portrait or landscape) */
function isTouch(): boolean {
  return isTouchDevice;
}

export function getUpgradeCardLayout(width: number, height: number, cardCount: number) {
  const narrow = isNarrow(width);
  const short = height < 500;
  if (narrow) {
    const cardW = Math.min(width - 40, 160);
    const cardH = 120;
    const gap = 10;
    const startX = (width - cardW) / 2;
    const startY = height / 2 - (cardCount * (cardH + gap)) / 2;
    return { cardW, cardH, gap, startX, startY, vertical: true };
  }
  const cardW = 180, cardH = short ? 160 : 200, gap = short ? 12 : 20;
  const totalW = cardCount * cardW + (cardCount - 1) * gap;
  const startX = (width - totalW) / 2;
  const startY = height / 2 - (short ? 50 : 80);
  return { cardW, cardH, gap, startX, startY, vertical: false };
}

export function getClassCardLayout(width: number, height: number) {
  const narrow = isNarrow(width);
  const short = height < 500;
  const cardW = narrow ? Math.min(Math.floor(width / 2) - 20, 160) : 200;
  const gap = narrow ? 10 : 40;
  const cardH = narrow ? 150 : (short ? 140 : 180);
  const totalW = 2 * cardW + gap;
  const startX = (width - totalW) / 2;
  const cardY = height / 2 - (narrow ? 40 : (short ? 40 : 60));
  return { cardW, cardH, gap, totalW, startX, cardY, narrow };
}

function getMenuButtonWidth(width: number): number {
  return isNarrow(width) ? Math.min(width - 40, 220) : 220;
}

function drawMenuButton(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  label: string, color: string, bgColor: string,
): void {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
  ctx.textBaseline = 'alphabetic';
}

export interface UpgradeCard {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  type?: 'stat' | 'weapon_levelup' | 'overclock' | 'weapon_unlock';
  weaponId?: string;
  weaponName?: string;
  overclockTier?: 'balanced' | 'unstable';
  targetTag?: string;
  apply: () => void;
}

export interface MinimapData {
  players: Array<{ pos: { x: number; y: number }; color: string }>;
  world: World;
}

export function drawHUD(
  cc: CanvasContext,
  player: Player,
  health: Health,
  run: RunContext,
  minimap?: MinimapData,
  weaponSlots?: Weapon[]
): void {
  const { ctx, width } = cc;
  const mobile = isNarrow(width);
  ctx.save();

  // HP bar
  const barW = mobile ? 140 : 200;
  const barH = 12;
  const barX = 20;
  const barY = 20;
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barW, barH);
  const hpPct = health.current / health.max;
  ctx.fillStyle = hpPct > 0.5 ? '#44ff44' : hpPct > 0.25 ? '#ffaa00' : '#ff4444';
  ctx.fillRect(barX, barY, barW * hpPct, barH);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // HP text
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`HP: ${Math.ceil(health.current)}/${health.max}`, barX, barY + barH + 14);

  // XP bar
  const xpY = barY + barH + 24;
  ctx.fillStyle = '#222';
  ctx.fillRect(barX, xpY, barW, 8);
  const xpPct = player.xp / player.xpToNext;
  ctx.fillStyle = '#8844ff';
  ctx.fillRect(barX, xpY, barW * xpPct, 8);

  // Level
  ctx.fillStyle = '#ccc';
  ctx.font = '12px monospace';
  ctx.fillText(`Lv. ${player.level}`, barX, xpY + 20);

  // Timer
  const mins = Math.floor(run.timer / 60);
  const secs = Math.floor(run.timer % 60);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, width / 2, 24);

  // Kills (offset from pause button on touch devices)
  const touch = isTouch();
  const statsX = touch ? width - 70 : width - 20;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#888';
  ctx.font = `${touch ? 10 : 12}px monospace`;
  ctx.fillText(`Kills: ${player.kills}`, statsX, 24);
  ctx.fillText(`Wave: ${run.wave}`, statsX, 42);

  // Dash cooldown indicator
  const dashReady = player.dashCooldownTimer <= 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = dashReady ? '#00ffff' : '#444';
  ctx.font = '11px monospace';
  const dashLabel = touch ? 'Dash' : '[SPACE] Dash';
  const dashText = dashReady ? dashLabel : `${dashLabel} ${(player.dashCooldownTimer).toFixed(1)}s`;
  ctx.fillText(dashText, barX, xpY + 40);

  // Weapon slots HUD (bottom-left)
  if (weaponSlots && weaponSlots.length > 0) {
    drawWeaponSlots(ctx, weaponSlots, width, cc.height);
  }

  // Minimap
  if (minimap) {
    drawMinimap(ctx, width, cc.height, minimap);
  }

  ctx.restore();
}

function drawWeaponSlots(ctx: CanvasRenderingContext2D, slots: Weapon[], screenW: number, screenH: number): void {
  const mobile = isTouch();
  const slotW = mobile ? 100 : 150;
  const slotH = mobile ? 24 : 32;
  const gap = mobile ? 3 : 4;
  const fontSize = mobile ? 9 : 11;
  const startX = 16;
  const startY = screenH - (slots.length * (slotH + gap)) - 10;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const y = startY + i * (slotH + gap);

    // Background
    ctx.fillStyle = slot.locked ? '#111' : '#1a1a2e';
    ctx.strokeStyle = slot.locked ? '#333' : '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(startX, y, slotW, slotH, 4);
    ctx.fill();
    ctx.stroke();

    if (slot.locked) {
      ctx.fillStyle = '#555';
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      const unlockLv = WEAPON_UNLOCK_LEVELS[i] ?? '?';
      ctx.fillText(`Unlocks Lv.${unlockLv}`, startX + slotW / 2, y + slotH / 2 + 4);
      continue;
    }

    // Cooldown bar overlay
    const cdPct = slot.cooldown > 0 ? Math.max(0, slot.cooldownTimer / slot.cooldown) : 0;
    if (cdPct > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.roundRect(startX, y, slotW * cdPct, slotH, 4);
      ctx.fill();
      ctx.restore();
    }

    // Weapon color indicator bar
    ctx.fillStyle = slot.projectileColor;
    ctx.fillRect(startX + 4, y + (mobile ? 4 : 6), 3, slotH - (mobile ? 8 : 12));

    // Name · Lv.N — dynamic font size to fit
    const nameY = y + (mobile ? 10 : 13);
    const maxNameW = slotW - 18 - (slot.overclocks.length > 0 ? (mobile ? 28 : 32) : 0);
    const nameLvText = `${slot.name} · Lv.${slot.level}`;
    let nameFontSize = fontSize;
    ctx.font = `bold ${nameFontSize}px monospace`;
    while (nameFontSize > 7 && ctx.measureText(nameLvText).width > maxNameW) {
      nameFontSize--;
      ctx.font = `bold ${nameFontSize}px monospace`;
    }
    ctx.fillStyle = cdPct > 0 ? '#888' : '#ddd';
    ctx.textAlign = 'left';
    ctx.fillText(slot.name, startX + 12, nameY);
    // Level suffix in lighter color at same font size
    const nameW = ctx.measureText(slot.name).width;
    ctx.fillStyle = '#666';
    ctx.font = `${nameFontSize}px monospace`;
    ctx.fillText(` · Lv.${slot.level}`, startX + 12 + nameW, nameY);

    // OC badge on name row (right-aligned)
    if (slot.overclocks.length > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = `${mobile ? 8 : 9}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`OC×${slot.overclocks.length}`, startX + slotW - 6, nameY);
    }

    // Tags on second row — dynamic font size to fit
    if (slot.tags.length > 0) {
      const tagText = slot.tags.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
      const maxTagW = slotW - 18;
      let tagFontSize = mobile ? 8 : 9;
      ctx.font = `${tagFontSize}px monospace`;
      while (tagFontSize > 6 && ctx.measureText(tagText).width > maxTagW) {
        tagFontSize--;
        ctx.font = `${tagFontSize}px monospace`;
      }
      ctx.fillStyle = '#555';
      ctx.textAlign = 'left';
      ctx.fillText(tagText, startX + 12, y + (mobile ? 20 : 25));
    }
  }
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  screenW: number, screenH: number,
  data: MinimapData,
): void {
  const touch = isTouch();
  const mapSize = touch ? 70 : 100;
  const mapX = screenW - mapSize - 12;
  const mapY = screenH - mapSize - 12;
  const scaleX = mapSize / WORLD_WIDTH;
  const scaleY = mapSize / WORLD_HEIGHT;

  ctx.save();

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#111';
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
  ctx.globalAlpha = 1;

  // Draw enemies directly from world to avoid allocating position arrays
  ctx.fillStyle = '#ff4444';
  for (const e of data.world.query(ENEMY, TRANSFORM)) {
    const t = data.world.getComponent<Transform>(e, TRANSFORM)!;
    const ex = mapX + t.pos.x * scaleX;
    const ey = mapY + t.pos.y * scaleY;
    ctx.fillRect(ex - 0.5, ey - 0.5, 1, 1);
  }

  // Draw pickups directly from world
  ctx.fillStyle = '#44ff88';
  for (const p of data.world.query(PICKUP, TRANSFORM)) {
    const t = data.world.getComponent<Transform>(p, TRANSFORM)!;
    const px = mapX + t.pos.x * scaleX;
    const py = mapY + t.pos.y * scaleY;
    ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
  }

  // Draw all players on minimap
  for (const player of data.players) {
    ctx.fillStyle = player.color;
    const px = mapX + player.pos.x * scaleX;
    const py = mapY + player.pos.y * scaleY;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawUpgradeMenu(
  cc: CanvasContext,
  cards: UpgradeCard[],
  selectedIndex: number,
): void {
  const { ctx, width, height } = cc;
  ctx.save();

  // Overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, width, height);

  // Layout
  const layout = getUpgradeCardLayout(width, height, cards.length);
  const { cardW, cardH, gap, startX, startY, vertical } = layout;
  const mobile = isNarrow(width);
  const compact = height < 500;
  const small = mobile || compact;

  // Title — context-dependent for weapon unlock vs normal upgrade
  const isWeaponUnlock = cards.length > 0 && cards[0].type === 'weapon_unlock';
  ctx.fillStyle = isWeaponUnlock ? '#44aaff' : '#fff';
  ctx.font = `bold ${small ? 20 : 28}px monospace`;
  ctx.textAlign = 'center';
  const titleY = vertical ? startY - 50 : height / 2 - 150;
  ctx.fillText(isWeaponUnlock ? 'NEW WEAPON!' : 'LEVEL UP!', width / 2, compact ? titleY + 20 : titleY);
  ctx.font = `${small ? 11 : 14}px monospace`;
  ctx.fillStyle = '#888';
  const hint = isWeaponUnlock
    ? (isTouchDevice ? 'Tap a weapon to unlock' : 'Choose a weapon to unlock (1/2/3 or arrows + enter)')
    : (isTouchDevice ? 'Tap an upgrade to select' : 'Choose an upgrade (1/2/3 or arrows + enter)');
  ctx.fillText(hint, width / 2, (compact ? titleY + 40 : titleY) + 26);

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const cx = vertical ? startX : startX + i * (cardW + gap);
    const cy = vertical ? startY + i * (cardH + gap) : startY;
    const isSelected = i === selectedIndex;

    // Determine border color and style based on card type
    let borderColor = RARITY_COLORS[card.rarity];
    const bgColor = isSelected ? '#2a2a3a' : '#1a1a2a';
    const borderWidth = isSelected ? 3 : 1.5;

    if (card.type === 'weapon_unlock') {
      borderColor = '#44aaff';
    } else if (card.type === 'weapon_levelup') {
      borderColor = '#44aaff';
    } else if (card.overclockTier === 'balanced') {
      borderColor = '#ffd700';
    } else if (card.overclockTier === 'unstable') {
      borderColor = '#ff4400';
    }

    // Card bg
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    const typeFont = mobile ? '10px monospace' : '12px monospace';

    // Type indicator icon
    if (card.type === 'weapon_unlock') {
      ctx.fillStyle = '#44aaff';
      ctx.font = typeFont;
      ctx.textAlign = 'center';
      ctx.fillText('UNLOCK', cx + cardW / 2, cy + 18);
    } else if (card.type === 'weapon_levelup') {
      ctx.fillStyle = '#44aaff';
      ctx.font = typeFont;
      ctx.textAlign = 'center';
      ctx.fillText('WEAPON', cx + cardW / 2, cy + 18);
    } else if (card.overclockTier === 'balanced') {
      ctx.fillStyle = '#ffd700';
      ctx.font = typeFont;
      ctx.textAlign = 'center';
      ctx.fillText('OVERCLOCK', cx + cardW / 2, cy + 18);
    } else if (card.overclockTier === 'unstable') {
      ctx.fillStyle = '#ff4400';
      ctx.font = typeFont;
      ctx.textAlign = 'center';
      ctx.fillText('UNSTABLE', cx + cardW / 2, cy + 18);
    } else {
      // Rarity label
      ctx.fillStyle = RARITY_COLORS[card.rarity];
      ctx.font = mobile ? '9px monospace' : '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(card.rarity.toUpperCase(), cx + cardW / 2, cy + (mobile ? 18 : 24));
    }

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${mobile ? 11 : 14}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(card.name, cx + cardW / 2, cy + (mobile ? 38 : 50));

    // Description (word wrap, supports newlines for multi-section descriptions)
    const descSections = card.description.split('\n');
    const descFontSize = mobile ? 9 : 11;
    const lineHeight = mobile ? 12 : 16;
    let ly = cy + (mobile ? 52 : 80);
    for (let s = 0; s < descSections.length; s++) {
      if (s > 0) {
        ly += mobile ? 3 : 6;
        ctx.fillStyle = card.type === 'weapon_unlock' ? '#66bbff' : '#ccc';
        ctx.font = `bold ${mobile ? 9 : 10}px monospace`;
      } else {
        ctx.fillStyle = '#aaa';
        ctx.font = `${descFontSize}px monospace`;
      }
      const words = descSections[s].split(' ');
      let line = '';
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > cardW - 20) {
          ctx.fillText(line, cx + cardW / 2, ly);
          line = word + ' ';
          ly += lineHeight;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, cx + cardW / 2, ly);
      ly += lineHeight;
    }

    // Tag badge (bottom of card)
    if (card.targetTag) {
      ctx.fillStyle = '#666';
      ctx.font = mobile ? '8px monospace' : '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[${card.targetTag.charAt(0).toUpperCase() + card.targetTag.slice(1)}]`,
        cx + cardW / 2, cy + cardH - (mobile ? 8 : 30));
    }

    // Keybind
    if (!isTouchDevice) {
      ctx.fillStyle = '#666';
      ctx.font = '12px monospace';
      ctx.fillText(`[${i + 1}]`, cx + cardW / 2, cy + cardH - 16);
    }
  }

  ctx.restore();
}

export function drawGameOver(cc: CanvasContext, run: RunContext, kills: number): void {
  const { ctx, width, height } = cc;
  const mobile = isNarrow(width);
  const btnW = getMenuButtonWidth(width);
  ctx.save();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4444';
  ctx.font = `bold ${mobile ? 28 : 36}px monospace`;
  ctx.fillText('GAME OVER', width / 2, height / 2 - 60);

  const mins = Math.floor(run.timer / 60);
  const secs = Math.floor(run.timer % 60);

  ctx.fillStyle = '#ccc';
  ctx.font = `${mobile ? 13 : 16}px monospace`;
  ctx.fillText(`Survived: ${mins}:${secs.toString().padStart(2, '0')}`, width / 2, height / 2 - 10);
  ctx.fillText(`Kills: ${kills}`, width / 2, height / 2 + 20);
  ctx.fillText(`Wave: ${run.wave}`, width / 2, height / 2 + 50);
  ctx.fillText(`Currency earned: ${run.currencyEarned}`, width / 2, height / 2 + 80);

  if (isTouchDevice) {
    drawMenuButton(ctx, width / 2, height / 2 + 130, btnW, 40, 'CONTINUE', '#888', '#1a1a1a');
  } else {
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Press ENTER to continue', width / 2, height / 2 + 130);
  }

  ctx.restore();
}

export function drawMenu(cc: CanvasContext): void {
  const { ctx, width, height } = cc;
  const mobile = isNarrow(width);
  const btnW = getMenuButtonWidth(width);
  ctx.save();

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffff';
  ctx.font = `bold ${mobile ? 36 : 48}px monospace`;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 20;
  ctx.fillText('SWARM', width / 2, height / 2 - 60);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#888';
  ctx.font = `${mobile ? 11 : 14}px monospace`;
  ctx.fillText('A Vampire Survivors-Style Game', width / 2, height / 2 - 20);

  if (isTouchDevice) {
    drawMenuButton(ctx, width / 2, height / 2 + 30, btnW, 40, 'SOLO PLAY', '#fff', '#222');
    drawMenuButton(ctx, width / 2, height / 2 + 85, btnW, 40, 'MULTIPLAYER', '#00cc88', '#0a1a14');
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText('Press ENTER for Solo', width / 2, height / 2 + 40);

    ctx.fillStyle = '#00cc88';
    ctx.font = '16px monospace';
    ctx.fillText('Press M for Multiplayer', width / 2, height / 2 + 70);
  }

  ctx.fillStyle = '#666';
  ctx.font = `${mobile ? 10 : 12}px monospace`;
  if (isTouchDevice) {
    ctx.fillText('Joystick to move | Auto-aim', width / 2, height / 2 + 130);
    ctx.fillText('Tap DASH to dash', width / 2, height / 2 + 146);
  } else {
    ctx.fillText(
      'WASD to move | Auto-aim weapons | Space to dash',
      width / 2, height / 2 + 110,
    );
  }

  ctx.restore();
}

export function drawLobby(cc: CanvasContext, lobby: Lobby, mode: 'menu' | 'join', input: string, error: string): void {
  const { ctx, width, height } = cc;
  const mobile = isNarrow(width);
  const btnW = getMenuButtonWidth(width);
  ctx.save();

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffff';
  ctx.font = `bold ${mobile ? 24 : 32}px monospace`;
  ctx.fillText('MULTIPLAYER', width / 2, height / 2 - 120);

  if (lobby.roomCode) {
    // Already in a room — show code
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`Room: ${lobby.roomCode}`, width / 2, height / 2 - 60);
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Share this code with friends', width / 2, height / 2 - 35);
  } else if (mode === 'menu') {
    // Host/Join selection
    if (isTouchDevice) {
      drawMenuButton(ctx, width / 2, height / 2 - 20, btnW, 40, 'HOST GAME', '#fff', '#222');
      drawMenuButton(ctx, width / 2, height / 2 + 30, btnW, 40, 'JOIN GAME', '#00cc88', '#0a1a14');
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText('[1] Host a Game', width / 2, height / 2 - 20);
      ctx.fillText('[2] Join a Game', width / 2, height / 2 + 20);
    }
  } else {
    // Join code input screen
    ctx.fillStyle = '#aaa';
    ctx.font = '16px monospace';
    ctx.fillText('Enter room code:', width / 2, height / 2 - 30);

    const boxW = 120;
    const boxH = 36;
    const boxX = width / 2 - boxW / 2;
    const boxY = height / 2 - 10;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(input || '____', width / 2, boxY + 26);

    if (input.length === 4) {
      ctx.fillStyle = '#00ff88';
      ctx.font = '12px monospace';
      ctx.fillText(isTouchDevice ? 'Tap to join' : 'Press ENTER to join', width / 2, boxY + boxH + 20);
    }
  }

  if (error) {
    ctx.fillStyle = '#ff4444';
    ctx.font = '14px monospace';
    ctx.fillText(error, width / 2, height / 2 + 160);
  }

  if (isTouchDevice) {
    drawMenuButton(ctx, width / 2, height - 40, 180, 36, 'BACK', '#555', '#111');
  } else {
    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.fillText('Press ESC to go back', width / 2, height - 40);
  }

  ctx.restore();
}

export function drawWaitingRoom(cc: CanvasContext, lobby: Lobby, isHost: boolean): void {
  const { ctx, width, height } = cc;
  const mobile = isNarrow(width);
  const btnW = getMenuButtonWidth(width);
  ctx.save();

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffff';
  ctx.font = `bold ${mobile ? 22 : 28}px monospace`;
  ctx.fillText('WAITING FOR PLAYERS', width / 2, height / 2 - 120);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`Room: ${lobby.roomCode}`, width / 2, height / 2 - 80);

  // Player list
  const slotColors = ['#00ffff', '#ff6699', '#66ff66', '#ffaa33'];
  for (let i = 0; i < 4; i++) {
    const y = height / 2 - 40 + i * 40;
    const player = lobby.players[i];
    const classType = player ? lobby.classSelections.get(player.playerId) : undefined;

    if (player) {
      const hasClass = !!classType;
      ctx.fillStyle = hasClass ? (slotColors[i] ?? '#fff') : '#888';
      ctx.font = 'bold 16px monospace';
      const status = hasClass ? classType : 'Choosing...';
      ctx.fillText(`Player ${i + 1} (${status})`, width / 2, y);
    } else {
      ctx.fillStyle = '#333';
      ctx.font = '16px monospace';
      ctx.fillText(`Slot ${i + 1} - empty`, width / 2, y);
    }
  }

  if (isHost) {
    const allReady = lobby.players.length >= 1 && lobby.players.every(p => lobby.classSelections.has(p.playerId));
    if (isTouchDevice) {
      if (allReady) {
        drawMenuButton(ctx, width / 2, height / 2 + 130, btnW, 40, 'START GAME', '#00ff88', '#0a1a0a');
      } else {
        ctx.fillStyle = '#555';
        ctx.font = '14px monospace';
        ctx.fillText('Waiting for all players...', width / 2, height / 2 + 130);
      }
    } else {
      ctx.fillStyle = allReady ? '#00ff88' : '#555';
      ctx.font = '16px monospace';
      const startText = allReady ? 'Press ENTER to start' : 'Waiting for all players to pick a class...';
      ctx.fillText(startText, width / 2, height / 2 + 140);
    }
  } else {
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Waiting for host to start...', width / 2, height / 2 + 140);
  }

  if (isTouchDevice) {
    drawMenuButton(ctx, width / 2, height - 40, 180, 36, 'LEAVE', '#555', '#111');
  } else {
    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.fillText('Press ESC to leave', width / 2, height - 40);
  }

  ctx.restore();
}

export function drawClassSelect(cc: CanvasContext, selectedIndex: number): void {
  const { ctx, width, height } = cc;
  ctx.save();

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  const mobile = isNarrow(width);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${mobile ? 20 : 28}px monospace`;
  ctx.fillText('CHOOSE YOUR CLASS', width / 2, height / 2 - (mobile ? 90 : 120));

  const classes = [
    { name: 'WARRIOR', color: '#00ffff', shape: 'diamond', desc: 'Melee combat specialist' },
    { name: 'CASTER', color: '#aa44ff', shape: 'circle', desc: 'Ranged magic wielder' },
  ];

  const layout = getClassCardLayout(width, height);
  const { cardW, cardH, gap, startX, cardY } = layout;

  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];
    const cx = startX + i * (cardW + gap);
    const isSelected = i === selectedIndex;

    ctx.fillStyle = isSelected ? '#2a2a3a' : '#1a1a2a';
    ctx.strokeStyle = cls.color;
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(cx, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    const iconY = cardY + (mobile ? 20 : 30);
    const iconCenterY = cardY + (mobile ? 40 : 55);
    ctx.fillStyle = cls.color;
    ctx.shadowColor = cls.color;
    ctx.shadowBlur = mobile ? 10 : 15;
    if (cls.shape === 'diamond') {
      const sz = mobile ? 15 : 20;
      ctx.beginPath();
      ctx.moveTo(cx + cardW / 2, iconY);
      ctx.lineTo(cx + cardW / 2 + sz, iconCenterY);
      ctx.lineTo(cx + cardW / 2, iconCenterY + (iconCenterY - iconY));
      ctx.lineTo(cx + cardW / 2 - sz, iconCenterY);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx + cardW / 2, iconCenterY, mobile ? 15 : 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = cls.color;
    ctx.font = `bold ${mobile ? 12 : 16}px monospace`;
    ctx.fillText(cls.name, cx + cardW / 2, cardY + (mobile ? 85 : 110));

    ctx.fillStyle = '#aaa';
    ctx.font = `${mobile ? 9 : 11}px monospace`;
    ctx.fillText(cls.desc, cx + cardW / 2, cardY + (mobile ? 105 : 135));

    if (!isTouchDevice) {
      ctx.fillStyle = '#666';
      ctx.font = '12px monospace';
      ctx.fillText(`[${i + 1}]`, cx + cardW / 2, cardY + cardH - 8);
    }
  }

  ctx.fillStyle = '#666';
  ctx.font = `${mobile ? 10 : 12}px monospace`;
  ctx.fillText(isTouchDevice ? 'Tap a class to select' : 'Press 1 or 2 to select', width / 2, cardY + cardH + (mobile ? 20 : 40));

  ctx.restore();
}
