import type { CanvasContext } from './canvas';
import type { Player, Health, Transform, Weapon } from '../components';
import { TRANSFORM, ENEMY, PICKUP } from '../components';
import { RARITY_COLORS, type Rarity, WORLD_WIDTH, WORLD_HEIGHT } from '../constants';
import type { RunContext } from '../game/run';
import type { Vec2 } from '../utils/math';
import type { World } from '../ecs/ecs';
import type { Lobby } from '../game/lobby';
import { isTouchDevice } from '../input/touch';

export interface UpgradeCard {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  type?: 'stat' | 'weapon_levelup' | 'overclock';
  weaponName?: string;
  overclockTier?: 'balanced' | 'unstable';
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
  ctx.save();

  // HP bar
  const barW = 200;
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

  // Kills
  ctx.textAlign = 'right';
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText(`Kills: ${player.kills}`, width - 20, 24);
  ctx.fillText(`Wave: ${run.wave}`, width - 20, 42);

  // Dash cooldown indicator
  const dashReady = player.dashCooldownTimer <= 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = dashReady ? '#00ffff' : '#444';
  ctx.font = '11px monospace';
  const dashText = dashReady ? '[SPACE] Dash' : `[SPACE] Dash ${(player.dashCooldownTimer).toFixed(1)}s`;
  ctx.fillText(dashText, barX, xpY + 40);

  // Weapon slots HUD (bottom-left)
  if (weaponSlots && weaponSlots.length > 0) {
    drawWeaponSlots(ctx, weaponSlots, cc.height);
  }

  // Minimap
  if (minimap) {
    drawMinimap(ctx, width, cc.height, minimap);
  }

  ctx.restore();
}

