let counter = 0;

export function createId(): string {
  counter++;
  return `test-id-${counter}-${Date.now()}`;
}

export function init(): typeof createId {
  return createId;
}

export function getConstants(): Record<string, unknown> {
  return {};
}

export function isCuid(id: string): boolean {
  return typeof id === "string" && id.length > 0;
}
