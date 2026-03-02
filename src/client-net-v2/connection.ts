import type { NetClient } from '../net/client';
import type { EnvelopeV2, V2MessageType } from '../net-v2/protocol';
import { PROTOCOL_V2 } from '../net-v2/protocol';

export function sendEnvelope<T>(
  client: NetClient,
  roomCode: string,
  type: V2MessageType,
  payload: T,
): void {
  const msg: EnvelopeV2<T> = {
    v: PROTOCOL_V2,
    t: type,
    room: roomCode,
    ts: Date.now(),
    payload,
  };

  client.send(msg as unknown as any);
}