function drawWeaponSlots(ctx: CanvasRenderingContext2D, slots: Weapon[], screenH: number): void {
  const slotSize = 44;
  const gap = 6;
  const startX = 16;
  const startY = screenH - (slots.length * (slotSize + gap)) - 10;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const y = startY + i * (slotSize + gap);

    // Background
    ctx.fillStyle = slot.locked ? '#111' : '#1a1a2e';
    ctx.strokeStyle = slot.locked ? '#333' : '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(startX, y, slotSize, slotSize, 4);
    ctx.fill();
    ctx.stroke();

    if (slot.locked) {
      // Lock icon
      ctx.fillStyle = '#444';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', startX + slotSize / 2, y + slotSize / 2 + 5);
      continue;
    }

    // Weapon abbreviation
    const abbr = slot.name.split(' ').map(w => w[0]).join('').toUpperCase();
    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(abbr, startX + slotSize / 2, y + 16);

    // Level
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText(`Lv${slot.level}`, startX + slotSize / 2, y + 28);

    // Cooldown arc
    const cdPct = slot.cooldown > 0 ? Math.max(0, slot.cooldownTimer / slot.cooldown) : 0;
    if (cdPct > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(startX + slotSize / 2, y + slotSize / 2);
      ctx.arc(
        startX + slotSize / 2, y + slotSize / 2,
        slotSize / 2 - 2,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * cdPct,
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  screenW: number, screenH: number,
  data: MinimapData,
): void {
  const mapSize = 100;
  const mapX = screenW - mapSize - 16;
  const mapY = screenH - mapSize - 16;
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
  mouseX: number,
  mouseY: number,
  mouseClicked: boolean,
): number | null {
  const { ctx, width, height } = cc;
  ctx.save();

  // Overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL UP!', width / 2, height / 2 - 160);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Choose an upgrade (1/2/3 or click)', width / 2, height / 2 - 130);

  // Cards
  const cardW = 180;
  const cardH = 200;
  const gap = 20;
  const totalW = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (width - totalW) / 2;
  const cardY = height / 2 - 80;

  let clickedIndex: number | null = null;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const cx = startX + i * (cardW + gap);
    const isSelected = i === selectedIndex;

    // Mouse hover detection
    const isHovered = mouseX >= cx && mouseX <= cx + cardW && mouseY >= cardY && mouseY <= cardY + cardH;
    if (isHovered && mouseClicked) {
      clickedIndex = i;
    }

    // Determine border color and style based on card type
    let borderColor = RARITY_COLORS[card.rarity];
    let bgColor = isSelected || isHovered ? '#2a2a3a' : '#1a1a2a';
    let borderWidth = isSelected || isHovered ? 3 : 1.5;

    if (card.type === 'weapon_levelup') {
      borderColor = '#44aaff';
    } else if (card.overclockTier === 'balanced') {
      borderColor = '#ffd700';
    } else if (card.overclockTier === 'unstable') {
      borderColor = '#ff4400';
    }

    // Scale up on hover
    const scale = isHovered ? 1.05 : 1;
    const drawW = cardW * scale;
    const drawH = cardH * scale;
    const drawX = cx - (drawW - cardW) / 2;
    const drawY = cardY - (drawH - cardH) / 2;

    // Card bg
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawW, drawH, 8);
    ctx.fill();
    ctx.stroke();

    // Type indicator icon
    if (card.type === 'weapon_levelup') {
      ctx.fillStyle = '#44aaff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WEAPON', drawX + drawW / 2, drawY + 18);
    } else if (card.overclockTier === 'balanced') {
      ctx.fillStyle = '#ffd700';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OVERCLOCK', drawX + drawW / 2, drawY + 18);
    } else if (card.overclockTier === 'unstable') {
      ctx.fillStyle = '#ff4400';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('UNSTABLE', drawX + drawW / 2, drawY + 18);
    } else {
      // Rarity label
      ctx.fillStyle = RARITY_COLORS[card.rarity];
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(card.rarity.toUpperCase(), drawX + drawW / 2, drawY + 24);
    }

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(card.name, drawX + drawW / 2, drawY + 50);

    // Description (word wrap)
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    const words = card.description.split(' ');
    let line = '';
    let ly = drawY + 80;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > drawW - 20) {
        ctx.fillText(line, drawX + drawW / 2, ly);
        line = word + ' ';
        ly += 16;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, drawX + drawW / 2, ly);

    // Keybind
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText(`[${i + 1}]`, drawX + drawW / 2, drawY + drawH - 16);
  }

  ctx.restore();
  return clickedIndex;
}

export function drawGameOver(cc: CanvasContext, run: RunContext, kills: number): void {
  const { ctx, width, height } = cc;
  ctx.save();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 36px monospace';
  ctx.fillText('GAME OVER', width / 2, height / 2 - 60);

  const mins = Math.floor(run.timer / 60);
  const secs = Math.floor(run.timer % 60);

  ctx.fillStyle = '#ccc';
  ctx.font = '16px monospace';
  ctx.fillText(`Survived: ${mins}:${secs.toString().padStart(2, '0')}`, width / 2, height / 2 - 10);
  ctx.fillText(`Kills: ${kills}`, width / 2, height / 2 + 20);
  ctx.fillText(`Wave: ${run.wave}`, width / 2, height / 2 + 50);
  ctx.fillText(`Currency earned: ${run.currencyEarned}`, width / 2, height / 2 + 80);

  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.fillText(isTouchDevice ? 'Tap to continue' : 'Press ENTER to continue', width / 2, height / 2 + 130);

  ctx.restore();
}

