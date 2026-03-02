import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { SessionMetrics } from './sessions/metrics';
import { broadcastExcept, routeToHost, routeToPlayer } from './sessions/router';
import { serverNetDebug } from './sessions/net-debug';
import { validateEnvelopeV2, validateInputFrameV2, validateUpgradePickV2 } from '../src/net-v2/schemas';
import { PROTOCOL_V2 } from '../src/net-v2/protocol';

interface Client {
  ws: WebSocket;
  playerId: number;
  roomCode: string;
  lastSeenMs: number;
}

interface Room {
  code: string;
  clients: Client[];
  hostId: number;
  started: boolean;
  state: 'lobby' | 'starting' | 'running' | 'ended';
  metrics: SessionMetrics;
}

const rooms = new Map<string, Room>();
const clientToRoom = new Map<WebSocket, Room>();
const STALE_TIMEOUT_MS = parseInt(process.env.STALE_TIMEOUT_MS ?? '10000', 10);

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

function send(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room: Room, msg: Record<string, unknown>, excludeWs?: WebSocket): void {
  const data = JSON.stringify(msg);
  for (const client of room.clients) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
  room.metrics.trackPayload(data.length);
  room.metrics.maybeLog(room.clients.length);
}

function handleMessage(ws: WebSocket, raw: string): void {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  const env = validateEnvelopeV2(msg);
  if (env) {
    handleV2Message(ws, env, raw);
    return;
  }

  switch (msg.type) {
    case 'create_room': {
      const code = generateRoomCode();
      const client: Client = { ws, playerId: 0, roomCode: code, lastSeenMs: Date.now() };
      const room: Room = {
        code,
        clients: [client],
        hostId: 0,
        started: false,
        state: 'lobby',
        metrics: new SessionMetrics(code),
      };
      rooms.set(code, room);
      clientToRoom.set(ws, room);
      serverNetDebug.ensureRoom(code);
      serverNetDebug.write(code, {
        kind: 'room_created',
        ts: Date.now(),
        hostId: 0,
      });
      send(ws, { type: 'room_created', roomCode: code, playerId: 0 });
      broadcastRoomStateV2(room);
      console.log(`Room ${code} created`);
      break;
    }

    case 'join_room': {
      const code = (msg.roomCode as string).toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: 'room_error', reason: 'Room not found' });
        return;
      }
      if (room.clients.length >= 4) {
        send(ws, { type: 'room_error', reason: 'Room is full' });
        return;
      }
      if (room.started || room.state !== 'lobby') {
        send(ws, { type: 'room_error', reason: 'Game already started' });
        return;
      }

      const playerId = room.clients.length;
      const client: Client = { ws, playerId, roomCode: code, lastSeenMs: Date.now() };
      room.clients.push(client);
      clientToRoom.set(ws, room);
      serverNetDebug.write(code, {
        kind: 'player_joined',
        ts: Date.now(),
        playerId,
        totalPlayers: room.clients.length,
      });

      send(ws, {
        type: 'joined_room',
        roomCode: code,
        playerId,
        players: room.clients.map(c => ({ playerId: c.playerId })),
      });

      broadcast(room, { type: 'player_joined', playerId }, ws);
      broadcastRoomStateV2(room);
      console.log(`Player ${playerId} joined room ${code}`);
      break;
    }

    case 'start_game': {
      const room = clientToRoom.get(ws);
      if (!room) return;
      const client = room.clients.find(c => c.ws === ws);
      if (!client || client.playerId !== 0) return;
      room.state = 'starting';
      serverNetDebug.write(room.code, {
        kind: 'start_game',
        ts: Date.now(),
        playerId: client.playerId,
      });
      broadcastRoomStateV2(room);
      room.started = true;
      room.state = 'running';
      broadcast(room, msg, ws);
      broadcastRoomStateV2(room);
      console.log(`Game started in room ${room.code}`);
      break;
    }

    default: {
      const room = clientToRoom.get(ws);
      if (!room) return;

      // Targeted message: upgrade_options goes only to the specified player
      if (msg.type === 'upgrade_options' && typeof msg.playerId === 'number') {
        const target = room.clients.find(c => c.playerId === msg.playerId);
        if (target && target.ws !== ws) {
          serverNetDebug.write(room.code, {
            kind: 'route_upgrade_options',
            ts: Date.now(),
            targetPlayerId: msg.playerId,
          });
          send(target.ws, msg);
        }
        return;
      }

      // Route input frames directly to host only.
      if (msg.type === 'input') {
        serverNetDebug.write(room.code, {
          kind: 'route_v1_input',
          ts: Date.now(),
        });
        routeToHost(room as any, ws, raw);
        return;
      }

      // Generic targeted delivery hook.
      if (typeof msg.__targetPlayerId === 'number') {
        serverNetDebug.write(room.code, {
          kind: 'route_v1_targeted',
          ts: Date.now(),
          targetPlayerId: msg.__targetPlayerId,
        });
        routeToPlayer(room as any, msg.__targetPlayerId, raw);
        return;
      }

      // Forward to all other clients in the room
      broadcast(room, msg, ws);
      serverNetDebug.write(room.code, {
        kind: 'route_v1_broadcast',
        ts: Date.now(),
      });
      break;
    }
  }
}

