import { World } from '../ecs/ecs';
import { setupCanvas, type CanvasContext } from '../rendering/canvas';
import { createScreenShake, updateScreenShake, createHitPause, updateHitPause, type ScreenShake, type HitPause } from '../rendering/effects';
import { createRunContext, type RunContext } from './run';
import { createGameStateManager, changeState, type GameStateManager } from './game-state';
import { loadMeta, saveMeta, type MetaProgression } from './meta-progression';
import { TICK_DT, MAX_FRAME_SKIP, GameState, ClassType, WORLD_WIDTH, WORLD_HEIGHT } from '../constants';
import {
  TRANSFORM, VELOCITY, HEALTH, COLLIDER, RENDERABLE, PLAYER, ENEMY, WEAPON,
  WEAPON_OWNER, PROJECTILE, PARTICLE, INPUT, DAMAGE_FLASH, TRAIL, LIFETIME, PICKUP,
  DAMAGE_NUMBER, SWEEP_ATTACK, NOVA_ATTACK, ORBITAL, BEAM_ATTACK, BOOMERANG, GROUND_ZONE, RUNE_CHARGE, REVIVE_ZONE,
  type Transform, type Health, type Player, type Weapon, type WeaponOwner,
} from '../components';
import { generateUpgradeCards, generateOverclockCards } from '../data/upgrades';
import type { UpgradeCard } from '../rendering/ui';
import { drawHUD, drawUpgradeMenu, drawGameOver, drawMenu, drawClassSelect, drawLobby, drawWaitingRoom, type MinimapData } from '../rendering/ui';
import { render } from '../systems/RenderSystem';
import { spawnPlayers, WEAPON_UNLOCK_LEVELS, type PlayerConfig, type PlayerData } from './player-manager';

// Systems
import { InputSystem, setInputLocalPlayerId, getKeyboardInput } from '../systems/InputSystem';
import { PlayerMovementSystem } from '../systems/PlayerMovementSystem';
import { EnemyAISystem } from '../systems/EnemyAISystem';
import { TargetingSystem } from '../systems/TargetingSystem';
import { WeaponSystem, clearOrbitalTracking, drainGameEvents } from '../systems/WeaponSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { OrbitalSystem } from '../systems/OrbitalSystem';
import { CollisionSystem, setScreenShakeRef } from '../systems/CollisionSystem';
import { HealthSystem, setHealthSystemRefs } from '../systems/HealthSystem';
import { DeathSystem } from '../systems/DeathSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { XPSystem, setLevelUpCallback } from '../systems/XPSystem';
import { SpawnerSystem, setRunRef } from '../systems/SpawnerSystem';
import { LifetimeSystem } from '../systems/LifetimeSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { CameraSystem, camera, resetCamera, setLocalPlayerId } from '../systems/CameraSystem';
import { CleanupSystem } from '../systems/CleanupSystem';
import { NetInputSystem } from '../systems/NetInputSystem';
import { ReviveSystem } from '../systems/ReviveSystem';

// Networking
import { NetClient } from '../net/client';
import { NetHost } from '../net/host';
import { MessageType, type NetMessage, type RoomCreatedMsg, type JoinedRoomMsg, type PlayerJoinedMsg, type PlayerLeftMsg, type StartGameMsg, type SnapshotMsg, type UpgradeOptionsMsg, type UpgradeResolvedMsg, type GameOverMsg, type RoomErrorMsg } from '../net/messages';
import { createLobby, type Lobby } from './lobby';
import { SnapshotManager, type SnapshotData } from '../net/snapshot';
import { Interpolator } from '../net/interpolation';
import { ClientEffectReactor } from '../net/client-effects';
import { setEntityIdOffset } from '../ecs/entity';
import { spawnBeamFx } from '../rendering/particles';
import { DAMAGE_NUMBER_RISE_SPEED } from '../constants';
import type { DamageNumberData, DamageFlash, Transform as TransformType } from '../components';
import { isTouchDevice, setupTouchListeners, consumeTap, drawTouchControls } from '../input/touch';

export type NetworkRole = 'solo' | 'host' | 'client';

export class Game {
  world: World;
  cc: CanvasContext;
  screenShake: ScreenShake;
  hitPause: HitPause;
  run: RunContext;
  stateMgr: GameStateManager;
  meta: MetaProgression;

  private accumulator = 0;
  private lastTime = 0;
  private upgradeCards: UpgradeCard[] = [];
  private selectedUpgrade = 0;
  private classSelectIndex = 0;
  private mouseX = 0;
  private mouseY = 0;
  private mouseClicked = false;
  private weaponSlotData: Weapon[] = [];

  // Multi-player state
  localPlayerId = 0;
  networkRole: NetworkRole = 'solo';
  playerData = new Map<number, PlayerData>();

  // Networking
  private netClient: NetClient | null = null;
  private netHost: NetHost | null = null;
  private lobby: Lobby = createLobby();
  private snapshotMgr: SnapshotManager | null = null;
  private interpolator: Interpolator | null = null;
  private snapshotInterval = 1 / 20; // 20Hz
  private snapshotTimer = 0;
  private prevRawSnapshot: SnapshotData | null = null;
  private clientReactor = new ClientEffectReactor();

