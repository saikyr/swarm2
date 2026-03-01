// Touch input module — virtual joystick + action buttons for mobile

export const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// --- Joystick state (left half of screen) ---
let joystickTouchId: number | null = null;
let joystickOriginX = 0;
let joystickOriginY = 0;
let joystickCurrentX = 0;
let joystickCurrentY = 0;
let joystickActive = false;

const DEAD_ZONE = 8;
const MAX_RADIUS = 60;

// --- Button state (right side, bottom) ---
let dashTouchId: number | null = null;
let abilityTouchId: number | null = null;
let dashDown = false;
let abilityDown = false;

// Button positions (set during draw, used for hit-testing)
let dashBtnX = 0;
let dashBtnY = 0;
let abilityBtnX = 0;
let abilityBtnY = 0;
const BTN_RADIUS = 32;

// --- Tap passthrough for menu clicks ---
let tapX = 0;
let tapY = 0;
let tapFired = false;

export function getTouchInput(): { moveX: number; moveY: number; dash: boolean; ability: boolean } {
  let moveX = 0;
  let moveY = 0;

  if (joystickActive) {
    let dx = joystickCurrentX - joystickOriginX;
    let dy = joystickCurrentY - joystickOriginY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > DEAD_ZONE) {
      const clampedDist = Math.min(dist, MAX_RADIUS);
      moveX = (dx / dist) * (clampedDist / MAX_RADIUS);
      moveY = (dy / dist) * (clampedDist / MAX_RADIUS);
    }
  }

  return { moveX, moveY, dash: dashDown, ability: abilityDown };
}

export function consumeTap(): { x: number; y: number } | null {
  if (tapFired) {
    tapFired = false;
    return { x: tapX, y: tapY };
  }
  return null;
}

function hitTestButton(tx: number, ty: number, bx: number, by: number): boolean {
  const dx = tx - bx;
  const dy = ty - by;
  return dx * dx + dy * dy <= (BTN_RADIUS + 12) * (BTN_RADIUS + 12);
}

export function setupTouchListeners(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;

      // Check buttons first (right side)
      if (hitTestButton(x, y, dashBtnX, dashBtnY)) {
        dashTouchId = t.identifier;
        dashDown = true;
        continue;
      }
      if (hitTestButton(x, y, abilityBtnX, abilityBtnY)) {
        abilityTouchId = t.identifier;
        abilityDown = true;
        continue;
      }

      // Left half → joystick
      if (x < canvas.width * 0.5 && joystickTouchId === null) {
        joystickTouchId = t.identifier;
        joystickOriginX = x;
        joystickOriginY = y;
        joystickCurrentX = x;
        joystickCurrentY = y;
        joystickActive = true;
        continue;
      }

      // Anything else → tap (for menus/upgrades)
      tapX = x;
      tapY = y;
      tapFired = true;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;

      if (t.identifier === joystickTouchId) {
        joystickCurrentX = x;
        joystickCurrentY = y;
      }
    }
  }, { passive: false });

  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickTouchId) {
        joystickTouchId = null;
        joystickActive = false;
      }
      if (t.identifier === dashTouchId) {
        dashTouchId = null;
        dashDown = false;
      }
      if (t.identifier === abilityTouchId) {
        abilityTouchId = null;
        abilityDown = false;
      }
    }
  };

  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

export function drawTouchControls(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.35;

  // --- Virtual joystick ---
  if (joystickActive) {
    // Outer ring at origin
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystickOriginX, joystickOriginY, MAX_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Thumb position (clamped)
    let dx = joystickCurrentX - joystickOriginX;
    let dy = joystickCurrentY - joystickOriginY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let thumbX = joystickCurrentX;
    let thumbY = joystickCurrentY;
    if (dist > MAX_RADIUS) {
      thumbX = joystickOriginX + (dx / dist) * MAX_RADIUS;
      thumbY = joystickOriginY + (dy / dist) * MAX_RADIUS;
    }

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Action buttons (bottom-right) ---
  dashBtnX = width - 100;
  dashBtnY = height - 120;
  abilityBtnX = width - 170;
  abilityBtnY = height - 70;

  // Dash button
  ctx.fillStyle = dashDown ? '#00ffff' : '#225';
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dashBtnX, dashBtnY, BTN_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DASH', dashBtnX, dashBtnY);

  // Ability button
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = abilityDown ? '#aa44ff' : '#214';
  ctx.strokeStyle = '#aa44ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(abilityBtnX, abilityBtnY, BTN_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('ABILITY', abilityBtnX, abilityBtnY);

  ctx.restore();
}