export function drawMenu(cc: CanvasContext): void {
  const { ctx, width, height } = cc;
  ctx.save();

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 48px monospace';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 20;
  ctx.fillText('SWARM2', width / 2, height / 2 - 60);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.fillText('A Vampire Survivors-Style Game', width / 2, height / 2 - 20);

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText(isTouchDevice ? 'Tap for Solo' : 'Press ENTER for Solo', width / 2, height / 2 + 40);

  ctx.fillStyle = '#00cc88';
  ctx.font = '16px monospace';
  ctx.fillText(isTouchDevice ? 'Tap below for Multiplayer' : 'Press M for Multiplayer', width / 2, height / 2 + 70);

  ctx.fillStyle = '#666';
  ctx.font = '12px monospace';
  ctx.fillText(
    isTouchDevice
      ? 'Joystick to move | Auto-aim weapons | Tap DASH to dash'
      : 'WASD to move | Auto-aim weapons | Space to dash',
    width / 2, height / 2 + 110,
  );

  ctx.restore();
}

export function drawLobby(cc: CanvasContext, lobby: Lobby, mode: 'menu' | 'join', input: string, error: string): void {
  const { ctx, width, height } = cc;
  ctx.save();

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 32px monospace';
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
    ctx.fillStyle = '#fff';
    ctx.font = '18px monospace';
    ctx.fillText('[1] Host a Game', width / 2, height / 2 - 20);
    ctx.fillText('[2] Join a Game', width / 2, height / 2 + 20);
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
      ctx.fillText('Press ENTER to join', width / 2, boxY + boxH + 20);
    }
  }

  if (error) {
    ctx.fillStyle = '#ff4444';
    ctx.font = '14px monospace';
    ctx.fillText(error, width / 2, height / 2 + 160);
  }

  ctx.fillStyle = '#555';
  ctx.font = '12px monospace';
  ctx.fillText('Press ESC to go back', width / 2, height - 40);

  ctx.restore();
}

export function drawWaitingRoom(cc: CanvasContext, lobby: Lobby, isHost: boolean): void {
  const { ctx, width, height } = cc;
  ctx.save();

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 28px monospace';
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
    ctx.fillStyle = allReady ? '#00ff88' : '#555';
    ctx.font = '16px monospace';
    ctx.fillText(allReady ? 'Press ENTER to start' : 'Waiting for all players to pick a class...', width / 2, height / 2 + 140);
  } else {
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Waiting for host to start...', width / 2, height / 2 + 140);
  }

  ctx.fillStyle = '#555';
  ctx.font = '12px monospace';
  ctx.fillText('Press ESC to leave', width / 2, height - 40);

  ctx.restore();
}

export function drawClassSelect(cc: CanvasContext, selectedIndex: number): void {
  const { ctx, width, height } = cc;
  ctx.save();

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('CHOOSE YOUR CLASS', width / 2, height / 2 - 120);

  const classes = [
    { name: 'WARRIOR', color: '#00ffff', shape: 'diamond', desc: 'Melee combat specialist' },
    { name: 'CASTER', color: '#aa44ff', shape: 'circle', desc: 'Ranged magic wielder' },
  ];

  const cardW = 200;
  const cardH = 180;
  const gap = 40;
  const totalW = classes.length * cardW + (classes.length - 1) * gap;
  const startX = (width - totalW) / 2;
  const cardY = height / 2 - 60;

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

    ctx.fillStyle = cls.color;
    ctx.shadowColor = cls.color;
    ctx.shadowBlur = 15;
    if (cls.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(cx + cardW / 2, cardY + 30);
      ctx.lineTo(cx + cardW / 2 + 20, cardY + 55);
      ctx.lineTo(cx + cardW / 2, cardY + 80);
      ctx.lineTo(cx + cardW / 2 - 20, cardY + 55);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx + cardW / 2, cardY + 55, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = cls.color;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(cls.name, cx + cardW / 2, cardY + 110);

    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText(cls.desc, cx + cardW / 2, cardY + 135);

    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText(`[${i + 1}]`, cx + cardW / 2, cardY + cardH - 8);
  }

  ctx.fillStyle = '#666';
  ctx.font = '12px monospace';
  ctx.fillText(isTouchDevice ? 'Tap to select' : 'Press 1 or 2 to select', width / 2, height / 2 + 160);

  ctx.restore();
}
