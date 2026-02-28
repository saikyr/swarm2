export type Entity = number;

let nextId = 1;

export function createEntityId(): Entity {
  return nextId++;
}

export function resetEntityIds(): void {
  nextId = 1;
}

export function setEntityIdOffset(n: number): void {
  nextId = n;
}
