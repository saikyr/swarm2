import { type Entity, createEntityId, resetEntityIds } from './entity';
import type { System } from './system';

export type ComponentMap<T> = Map<Entity, T>;

export class World {
  private components = new Map<string, ComponentMap<unknown>>();
  private entities = new Set<Entity>();
  private toDestroy: Entity[] = [];
  private systems: System[] = [];

  // Query cache: key is sorted component names joined, value is cached result
  private queryCache = new Map<string, Entity[]>();
  private queryCacheDirty = true;

  registerComponent<T>(name: string): ComponentMap<T> {
    const map = new Map<Entity, T>();
    this.components.set(name, map as ComponentMap<unknown>);
    return map;
  }

  getStore<T>(name: string): ComponentMap<T> {
    return this.components.get(name) as ComponentMap<T>;
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  createEntity(): Entity {
    const id = createEntityId();
    this.entities.add(id);
    this.queryCacheDirty = true;
    return id;
  }

  /** Create entity with a specific ID (for snapshot application) */
  createEntityWithId(id: Entity): Entity {
    this.entities.add(id);
    this.queryCacheDirty = true;
    return id;
  }

  hasEntity(id: Entity): boolean {
    return this.entities.has(id);
  }

  addComponent<T>(entity: Entity, storeName: string, data: T): void {
    const store = this.components.get(storeName);
    if (store) {
      store.set(entity, data);
      this.queryCacheDirty = true;
    }
  }

  getComponent<T>(entity: Entity, storeName: string): T | undefined {
    const store = this.components.get(storeName);
    return store?.get(entity) as T | undefined;
  }

  hasComponent(entity: Entity, storeName: string): boolean {
    const store = this.components.get(storeName);
    return store?.has(entity) ?? false;
  }

  removeComponent(entity: Entity, storeName: string): void {
    const store = this.components.get(storeName);
    if (store) {
      store.delete(entity);
      this.queryCacheDirty = true;
    }
  }

  query(...componentNames: string[]): Entity[] {
    if (componentNames.length === 0) return [...this.entities];

    // Build cache key
    const key = componentNames.length === 1 ? componentNames[0] : componentNames.join('|');

    if (!this.queryCacheDirty) {
      const cached = this.queryCache.get(key);
      if (cached !== undefined) return cached;
    }

    // Start with smallest set for efficiency
    let smallest: ComponentMap<unknown> | null = null;
    let smallestSize = Infinity;
    for (const name of componentNames) {
      const store = this.components.get(name);
      if (!store) {
        const empty: Entity[] = [];
        this.queryCache.set(key, empty);
        return empty;
      }
      if (store.size < smallestSize) {
        smallest = store;
        smallestSize = store.size;
      }
    }

    const result: Entity[] = [];
    if (!smallest) {
      this.queryCache.set(key, result);
      return result;
    }

    for (const entity of smallest.keys()) {
      let hasAll = true;
      for (const name of componentNames) {
        const store = this.components.get(name);
        if (!store || !store.has(entity)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) result.push(entity);
    }

    this.queryCache.set(key, result);
    return result;
  }

  destroyEntity(entity: Entity): void {
    this.toDestroy.push(entity);
  }

  flushDestroy(): void {
    if (this.toDestroy.length === 0) return;
    for (const entity of this.toDestroy) {
      this.entities.delete(entity);
      for (const store of this.components.values()) {
        store.delete(entity);
      }
    }
    this.toDestroy.length = 0;
    this.queryCacheDirty = true;
  }

  private invalidateQueryCache(): void {
    this.queryCache.clear();
    this.queryCacheDirty = false;
  }

  entityCount(): number {
    return this.entities.size;
  }

  update(dt: number): void {
    // Invalidate cache once at start of frame
    this.invalidateQueryCache();

    for (const system of this.systems) {
      system.update(this, dt);
    }
    this.flushDestroy();
  }

  clear(): void {
    for (const store of this.components.values()) {
      store.clear();
    }
    this.entities.clear();
    this.toDestroy.length = 0;
    this.queryCache.clear();
    this.queryCacheDirty = true;
    resetEntityIds();
  }

  getSnapshot(): Record<string, unknown> {
    const snap: Record<string, unknown> = {};
    for (const [name, store] of this.components) {
      snap[name] = [...store.entries()];
    }
    return snap;
  }

  applySnapshot(_snap: Record<string, unknown>): void {
    // Stub for future co-op
  }
}