function handleV2Message(ws: WebSocket, env: NonNullable<ReturnType<typeof validateEnvelopeV2>>, raw: string): void {
  if (env.t === 'c_hello') {
    send(ws, {
      v: PROTOCOL_V2,
      t: 's_hello',
      room: env.room,
      ts: Date.now(),
      payload: { protocolVersion: PROTOCOL_V2 },
    });
    return;
  }

  if (env.t === 'c_ping') {
    send(ws, { v: PROTOCOL_V2, t: 's_pong', room: env.room, ts: Date.now(), payload: env.payload });
    return;
  }

  const room = clientToRoom.get(ws);
  if (!room) {
    send(ws, {
      v: PROTOCOL_V2,
      t: 's_error',
      room: env.room,
      ts: Date.now(),
      payload: { code: 'NO_ROOM', message: 'Join a room first' },
    });
    return;
  }
  const sender = room.clients.find(c => c.ws === ws);
  if (!sender) return;
  sender.lastSeenMs = Date.now();

  if (env.t === 'c_input') {
    const parsed = validateInputFrameV2(env.payload);
    if (!parsed || parsed.playerId !== sender.playerId) {
      send(ws, {
        v: PROTOCOL_V2,
        t: 's_error',
        room: room.code,
        ts: Date.now(),
        payload: { code: 'BAD_INPUT', message: 'Invalid c_input payload' },
      });
      return;
    }
    routeToHost(room as any, ws, raw);
    serverNetDebug.write(room.code, {
      kind: 'route_c_input',
      ts: Date.now(),
      playerId: parsed.playerId,
      seq: parsed.seq,
      clientTick: parsed.clientTick,
      moveX: parsed.moveX,
      moveY: parsed.moveY,
      buttons: parsed.buttons,
    });
    room.metrics.trackPayload(raw.length);
    return;
  }

  if (env.t === 'c_upgrade_pick') {
    const parsed = validateUpgradePickV2(env.payload);
    if (!parsed || parsed.playerId !== sender.playerId) {
      send(ws, {
        v: PROTOCOL_V2,
        t: 's_error',
        room: room.code,
        ts: Date.now(),
        payload: { code: 'BAD_UPGRADE_PICK', message: 'Invalid c_upgrade_pick payload' },
      });
      return;
    }
    routeToHost(room as any, ws, raw);
    serverNetDebug.write(room.code, {
      kind: 'route_c_upgrade_pick',
      ts: Date.now(),
      playerId: parsed.playerId,
      cardIndex: parsed.cardIndex,
    });
    room.metrics.trackPayload(raw.length);
    return;
  }

  // Explicit target delivery from host to one player.
  if (typeof env.targetPlayerId === 'number') {
    if (sender.playerId === room.hostId) {
      routeToPlayer(room as any, env.targetPlayerId, raw);
      serverNetDebug.write(room.code, {
        kind: 'route_s_target',
        ts: Date.now(),
        t: env.t,
        targetPlayerId: env.targetPlayerId,
      });
      room.metrics.trackPayload(raw.length);
    }
    return;
  }

  // Server-scope events sent by host fan out to non-host peers.
  if (env.t.startsWith('s_')) {
    if (sender.playerId === room.hostId) {
      broadcastExcept(room as any, ws, raw);
      serverNetDebug.write(room.code, {
        kind: 'route_s_broadcast',
        ts: Date.now(),
        t: env.t,
      });
      room.metrics.trackPayload(raw.length);
      room.metrics.maybeLog(room.clients.length);
    }
    return;
  }

  // Fallback client events route to host.
  if (env.t.startsWith('c_')) {
    routeToHost(room as any, ws, raw);
    serverNetDebug.write(room.code, {
      kind: 'route_c_host',
      ts: Date.now(),
      t: env.t,
      playerId: sender.playerId,
    });
    room.metrics.trackPayload(raw.length);
  }
}

