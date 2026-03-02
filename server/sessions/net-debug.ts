import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const NET_DEBUG_ENABLED = parseBool(process.env.NET_DEBUG_ENABLED, false);
const NET_DEBUG_DIR = process.env.NET_DEBUG_DIR ?? './logs/net-debug';
const ROTATE_BYTES = parseInt(process.env.NET_DEBUG_ROTATE_BYTES ?? `${8 * 1024 * 1024}`, 10);

interface WriterState {
  roomCode: string;
  filePath: string;
  part: number;
  bytesWritten: number;
  createdAt: number;
}

export interface ServerNetDebugEvent {
  kind: string;
  ts: number;
  [key: string]: unknown;
}

export class ServerNetDebug {
  readonly enabled = NET_DEBUG_ENABLED;
  private readonly writers = new Map<string, WriterState>();

  ensureRoom(roomCode: string): void {
    if (!this.enabled) return;
    if (this.writers.has(roomCode)) return;
    mkdirSync(NET_DEBUG_DIR, { recursive: true });
    const createdAt = Date.now();
    const filePath = this.buildPath(roomCode, createdAt, 0);
    const writer: WriterState = {
      roomCode,
      filePath,
      part: 0,
      bytesWritten: 0,
      createdAt,
    };
    this.writers.set(roomCode, writer);
    this.write(roomCode, {
      kind: 'session_meta',
      ts: Date.now(),
      roomCode,
      filePath,
    });
  }

  write(roomCode: string, event: ServerNetDebugEvent): void {
    if (!this.enabled) return;
    this.ensureRoom(roomCode);
    const writer = this.writers.get(roomCode);
    if (!writer) return;
    const line = JSON.stringify(event) + '\n';
    const lineBytes = Buffer.byteLength(line);
    if (writer.bytesWritten + lineBytes > ROTATE_BYTES) {
      writer.part += 1;
      writer.bytesWritten = 0;
      writer.filePath = this.buildPath(writer.roomCode, writer.createdAt, writer.part);
      const rotateLine = JSON.stringify({
        kind: 'session_rotate',
        ts: Date.now(),
        roomCode: writer.roomCode,
        part: writer.part,
        filePath: writer.filePath,
      }) + '\n';
      appendFileSync(writer.filePath, rotateLine, 'utf8');
      writer.bytesWritten += Buffer.byteLength(rotateLine);
    }
    appendFileSync(writer.filePath, line, 'utf8');
    writer.bytesWritten += lineBytes;
  }

  closeRoom(roomCode: string): void {
    if (!this.enabled) return;
    const writer = this.writers.get(roomCode);
    if (!writer) return;
    this.write(roomCode, {
      kind: 'session_end',
      ts: Date.now(),
      roomCode,
    });
    this.writers.delete(roomCode);
  }

  private buildPath(roomCode: string, createdAt: number, part: number): string {
    const stamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
    const partSuffix = part > 0 ? `-part${part}` : '';
    return join(NET_DEBUG_DIR, `host-${roomCode}-${stamp}${partSuffix}.ndjson`);
  }
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null) return fallback;
  const v = raw.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export const serverNetDebug = new ServerNetDebug();
