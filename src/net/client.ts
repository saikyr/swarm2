import type { NetMessage } from './messages';

export interface NetClientEvents {
  onMessage: ((msg: NetMessage) => void) | null;
  onDisconnect: (() => void) | null;
}

export class NetClient implements NetClientEvents {
  private ws: WebSocket | null = null;
  onMessage: ((msg: NetMessage) => void) | null = null;
  onDisconnect: (() => void) | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('WebSocket connection failed'));

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as NetMessage;
          if (this.onMessage) this.onMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (this.onDisconnect) this.onDisconnect();
        this.ws = null;
      };
    });
  }

  send(msg: NetMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
