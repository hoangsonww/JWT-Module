import { EventEmitter } from "events";

export type AuthEventMap = {
  register: [{ userId: string; email: string }];
  login: [{ userId: string; email: string }];
  logout: [{ userId: string }];
  "logout:all": [{ userId: string }];
  "password:change": [{ userId: string }];
  "password:reset:request": [{ email: string }];
  "password:reset": [{ userId: string; email: string }];
  "email:change": [{ userId: string; newEmail: string }];
  "account:delete": [{ userId: string }];
  "token:refresh": [{ userId: string }];
  "session:revoke": [{ userId: string; sessionId: string }];
};

class TypedAuthEmitter extends EventEmitter {
  emit<K extends keyof AuthEventMap>(event: K, ...args: AuthEventMap[K]): boolean {
    return super.emit(event as string, ...args);
  }

  on<K extends keyof AuthEventMap>(event: K, listener: (...args: AuthEventMap[K]) => void): this {
    return super.on(event as string, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof AuthEventMap>(event: K, listener: (...args: AuthEventMap[K]) => void): this {
    return super.once(event as string, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof AuthEventMap>(event: K, listener: (...args: AuthEventMap[K]) => void): this {
    return super.off(event as string, listener as (...args: unknown[]) => void);
  }
}

export const authEvents = new TypedAuthEmitter();