function handleDisconnect(ws: WebSocket): void {
  const room = clientToRoom.get(ws);
  if (!room) return;

  const client = room.clients.find(c => c.ws === ws);
  if (!client) return;

  const hostDisconnected = client.playerId === room.hostId;

  room.clients = room.clients.filter(c => c.ws !== ws);
  clientToRoom.delete(ws);
  serverNetDebug.write(room.code, {
    kind: 'player_left',
    ts: Date.now(),
    playerId: client.playerId,
    hostDisconnected,
    remainingPlayers: room.clients.length,
  });

  if (hostDisconnected && room.state === 'running') {
    room.state = 'ended';
    room.started = false;

    // v1 compatibility signal
    broadcast(room, { type: 'game_over' });

    // v2 run-end signal
    const data = JSON.stringify({
      v: PROTOCOL_V2,
      t: 's_run_end',
      room: room.code,
      ts: Date.now(),
      payload: { reason: 'host_left' },
    });
    for (const c of room.clients) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
    }
  }

  broadcast(room, { type: 'player_left', playerId: client.playerId });
  broadcastRoomStateV2(room);
  console.log(`Player ${client.playerId} left room ${room.code}`);

  if (room.clients.length === 0) {
    serverNetDebug.closeRoom(room.code);
    rooms.delete(room.code);
    console.log(`Room ${room.code} deleted (empty)`);
  }
}

function broadcastRoomStateV2(room: Room): void {
  const payload = {
    roomCode: room.code,
    state: room.state,
    players: room.clients.map((c) => ({ playerId: c.playerId, connected: true })),
  };
  const data = JSON.stringify({
    v: PROTOCOL_V2,
    t: 's_room_state',
    room: room.code,
    ts: Date.now(),
    payload,
  });
  for (const client of room.clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function sweepStaleClients(): void {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.state !== 'running') continue;
    for (const client of [...room.clients]) {
      if (now - client.lastSeenMs <= STALE_TIMEOUT_MS) continue;
      try {
        client.ws.terminate();
      } catch {
        // ignore
      }
      handleDisconnect(client.ws);
    }
  }
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function createRelayServer(port: number, staticDir?: string) {
  const distDir = staticDir ?? join(import.meta.dirname, '..', 'dist');

  const httpServer = createServer((req, res) => {
    // Serve static files from dist/ if it exists
    if (existsSync(distDir)) {
      let urlPath = req.url?.split('?')[0] ?? '/';
      if (urlPath === '/') urlPath = '/index.html';

      const filePath = join(distDir, urlPath);
      // Prevent directory traversal
      if (filePath.startsWith(distDir) && existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath);
        const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(readFileSync(filePath));
        return;
      }

      // SPA fallback — serve index.html for non-asset routes
      const indexPath = join(distDir, 'index.html');
      if (existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(indexPath));
        return;
      }
    }

    // Health check fallback
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });

  const wss = new WebSocketServer({ server: httpServer });
  const staleSweepTimer = setInterval(sweepStaleClients, 2000);

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const room = clientToRoom.get(ws);
      if (room) {
        const client = room.clients.find(c => c.ws === ws);
        if (client) client.lastSeenMs = Date.now();
      }
      handleMessage(ws, data.toString());
    });
    ws.on('close', () => handleDisconnect(ws));
    ws.on('error', () => handleDisconnect(ws));
  });

  httpServer.listen(port, () => {
    console.log(`Relay server listening on port ${port}`);
  });

  wss.on('close', () => {
    clearInterval(staleSweepTimer);
  });

  return wss;
}
