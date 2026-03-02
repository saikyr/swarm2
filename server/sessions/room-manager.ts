import type { WebSocket } from 'ws';

export interface RoomClient {
  ws: WebSocket;
  playerId: number;
  roomCode: string;
}

export interface RoomSession {
  code: string;
  clients: RoomClient[];
  hostId: number;
  state: 'lobby' | 'starting' | 'running' | 'ended';
}

export function getHostClient(room: RoomSession): RoomClient | undefined {
  return room.clients.find((c) => c.playerId === room.hostId);
}

export function getClientByPlayerId(room: RoomSession, playerId: number): RoomClient | undefined {
  return room.clients.find((c) => c.playerId === playerId);
}
