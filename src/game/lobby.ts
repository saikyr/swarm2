import type { ClassType } from '../constants';

export interface LobbyPlayer {
  playerId: number;
  ready: boolean;
}

export interface Lobby {
  roomCode: string;
  players: LobbyPlayer[];
  classSelections: Map<number, ClassType>;
}

export function createLobby(): Lobby {
  return {
    roomCode: '',
    players: [],
    classSelections: new Map(),
  };
}
