export function findAckForPlayer(ack: Array<{ playerId: number; lastSeq: number }>, playerId: number): number {
  for (const a of ack) {
    if (a.playerId === playerId) return a.lastSeq;
  }
  return -1;
}
