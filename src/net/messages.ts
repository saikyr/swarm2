import type { ClassType } from '../constants';

export enum MessageType {
  // Lobby
  CreateRoom = 'create_room',
  RoomCreated = 'room_created',
  JoinRoom = 'join_room',
  JoinedRoom = 'joined_room',
  PlayerJoined = 'player_joined',
  PlayerLeft = 'player_left',
  RoomError = 'room_error',

  // Game setup
  ClassSelect = 'class_select',
  StartGame = 'start_game',

  // Gameplay
  Input = 'input',
  Snapshot = 'snapshot',

  // Upgrade flow
  UpgradeOptions = 'upgrade_options',
  UpgradePick = 'upgrade_pick',
  UpgradeResolved = 'upgrade_resolved',

  // Lifecycle
  GameOver = 'game_over',
  Pause = 'pause',
}

export interface NetMessage {
  type: MessageType;
  [key: string]: unknown;
}

// Lobby messages
export interface CreateRoomMsg extends NetMessage {
  type: MessageType.CreateRoom;
}

export interface RoomCreatedMsg extends NetMessage {
  type: MessageType.RoomCreated;
  roomCode: string;
  playerId: number;
}

export interface JoinRoomMsg extends NetMessage {
  type: MessageType.JoinRoom;
  roomCode: string;
}

export interface JoinedRoomMsg extends NetMessage {
  type: MessageType.JoinedRoom;
  roomCode: string;
  playerId: number;
  players: Array<{ playerId: number }>;
}

export interface PlayerJoinedMsg extends NetMessage {
  type: MessageType.PlayerJoined;
  playerId: number;
}

export interface PlayerLeftMsg extends NetMessage {
  type: MessageType.PlayerLeft;
  playerId: number;
}

export interface RoomErrorMsg extends NetMessage {
  type: MessageType.RoomError;
  reason: string;
}

// Game setup
export interface ClassSelectMsg extends NetMessage {
  type: MessageType.ClassSelect;
  playerId: number;
  classType: ClassType;
}

export interface StartGameMsg extends NetMessage {
  type: MessageType.StartGame;
  configs: Array<{ playerId: number; classType: ClassType }>;
}

// Gameplay
export interface InputMsg extends NetMessage {
  type: MessageType.Input;
  playerId: number;
  input: { moveX: number; moveY: number; dash: boolean; ability: boolean };
}

export interface GameEvent {
  type: 'beam';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SnapshotMsg extends NetMessage {
  type: MessageType.Snapshot;
  tick: number;
  snapshot: any;
  events?: GameEvent[];
}

// Upgrade flow
export interface UpgradeOptionsMsg extends NetMessage {
  type: MessageType.UpgradeOptions;
  playerId: number;
  cards: Array<{
    index: number;
    id: string;
    name: string;
    description: string;
    rarity: string;
    cardType?: string;
    weaponId?: string;
    weaponName?: string;
    overclockTier?: string;
  }>;
}

export interface UpgradePickMsg extends NetMessage {
  type: MessageType.UpgradePick;
  playerId: number;
  cardIndex: number;
}

export interface UpgradeResolvedMsg extends NetMessage {
  type: MessageType.UpgradeResolved;
  playerId: number;
}

export interface GameOverMsg extends NetMessage {
  type: MessageType.GameOver;
}

export interface PauseMsg extends NetMessage {
  type: MessageType.Pause;
  paused: boolean;
}
