import type { WebSocket } from 'ws';
import type { RoomSession } from './room-manager';
import { getClientByPlayerId, getHostClient } from './room-manager';

export function routeToHost(room: RoomSession, sender: WebSocket, rawMsg: string): void {
  const host = getHostClient(room);
  if (!host) return;
  if (host.ws.readyState !== WebSocket.OPEN) return;
  if (host.ws === sender) return;
  host.ws.send(rawMsg);
}

export function routeToPlayer(room: RoomSession, playerId: number, rawMsg: string): void {
  const client = getClientByPlayerId(room, playerId);
  if (!client) return;
  if (client.ws.readyState !== WebSocket.OPEN) return;
  client.ws.send(rawMsg);
}

export function broadcastExcept(room: RoomSession, sender: WebSocket, rawMsg: string): void {
  for (const client of room.clients) {
    if (client.ws === sender) continue;
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    client.ws.send(rawMsg);
  }
}
