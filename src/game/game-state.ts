import { GameState } from '../constants';

export interface GameStateManager {
  current: GameState;
  previous: GameState;
}

export function createGameStateManager(): GameStateManager {
  return {
    current: GameState.Menu,
    previous: GameState.Menu,
  };
}

export function changeState(mgr: GameStateManager, newState: GameState): void {
  mgr.previous = mgr.current;
  mgr.current = newState;
}
