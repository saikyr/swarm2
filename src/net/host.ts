import type { NetClient } from './client';
import type { NetMessage } from './messages';

export class NetHost {
  private client: NetClient;

  constructor(client: NetClient) {
    this.client = client;
  }

  /** Broadcast a message to all clients (goes through relay server) */
  broadcast(msg: NetMessage): void {
    this.client.send(msg);
  }

  /** Send to a specific player (relay server will route based on playerId for targeted messages) */
  sendToPlayer(playerId: number, msg: NetMessage): void {
    const payload = msg as any;
    if (payload && payload.v === 2) {
      this.client.send({ ...payload, targetPlayerId: playerId });
      return;
    }

    // v1 target routing hint.
    this.client.send({ ...payload, __targetPlayerId: playerId });
  }
}
