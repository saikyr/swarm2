// Touch input module — virtual joystick + action buttons for mobile

export const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// --- Touch mode: 'menu' = all touches are taps, 'gameplay' = joystick + buttons ---
let touchMode: 'menu' | 'gameplay' = 'menu';

export function setTouchMode(mode: 'menu' | 'gameplay'): void {
  touchMode = mode;
}

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
let dashDown = false;

// Button positions (set during draw, used for hit-testing)
let dashBtnX = 0;
let dashBtnY = 0;
const BTN_RADIUS = 32;

// --- Pause button (top-right during gameplay) ---
let pauseBtnX = 0;
let pauseBtnY = 0;
const PAUSE_BTN_SIZE = 24;
let pauseTapped = false;

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

  return { moveX, moveY, dash: dashDown, ability: false };
}

export function consumeTap(): { x: number; y: number } | null {
  if (tapFired) {
    tapFired = false;
    return { x: tapX, y: tapY };
  }
  return null;
}

export function clearPendingTaps(): void {
  tapFired = false;
}

export function consumePauseTap(): boolean {
  if (pauseTapped) {
    pauseTapped = false;
    return true;
  }
  return false;
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

      // In menu mode, ALL touches are taps — no joystick/buttons
      if (touchMode === 'menu') {
        tapX = x;
        tapY = y;
        tapFired = true;
        continue;
      }

      // --- Gameplay mode below ---

      // Check pause button (top-right)
      if (pauseBtnX > 0 && Math.abs(x - pauseBtnX) < PAUSE_BTN_SIZE + 8 && Math.abs(y - pauseBtnY) < PAUSE_BTN_SIZE + 8) {
        pauseTapped = true;
        continue;
      }

      // Check buttons first (right side)
      if (hitTestButton(x, y, dashBtnX, dashBtnY)) {
        dashTouchId = t.identifier;
        dashDown = true;
        continue;
      }

      // Left half → joystick (use rect.width for CSS pixels, not canvas.width)
      if (x < rect.width * 0.5 && joystickTouchId === null) {
        joystickTouchId = t.identifier;
        joystickOriginX = x;
        joystickOriginY = y;
        joystickCurrentX = x;
        joystickCurrentY = y;
        joystickActive = true;
        continue;
      }

      // Anything else → tap (for upgrades during gameplay)
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

  // --- Dash button (above minimap, bottom-right area) ---
  dashBtnX = width - 80;
  dashBtnY = height - 130;

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

  // --- Pause button (top-right) ---
  pauseBtnX = width - 36;
  pauseBtnY = 36;
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#333';
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(pauseBtnX - PAUSE_BTN_SIZE, pauseBtnY - PAUSE_BTN_SIZE, PAUSE_BTN_SIZE * 2, PAUSE_BTN_SIZE * 2, 6);
  ctx.fill();
  ctx.stroke();

  // Draw pause icon (two vertical bars)
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  ctx.fillRect(pauseBtnX - 7, pauseBtnY - 10, 5, 20);
  ctx.fillRect(pauseBtnX + 2, pauseBtnY - 10, 5, 20);

  ctx.restore();
}
