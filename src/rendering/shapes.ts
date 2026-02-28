export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  fill: string
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  fill: string
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fill();
}

export function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  fill: string, rotation = 0
): void {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.866, radius * 0.5);
  ctx.lineTo(-radius * 0.866, radius * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawSquare(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  fill: string
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  color: string, lineWidth = 2
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawArc(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  startAngle: number, endAngle: number,
  color: string, alpha = 0.4
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawArcBand(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  innerRadius: number, outerRadius: number,
  startAngle: number, endAngle: number,
  fillColor: string, strokeColor: string,
  alpha = 0.5
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(x, y, outerRadius, startAngle, endAngle);
  ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.fill();

  // Outer edge glow
  ctx.globalAlpha = alpha * 1.2;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, outerRadius, startAngle, endAngle);
  ctx.stroke();
  ctx.restore();
}

export function buildJitterPolyline(
  x0: number, y0: number,
  x1: number, y1: number,
  segments: number,
  jitter: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [{ x: x0, y: y0 }];
  const dx = x1 - x0;
  const dy = y1 - y0;
  // Perpendicular direction
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const offset = (Math.random() - 0.5) * 2 * jitter;
    points.push({
      x: x0 + dx * t + px * offset,
      y: y0 + dy * t + py * offset,
    });
  }
  points.push({ x: x1, y: y1 });
  return points;
}

export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  lineWidth: number,
  alpha = 1
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'bevel';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}