  // Upgrade flow for multiplayer
  private upgradingPlayerId = -1;
  private upgradeQueue: number[] = [];
  private waitingForUpgrade = false;
  private remoteUpgradePlayerName = '';

  // Lobby UI state
  private lobbyMode: 'menu' | 'join' = 'menu';
  private lobbyInput = '';
  private lobbyError = '';

  constructor() {
    this.world = new World();
    this.cc = setupCanvas('game');
    this.screenShake = createScreenShake();
    this.hitPause = createHitPause();
    this.run = createRunContext();
    this.stateMgr = createGameStateManager();
    this.meta = loadMeta();

    this.registerComponents();
    this.registerSystems();
    this.setupCallbacks();
    this.setupKeyListeners();
    this.setupMouseListeners();
    if (isTouchDevice) {
      setupTouchListeners(this.cc.ctx.canvas);
    }
  }

  private registerComponents(): void {
    this.world.registerComponent(TRANSFORM);
    this.world.registerComponent(VELOCITY);
    this.world.registerComponent(HEALTH);
    this.world.registerComponent(COLLIDER);
    this.world.registerComponent(RENDERABLE);
    this.world.registerComponent(PLAYER);
    this.world.registerComponent(ENEMY);
    this.world.registerComponent(WEAPON);
    this.world.registerComponent(WEAPON_OWNER);
    this.world.registerComponent(PROJECTILE);
    this.world.registerComponent(PARTICLE);
    this.world.registerComponent(INPUT);
    this.world.registerComponent(DAMAGE_FLASH);
    this.world.registerComponent(TRAIL);
    this.world.registerComponent(LIFETIME);
    this.world.registerComponent(PICKUP);
    this.world.registerComponent(DAMAGE_NUMBER);
    this.world.registerComponent(SWEEP_ATTACK);
    this.world.registerComponent(NOVA_ATTACK);
    this.world.registerComponent(ORBITAL);
    this.world.registerComponent(BEAM_ATTACK);
    this.world.registerComponent(BOOMERANG);
    this.world.registerComponent(GROUND_ZONE);
    this.world.registerComponent(RUNE_CHARGE);
    this.world.registerComponent(REVIVE_ZONE);
  }

  private registerSystems(): void {
    this.world.addSystem(InputSystem);
    this.world.addSystem(NetInputSystem);
    this.world.addSystem(PlayerMovementSystem);
    this.world.addSystem(EnemyAISystem);
    this.world.addSystem(TargetingSystem);
    this.world.addSystem(WeaponSystem);
    this.world.addSystem(MovementSystem);
    this.world.addSystem(ProjectileSystem);
    this.world.addSystem(OrbitalSystem);
    this.world.addSystem(CollisionSystem);
    this.world.addSystem(HealthSystem);
    this.world.addSystem(ReviveSystem);
    this.world.addSystem(DeathSystem);
    this.world.addSystem(PickupSystem);
    this.world.addSystem(XPSystem);
    this.world.addSystem(SpawnerSystem);
    this.world.addSystem(LifetimeSystem);
    this.world.addSystem(ParticleSystem);
    this.world.addSystem(CameraSystem);
    this.world.addSystem(CleanupSystem);
  }

  private setupCallbacks(): void {
    setScreenShakeRef(this.screenShake);
    setHealthSystemRefs(this.screenShake, this.hitPause);
    setRunRef(this.run);
    setLevelUpCallback((playerEntity: number) => this.onLevelUp(playerEntity));
  }

