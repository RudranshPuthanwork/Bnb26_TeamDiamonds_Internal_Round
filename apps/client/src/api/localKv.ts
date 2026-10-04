/** Small string store: localStorage in the browser, memory in Node. Never holds secrets except in dev. */
export interface Kv {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export class MemoryKv implements Kv {
  private m = new Map<string, string>();
  get(key: string) {
    return this.m.get(key) ?? null;
  }
  set(key: string, value: string) {
    this.m.set(key, value);
  }
}

export const defaultKv = (): Kv => {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        get: (k) => localStorage.getItem(k),
        set: (k, v) => localStorage.setItem(k, v),
      };
    }
  } catch {
    /* storage blocked */
  }
  return new MemoryKv();
};
