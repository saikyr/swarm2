export interface SessionLoopConfig {
  tickHz: number;
  snapshotHz: number;
}

export const DEFAULT_SESSION_LOOP: SessionLoopConfig = {
  tickHz: 60,
  snapshotHz: 20,
};