  private setupMouseListeners(): void {
    const canvas = this.cc.ctx.canvas;
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.mouseClicked = true;
    });
  }

  private handleMenuTap(): void {
    const state = this.stateMgr.current;
    if (state === GameState.Menu) {
      // Top half → solo, bottom half → multiplayer
      if (this.mouseY < this.cc.height * 0.55) {
        changeState(this.stateMgr, GameState.ClassSelect);
      } else {
        changeState(this.stateMgr, GameState.Lobby);
      }
    } else if (state === GameState.ClassSelect) {
      // Left half → warrior, right half → caster
      if (this.mouseX < this.cc.width / 2) {
        this.handleClassSelected(ClassType.Warrior);
      } else {
        this.handleClassSelected(ClassType.Caster);
      }
    } else if (state === GameState.GameOver) {
      this.endRun();
    }
  }

  private setupKeyListeners(): void {
    window.addEventListener('keydown', (e) => {
      const state = this.stateMgr.current;

      if (state === GameState.Menu) {
        if (e.code === 'Enter') {
          changeState(this.stateMgr, GameState.ClassSelect);
        } else if (e.code === 'KeyM') {
          changeState(this.stateMgr, GameState.Lobby);
        }
      } else if (state === GameState.Lobby) {
        this.handleLobbyKeydown(e);
      } else if (state === GameState.WaitingForPlayers) {
        if (e.code === 'Enter' && this.networkRole === 'host' && this.lobby.players.length >= 1 && this.allPlayersReady()) {
          this.hostStartGame();
        } else if (e.code === 'Escape') {
          this.disconnectNetwork();
          changeState(this.stateMgr, GameState.Menu);
        }
      } else if (state === GameState.ClassSelect) {
        if (e.code === 'Digit1') {
          this.handleClassSelected(ClassType.Warrior);
        } else if (e.code === 'Digit2') {
          this.handleClassSelected(ClassType.Caster);
        } else if (e.code === 'ArrowLeft') {
          this.classSelectIndex = 0;
        } else if (e.code === 'ArrowRight') {
          this.classSelectIndex = 1;
        } else if (e.code === 'Enter') {
          this.handleClassSelected(this.classSelectIndex === 0 ? ClassType.Warrior : ClassType.Caster);
        }
      } else if (state === GameState.Upgrading) {
        if (e.code === 'Digit1' && this.upgradeCards.length >= 1) {
          this.pickUpgrade(0);
        } else if (e.code === 'Digit2' && this.upgradeCards.length >= 2) {
          this.pickUpgrade(1);
        } else if (e.code === 'Digit3' && this.upgradeCards.length >= 3) {
          this.pickUpgrade(2);
        } else if (e.code === 'ArrowLeft') {
          this.selectedUpgrade = Math.max(0, this.selectedUpgrade - 1);
        } else if (e.code === 'ArrowRight') {
          this.selectedUpgrade = Math.min(this.upgradeCards.length - 1, this.selectedUpgrade + 1);
        } else if (e.code === 'Enter') {
          this.pickUpgrade(this.selectedUpgrade);
        }
      } else if (state === GameState.GameOver) {
        if (e.code === 'Enter') {
          this.endRun();
        }
      } else if (state === GameState.Playing) {
        if (e.code === 'Escape') {
          changeState(this.stateMgr, GameState.Paused);
        }
      } else if (state === GameState.Paused) {
        if (e.code === 'Escape' || e.code === 'Enter') {
          changeState(this.stateMgr, GameState.Playing);
        }
      }
    });
  }

  private handleLobbyKeydown(e: KeyboardEvent): void {
    if (e.code === 'Escape') {
      if (this.lobbyMode === 'join') {
        // Back to lobby menu, clear input
        this.lobbyMode = 'menu';
        this.lobbyInput = '';
      } else {
        this.disconnectNetwork();
        changeState(this.stateMgr, GameState.Menu);
      }
      return;
    }

    if (this.lobbyMode === 'menu') {
      if (e.code === 'Digit1') this.createRoom();
      else if (e.code === 'Digit2') {
        this.lobbyMode = 'join';
        this.lobbyInput = '';
      }
    } else {
      // join input mode — all alphanumeric goes to code field
      if (e.code === 'Enter' && this.lobbyInput.length === 4) {
        this.joinRoom(this.lobbyInput.toUpperCase());
      } else if (e.code === 'Backspace') {
        this.lobbyInput = this.lobbyInput.slice(0, -1);
      } else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && this.lobbyInput.length < 4) {
        this.lobbyInput += e.key.toUpperCase();
      }
    }
  }

  private handleClassSelected(classType: ClassType): void {
    if (this.networkRole === 'solo') {
      this.startGame([{ playerId: 0, classType }]);
    } else if (this.networkRole === 'host') {
      this.lobby.classSelections.set(this.localPlayerId, classType);
      if (this.netClient) {
        this.netClient.send({ type: MessageType.ClassSelect, playerId: this.localPlayerId, classType });
      }
      changeState(this.stateMgr, GameState.WaitingForPlayers);
    } else if (this.networkRole === 'client') {
      this.lobby.classSelections.set(this.localPlayerId, classType);
      if (this.netClient) {
        this.netClient.send({ type: MessageType.ClassSelect, playerId: this.localPlayerId, classType });
      }
      changeState(this.stateMgr, GameState.WaitingForPlayers);
    }
  }

  startGame(configs: PlayerConfig[]): void {
    this.world.clear();
    clearOrbitalTracking();
    this.run = createRunContext();
    setRunRef(this.run);
    resetCamera();

    this.playerData = spawnPlayers(this.world, configs, this.meta);

    // Set local player for camera and input
    setLocalPlayerId(this.localPlayerId);
    setInputLocalPlayerId(this.localPlayerId);

    // Initialize camera to local player position
    const localData = this.playerData.get(this.localPlayerId);
    if (localData) {
      const t = this.world.getComponent<Transform>(localData.entity, TRANSFORM);
      if (t) {
        camera.x = t.pos.x;
        camera.y = t.pos.y;
        camera.prevX = t.pos.x;
        camera.prevY = t.pos.y;
        camera.targetX = t.pos.x;
        camera.targetY = t.pos.y;
      }
    }

    changeState(this.stateMgr, GameState.Playing);
  }

  /** Client-only: prepare an empty world for receiving snapshots */
  private startClientGame(): void {
    this.world.clear();
    clearOrbitalTracking();
    setEntityIdOffset(100000);
    this.run = createRunContext();
    setRunRef(this.run);
    resetCamera();

    // Don't spawn entities — they'll come from snapshots
    this.playerData.clear();

    // Set local player for camera and input
    setLocalPlayerId(this.localPlayerId);
    setInputLocalPlayerId(this.localPlayerId);

    // Initialize camera to world center; snapshot will update it
    camera.x = WORLD_WIDTH / 2;
    camera.y = WORLD_HEIGHT / 2;
    camera.prevX = WORLD_WIDTH / 2;
    camera.prevY = WORLD_HEIGHT / 2;
    camera.targetX = WORLD_WIDTH / 2;
    camera.targetY = WORLD_HEIGHT / 2;

    this.interpolator = new Interpolator();
    this.snapshotMgr = new SnapshotManager(this.world);

    changeState(this.stateMgr, GameState.Playing);
  }

  private getLocalPlayerData(): PlayerData | undefined {
    return this.playerData.get(this.localPlayerId);
  }

  private checkWeaponUnlocks(): void {
    for (const [, pd] of this.playerData) {
      const player = this.world.getComponent<Player>(pd.entity, PLAYER);
      if (!player) continue;

      for (const we of pd.weaponEntities) {
        const weapon = this.world.getComponent<Weapon>(we, WEAPON);
        const wo = this.world.getComponent<WeaponOwner>(we, WEAPON_OWNER);
        if (!weapon || !wo) continue;

        const unlockLevel = WEAPON_UNLOCK_LEVELS[wo.slotIndex] ?? 999;
        if (weapon.locked && player.level >= unlockLevel) {
          weapon.locked = false;
        }
      }
    }
  }

  private onLevelUp(playerEntity: number): void {
    if (this.networkRole === 'client') return;

    const player = this.world.getComponent<Player>(playerEntity, PLAYER);
    if (!player) return;

    if (this.networkRole === 'solo') {
      this.checkWeaponUnlocks();
      this.upgradeCards = generateUpgradeCards(this.world, 3, playerEntity);
      this.selectedUpgrade = 0;
      this.upgradingPlayerId = player.playerId;
      changeState(this.stateMgr, GameState.Upgrading);
    } else if (this.networkRole === 'host') {
      this.upgradeQueue.push(player.playerId);
      if (!this.waitingForUpgrade) {
        this.processNextUpgrade();
      }
    }
  }

  private processNextUpgrade(): void {
    if (this.upgradeQueue.length === 0) {
      this.waitingForUpgrade = false;
      if (this.stateMgr.current === GameState.Upgrading) {
        changeState(this.stateMgr, GameState.Playing);
      }
      return;
    }

    this.waitingForUpgrade = true;
    const playerId = this.upgradeQueue.shift()!;
    this.upgradingPlayerId = playerId;

    const pd = this.playerData.get(playerId);
    if (!pd) { this.processNextUpgrade(); return; }

    this.checkWeaponUnlocks();
    this.upgradeCards = generateUpgradeCards(this.world, 3, pd.entity);
    this.selectedUpgrade = 0;

    if (playerId === this.localPlayerId) {
      changeState(this.stateMgr, GameState.Upgrading);
    } else {
      changeState(this.stateMgr, GameState.Upgrading);
      this.remoteUpgradePlayerName = `Player ${playerId + 1}`;
      if (this.netHost) {
        this.netHost.sendToPlayer(playerId, {
          type: MessageType.UpgradeOptions,
          playerId,
          cards: this.upgradeCards.map((c, i) => ({
            index: i, id: c.id, name: c.name, description: c.description,
            rarity: c.rarity, cardType: c.type, weaponName: c.weaponName,
            overclockTier: c.overclockTier,
          })),
        });
      }
    }
  }

  private pickUpgrade(index: number): void {
    if (index >= 0 && index < this.upgradeCards.length) {
      const card = this.upgradeCards[index];
      card.apply();
      this.run.upgradesPicked.push(card.id);

      const pd = this.playerData.get(this.upgradingPlayerId) ?? this.getLocalPlayerData();
      const weaponEnts = pd?.weaponEntities ?? [];

      if (card.type === 'weapon_levelup') {
        for (const we of weaponEnts) {
          const w = this.world.getComponent<Weapon>(we, WEAPON);
          if (w && [6, 12, 18].includes(w.level)) {
            const ocCards = generateOverclockCards(w);
            if (ocCards.length > 0) {
              this.upgradeCards = ocCards;
              this.selectedUpgrade = 0;
              if (this.networkRole === 'host' && this.upgradingPlayerId !== this.localPlayerId && this.netHost) {
                this.netHost.sendToPlayer(this.upgradingPlayerId, {
                  type: MessageType.UpgradeOptions, playerId: this.upgradingPlayerId,
                  cards: this.upgradeCards.map((c, i) => ({
                    index: i, id: c.id, name: c.name, description: c.description,
                    rarity: c.rarity, cardType: c.type, weaponName: c.weaponName,
                    overclockTier: c.overclockTier,
                  })),
                });
              }
              return;
            }
          }
        }
      }

      if (this.networkRole === 'host' && this.netHost) {
        this.netHost.broadcast({ type: MessageType.UpgradeResolved, playerId: this.upgradingPlayerId });
      }

      if (this.networkRole === 'client' && this.netClient) {
        this.netClient.send({ type: MessageType.UpgradePick, playerId: this.localPlayerId, cardIndex: index });
        changeState(this.stateMgr, GameState.Playing);
        return;
      }

      if (this.networkRole === 'host') {
        this.processNextUpgrade();
      } else {
        changeState(this.stateMgr, GameState.Playing);
      }
    }
  }

  private endRun(): void {
    let kills = 0;
    for (const [, pd] of this.playerData) {
      const p = this.world.getComponent<Player>(pd.entity, PLAYER);
      if (p) kills += p.kills;
    }
    // Fallback: read kills from world query if playerData is empty (client)
    if (this.playerData.size === 0) {
      for (const pe of this.world.query(PLAYER)) {
        const p = this.world.getComponent<Player>(pe, PLAYER);
        if (p) { kills += p.kills; break; }
      }
    }

    this.meta.totalRuns++;
    this.meta.currency += this.run.currencyEarned;
    if (this.run.timer > this.meta.bestTime) this.meta.bestTime = this.run.timer;
    if (kills > this.meta.bestKills) this.meta.bestKills = kills;
    saveMeta(this.meta);

    this.disconnectNetwork();
    changeState(this.stateMgr, GameState.Menu);
  }

  // === Networking ===

  private async createRoom(): Promise<void> {
    this.networkRole = 'host';
    this.localPlayerId = 0;
    this.lobbyError = '';

    try {
      this.netClient = new NetClient();
      await this.netClient.connect(this.getRelayUrl());
      this.setupNetworkHandlers();
      this.netClient.send({ type: MessageType.CreateRoom });
    } catch {
      this.lobbyError = 'Failed to connect to server';
      this.networkRole = 'solo';
    }
  }

  private async joinRoom(code: string): Promise<void> {
    this.networkRole = 'client';
    this.lobbyError = '';

    try {
      this.netClient = new NetClient();
      await this.netClient.connect(this.getRelayUrl());
      this.setupNetworkHandlers();
      this.netClient.send({ type: MessageType.JoinRoom, roomCode: code });
    } catch {
      this.lobbyError = 'Failed to connect to server';
      this.networkRole = 'solo';
    }
  }

  private getRelayUrl(): string {
    // Check for explicit relay URL
    const envUrl = (import.meta as any).env?.VITE_RELAY_URL;
    if (envUrl) return envUrl;

    // Production (single-service): WS on same origin (Render serves both static + WS)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // includes port if non-default
    if (window.location.port === '' || window.location.port === '443' || window.location.port === '80') {
      return `${protocol}//${host}`;
    }

    // Local dev: ws on same hostname, port 9001
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:9001`;
  }

  private setupNetworkHandlers(): void {
    if (!this.netClient) return;

    this.netClient.onMessage = (msg: NetMessage) => {
      switch (msg.type) {
        case MessageType.RoomCreated:
          this.onRoomCreated(msg as RoomCreatedMsg);
          break;
        case MessageType.JoinedRoom:
          this.onJoinedRoom(msg as JoinedRoomMsg);
          break;
        case MessageType.PlayerJoined:
          this.onPlayerJoined(msg as PlayerJoinedMsg);
          break;
        case MessageType.PlayerLeft:
          this.onPlayerLeft(msg as PlayerLeftMsg);
          break;
        case MessageType.StartGame:
          this.onNetStartGame(msg as StartGameMsg);
          break;
        case MessageType.ClassSelect:
          this.onNetClassSelect(msg as any);
          break;
        case MessageType.Input:
          this.onNetInput(msg as any);
          break;
        case MessageType.Snapshot:
          this.onNetSnapshot(msg as SnapshotMsg);
          break;
        case MessageType.UpgradeOptions:
          this.onNetUpgradeOptions(msg as UpgradeOptionsMsg);
          break;
        case MessageType.UpgradePick:
          this.onNetUpgradePick(msg as any);
          break;
        case MessageType.UpgradeResolved:
          this.onNetUpgradeResolved(msg as UpgradeResolvedMsg);
          break;
        case MessageType.GameOver:
          this.onNetGameOver(msg as GameOverMsg);
          break;
        case MessageType.RoomError:
          this.lobbyError = (msg as RoomErrorMsg).reason;
          break;
      }
    };

    this.netClient.onDisconnect = () => {
      if (this.networkRole === 'client' && this.stateMgr.current === GameState.Playing) {
        this.lobbyError = 'Host disconnected';
        changeState(this.stateMgr, GameState.Menu);
      }
      this.networkRole = 'solo';
    };
  }

  private onRoomCreated(msg: RoomCreatedMsg): void {
    this.lobby.roomCode = msg.roomCode;
    this.localPlayerId = msg.playerId;
    this.lobby.players = [{ playerId: msg.playerId, ready: false }];
    changeState(this.stateMgr, GameState.ClassSelect);
  }

  private onJoinedRoom(msg: JoinedRoomMsg): void {
    this.lobby.roomCode = msg.roomCode;
    this.localPlayerId = msg.playerId;
    this.lobby.players = msg.players.map((p: any) => ({ playerId: p.playerId, ready: false }));
    changeState(this.stateMgr, GameState.ClassSelect);
  }

  private onPlayerJoined(msg: PlayerJoinedMsg): void {
    this.lobby.players.push({ playerId: msg.playerId, ready: false });
  }

  private onPlayerLeft(msg: PlayerLeftMsg): void {
    this.lobby.players = this.lobby.players.filter(p => p.playerId !== msg.playerId);
    if (this.stateMgr.current === GameState.Playing || this.stateMgr.current === GameState.Upgrading) {
      this.removePlayer(msg.playerId);
    }
  }

  private removePlayer(playerId: number): void {
    const pd = this.playerData.get(playerId);
    if (!pd) return;
    for (const we of pd.weaponEntities) {
      this.world.destroyEntity(we);
    }
    this.world.destroyEntity(pd.entity);
    this.playerData.delete(playerId);
  }

  private onNetStartGame(msg: StartGameMsg): void {
    if (this.networkRole === 'client') {
      // Client: DON'T spawn entities — just prepare empty world, snapshots will populate it
      this.startClientGame();
    }
  }

  private onNetClassSelect(msg: { playerId: number; classType: ClassType }): void {
    this.lobby.classSelections.set(msg.playerId, msg.classType);
    const p = this.lobby.players.find(p => p.playerId === msg.playerId);
    if (p) p.ready = true;
  }

  private onNetInput(msg: { playerId: number; input: { moveX: number; moveY: number; dash: boolean; ability: boolean } }): void {
    if (this.networkRole !== 'host') return;
    const pd = this.playerData.get(msg.playerId);
    if (!pd) return;
    const input = this.world.getComponent<any>(pd.entity, INPUT);
    if (input) {
      input.moveX = msg.input.moveX;
      input.moveY = msg.input.moveY;
      input.dash = msg.input.dash;
      input.ability = msg.input.ability;
    }
  }

  private onNetSnapshot(msg: SnapshotMsg): void {
    if (this.networkRole !== 'client') return;

    // React to raw snapshot diffs (damage numbers, death particles, etc.)
    const rawSnapshot = msg.snapshot as SnapshotData;
    this.clientReactor.reactToSnapshot(
      this.prevRawSnapshot, rawSnapshot, this.world, this.screenShake, this.hitPause,
    );
    this.prevRawSnapshot = rawSnapshot;

    // Handle beam events from host
    if (msg.events) {
      for (const ev of msg.events) {
        if (ev.type === 'beam') {
          spawnBeamFx(ev.x0, ev.y0, ev.x1, ev.y1, 0.15);
        }
      }
    }

    if (this.interpolator) {
      this.interpolator.pushSnapshot(msg.snapshot, msg.tick);
    }
    // Update run timer from host tick
    if (typeof msg.tick === 'number') {
      this.run.timer = msg.tick;
    }
  }

  private onNetUpgradeOptions(msg: UpgradeOptionsMsg): void {
    if (this.networkRole !== 'client') return;
    if (msg.playerId !== this.localPlayerId) return;
    this.upgradeCards = msg.cards.map(c => ({
      id: c.id, name: c.name, description: c.description,
      rarity: c.rarity as any, type: c.cardType as any,
      weaponName: c.weaponName, overclockTier: c.overclockTier as any,
      apply: () => {},
    }));
    this.selectedUpgrade = 0;
    this.upgradingPlayerId = this.localPlayerId;
    changeState(this.stateMgr, GameState.Upgrading);
  }

  private onNetUpgradePick(msg: { playerId: number; cardIndex: number }): void {
    if (this.networkRole !== 'host') return;
    if (msg.playerId === this.upgradingPlayerId && msg.cardIndex >= 0 && msg.cardIndex < this.upgradeCards.length) {
      this.pickUpgrade(msg.cardIndex);
    }
  }

  private onNetUpgradeResolved(_msg: UpgradeResolvedMsg): void {
    if (this.networkRole !== 'client') return;
    if (this.stateMgr.current === GameState.Upgrading) {
      changeState(this.stateMgr, GameState.Playing);
    }
  }

  private onNetGameOver(_msg: GameOverMsg): void {
    changeState(this.stateMgr, GameState.GameOver);
  }

  private allPlayersReady(): boolean {
    for (const p of this.lobby.players) {
      if (!this.lobby.classSelections.has(p.playerId)) return false;
    }
    return true;
  }

  private hostStartGame(): void {
    if (this.networkRole !== 'host') return;

    const configs: PlayerConfig[] = [];
    for (const p of this.lobby.players) {
      const classType = this.lobby.classSelections.get(p.playerId) ?? ClassType.Warrior;
      configs.push({ playerId: p.playerId, classType });
    }

    this.netHost = new NetHost(this.netClient!);
    this.snapshotMgr = new SnapshotManager(this.world);

    // Send start game to all clients
    this.netHost.broadcast({ type: MessageType.StartGame, configs });

    // Host runs the full game
    this.startGame(configs);
  }

  private disconnectNetwork(): void {
    if (this.netClient) {
      this.netClient.disconnect();
      this.netClient = null;
    }
    this.netHost = null;
    this.networkRole = 'solo';
    this.localPlayerId = 0;
    this.lobby = createLobby();
    this.lobbyMode = 'menu';
    this.interpolator = null;
    this.snapshotMgr = null;
  }

  // === Game Loop ===

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(time: number): void {
    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = Math.min(rawDt, TICK_DT * MAX_FRAME_SKIP);

    const state = this.stateMgr.current;

    if (state === GameState.Playing) {
      if (this.networkRole === 'client') {
        // Client: apply interpolated snapshots, no ECS simulation
        if (this.interpolator && this.snapshotMgr) {
          this.interpolator.update(rawDt);
          const snapshot = this.interpolator.getInterpolated();
          if (snapshot) {
            this.snapshotMgr.applySnapshot(snapshot);
            this.world.flushDestroy();
          }
        }

        // Tick client-only visual effects (particles, damage numbers, damage flash)
        ParticleSystem.update(this.world, rawDt);
        this.updateClientEffects(rawDt);
        this.world.flushDestroy();

        // Update camera to follow local player (find by playerId in snapshot data)
        this.updateClientCamera(rawDt);

        // Send local input to host — read keyboard directly, don't rely on InputSystem
        this.sendLocalInput();
      } else {
        // Host or Solo: run full ECS simulation
        const paused = updateHitPause(this.hitPause, rawDt);
        if (!paused) {
          this.accumulator += dt;
          let steps = 0;
          while (this.accumulator >= TICK_DT && steps < MAX_FRAME_SKIP) {
            this.world.update(TICK_DT);
            this.accumulator -= TICK_DT;
            steps++;
          }
        }

        // Host: broadcast snapshots at 20Hz
        if (this.networkRole === 'host' && this.netHost && this.snapshotMgr) {
          this.snapshotTimer += rawDt;
          if (this.snapshotTimer >= this.snapshotInterval) {
            this.snapshotTimer -= this.snapshotInterval;
            const snapshot = this.snapshotMgr.createSnapshot();
            const events = drainGameEvents();
            const msg: any = {
              type: MessageType.Snapshot,
              tick: this.run.timer,
              snapshot,
            };
            if (events.length > 0) msg.events = events;
            this.netHost.broadcast(msg);
          }
        }
      }

      updateScreenShake(this.screenShake, rawDt);

      if (this.networkRole !== 'client') {
        this.checkWeaponUnlocks();
        this.checkAllPlayersDead();
      }
    }

    // Bridge touch taps into mouse click system
    if (isTouchDevice) {
      const tap = consumeTap();
      if (tap) {
        this.mouseX = tap.x;
        this.mouseY = tap.y;
        this.mouseClicked = true;
        this.handleMenuTap();
      }
    }

    this.renderFrame();
    this.mouseClicked = false;

    requestAnimationFrame((t) => this.loop(t));
  }

  /** Client: read keyboard state directly and send to host */
  private sendLocalInput(): void {
    if (!this.netClient) return;

    // Read keyboard directly — InputSystem doesn't run on client
    const input = getKeyboardInput();

    this.netClient.send({
      type: MessageType.Input,
      playerId: this.localPlayerId,
      input,
    });
  }

  /** Client: tick damage numbers, damage flash, and other local-only effects */
  private updateClientEffects(dt: number): void {
    // Tick damage flash timers
    for (const entity of this.world.query(DAMAGE_FLASH)) {
      const flash = this.world.getComponent<DamageFlash>(entity, DAMAGE_FLASH);
      if (!flash) continue;
      flash.timer -= dt;
      if (flash.timer <= 0) {
        this.world.removeComponent(entity, DAMAGE_FLASH);
      }
    }

    // Animate damage numbers (float up, expire)
    for (const entity of this.world.query(DAMAGE_NUMBER, TRANSFORM)) {
      const dmgNum = this.world.getComponent<DamageNumberData>(entity, DAMAGE_NUMBER);
      const transform = this.world.getComponent<TransformType>(entity, TRANSFORM);
      if (!dmgNum || !transform) continue;
      dmgNum.timer += dt;
      transform.pos.y -= DAMAGE_NUMBER_RISE_SPEED * dt;
      if (dmgNum.timer >= dmgNum.duration) {
        this.world.destroyEntity(entity);
      }
    }
  }

  /** Client: manually update camera since CameraSystem doesn't run */
  private updateClientCamera(dt: number): void {
    // Find local player entity by playerId component
    for (const pe of this.world.query(PLAYER, TRANSFORM)) {
      const p = this.world.getComponent<Player>(pe, PLAYER);
      if (p && p.playerId === this.localPlayerId) {
        const t = this.world.getComponent<Transform>(pe, TRANSFORM)!;
        camera.targetX = t.pos.x;
        camera.targetY = t.pos.y;
        break;
      }
    }

    const CAMERA_LERP = 5;
    camera.prevX = camera.x;
    camera.prevY = camera.y;
    camera.x += (camera.targetX - camera.x) * CAMERA_LERP * dt;
    camera.y += (camera.targetY - camera.y) * CAMERA_LERP * dt;
  }

  private checkAllPlayersDead(): void {
    const allPlayers = this.world.query(PLAYER, HEALTH);
    if (allPlayers.length === 0) return;

    let allDowned = true;
    for (const pe of allPlayers) {
      const player = this.world.getComponent<Player>(pe, PLAYER)!;
      if (!player.downed) {
        allDowned = false;
        break;
      }
    }

    if (allDowned) {
      if (this.networkRole === 'host' && this.netHost) {
        this.netHost.broadcast({ type: MessageType.GameOver });
      }
      changeState(this.stateMgr, GameState.GameOver);
    }
  }

  private renderFrame(): void {
    const state = this.stateMgr.current;
    // For client, use alpha=1 since there's no accumulator-based interpolation (snapshot interpolator handles it)
    const alpha = this.networkRole === 'client' ? 1 : this.accumulator / TICK_DT;

    if (state === GameState.Menu) {
      drawMenu(this.cc);
    } else if (state === GameState.Lobby) {
      drawLobby(this.cc, this.lobby, this.lobbyMode, this.lobbyInput, this.lobbyError);
    } else if (state === GameState.ClassSelect) {
      drawClassSelect(this.cc, this.classSelectIndex);
    } else if (state === GameState.WaitingForPlayers) {
      drawWaitingRoom(this.cc, this.lobby, this.networkRole === 'host');
    } else if (state === GameState.Playing || state === GameState.Paused || state === GameState.Upgrading || state === GameState.GameOver) {
      render(this.world, this.cc, alpha, this.screenShake);

      // Show HUD — for client, find local player from world query
      this.renderHUD();

      // Draw touch controls overlay during gameplay
      if (isTouchDevice && state === GameState.Playing) {
        drawTouchControls(this.cc.ctx, this.cc.width, this.cc.height);
      }

      if (state === GameState.Upgrading) {
        if (this.upgradingPlayerId === this.localPlayerId || this.networkRole === 'solo') {
          const clicked = drawUpgradeMenu(this.cc, this.upgradeCards, this.selectedUpgrade, this.mouseX, this.mouseY, this.mouseClicked);
          if (clicked !== null) {
            this.pickUpgrade(clicked);
          }
        } else {
          this.drawWaitingForUpgrade();
        }
      } else if (state === GameState.GameOver) {
        let kills = 0;
        for (const pe of this.world.query(PLAYER)) {
          const p = this.world.getComponent<Player>(pe, PLAYER);
          if (p) { kills += p.kills; break; }
        }
        drawGameOver(this.cc, this.run, kills);
      } else if (state === GameState.Paused) {
        this.cc.ctx.save();
        this.cc.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.cc.ctx.fillRect(0, 0, this.cc.width, this.cc.height);
        this.cc.ctx.fillStyle = '#fff';
        this.cc.ctx.font = 'bold 24px monospace';
        this.cc.ctx.textAlign = 'center';
        this.cc.ctx.fillText('PAUSED', this.cc.width / 2, this.cc.height / 2);
        this.cc.ctx.font = '14px monospace';
        this.cc.ctx.fillStyle = '#888';
        this.cc.ctx.fillText('Press ESC to resume', this.cc.width / 2, this.cc.height / 2 + 30);
        this.cc.ctx.restore();
      }
    }
  }

  /** Render HUD for local player — works for both host (playerData) and client (world query) */
  private renderHUD(): void {
    // Try playerData first (host/solo)
    const localData = this.getLocalPlayerData();
    if (localData) {
      const player = this.world.getComponent<Player>(localData.entity, PLAYER);
      const health = this.world.getComponent<Health>(localData.entity, HEALTH);
      const playerT = this.world.getComponent<Transform>(localData.entity, TRANSFORM);

      if (player && health && playerT) {
        this.weaponSlotData.length = 0;
        for (const we of localData.weaponEntities) {
          const w = this.world.getComponent<Weapon>(we, WEAPON);
          if (w) this.weaponSlotData.push(w);
        }

        drawHUD(this.cc, player, health, this.run, {
          players: this.getAllPlayerPositions(),
          world: this.world,
        }, this.weaponSlotData);
        return;
      }
    }

    // Client fallback: find local player by playerId in world
    for (const pe of this.world.query(PLAYER, TRANSFORM, HEALTH)) {
      const p = this.world.getComponent<Player>(pe, PLAYER)!;
      if (p.playerId === this.localPlayerId) {
        const health = this.world.getComponent<Health>(pe, HEALTH)!;

        // Find weapon slots for this player
        this.weaponSlotData.length = 0;
        for (const we of this.world.query(WEAPON, WEAPON_OWNER)) {
          const wo = this.world.getComponent<WeaponOwner>(we, WEAPON_OWNER);
          if (wo && wo.owner === pe) {
            const w = this.world.getComponent<Weapon>(we, WEAPON);
            if (w) this.weaponSlotData.push(w);
          }
        }

        drawHUD(this.cc, p, health, this.run, {
          players: this.getAllPlayerPositions(),
          world: this.world,
        }, this.weaponSlotData);
        break;
      }
    }
  }

  private drawWaitingForUpgrade(): void {
    const { ctx, width, height } = this.cc;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Player ${this.upgradingPlayerId + 1} is choosing an upgrade...`, width / 2, height / 2);
    ctx.restore();
  }

  private getAllPlayerPositions(): Array<{ pos: { x: number; y: number }; color: string }> {
    const result: Array<{ pos: { x: number; y: number }; color: string }> = [];
    for (const pe of this.world.query(PLAYER, TRANSFORM)) {
      const t = this.world.getComponent<Transform>(pe, TRANSFORM)!;
      const r = this.world.getComponent<any>(pe, RENDERABLE);
      result.push({ pos: { x: t.pos.x, y: t.pos.y }, color: r?.color ?? '#fff' });
    }
    return result;
  }
}
