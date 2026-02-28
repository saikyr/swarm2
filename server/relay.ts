import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

interface Client {
  ws: WebSocket;
  playerId: number;
  roomCode: string;
}

interface Room {
  code: string;
  clients: Client[];
  hostId: number;
  started: boolean;
}

const rooms = new Map<string, Room>();
const clientToRoom = new Map<WebSocket, Room>();

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
}

function handleMessage(ws: WebSocket, raw: string): void {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  switch (msg.type) {
    case 'create_room': {
      const code = generateRoomCode();
      const client: Client = { ws, playerId: 0, roomCode: code };
      const room: Room = { code, clients: [client], hostId: 0, started: false };
      rooms.set(code, room);
      clientToRoom.set(ws, room);
      send(ws, { type: 'room_created', roomCode: code, playerId: 0 });
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
      if (room.started) {
        send(ws, { type: 'room_error', reason: 'Game already started' });
        return;
      }

      const playerId = room.clients.length;
      const client: Client = { ws, playerId, roomCode: code };
      room.clients.push(client);
      clientToRoom.set(ws, room);

      send(ws, {
        type: 'joined_room',
        roomCode: code,
        playerId,
        players: room.clients.map(c => ({ playerId: c.playerId })),
      });

      broadcast(room, { type: 'player_joined', playerId }, ws);
      console.log(`Player ${playerId} joined room ${code}`);
      break;
    }

    case 'start_game': {
      const room = clientToRoom.get(ws);
      if (!room) return;
      const client = room.clients.find(c => c.ws === ws);
      if (!client || client.playerId !== 0) return;
      room.started = true;
      broadcast(room, msg, ws);
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
          send(target.ws, msg);
        }
        return;
      }

      // Forward to all other clients in the room
      broadcast(room, msg, ws);
      break;
    }
  }
}

function handleDisconnect(ws: WebSocket): void {
  const room = clientToRoom.get(ws);
  if (!room) return;

  const client = room.clients.find(c => c.ws === ws);
  if (!client) return;

  room.clients = room.clients.filter(c => c.ws !== ws);
  clientToRoom.delete(ws);

  broadcast(room, { type: 'player_left', playerId: client.playerId });
  console.log(`Player ${client.playerId} left room ${room.code}`);

  if (room.clients.length === 0) {
    rooms.delete(room.code);
    console.log(`Room ${room.code} deleted (empty)`);
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

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      handleMessage(ws, data.toString());
    });
    ws.on('close', () => handleDisconnect(ws));
    ws.on('error', () => handleDisconnect(ws));
  });

  httpServer.listen(port, () => {
    console.log(`Relay server listening on port ${port}`);
  });

  return wss;
}
