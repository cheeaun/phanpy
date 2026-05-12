import Cookies from 'js-cookie';

import { getCurrentAccountNS } from './store-utils';

interface StorageNamespace {
  del(key: string): void | null;
  get(key: string): string | null;
  getJSON<Result = unknown>(key: string): Result | null;
  set(key: string, value: string): void | null;
  setJSON(key: string, value: unknown): void | null;
}

interface CookieNamespace {
  del(key: string): void;
  get(key: string): string | undefined;
  set(key: string, value: string): string | undefined;
}

interface SessionCookieNamespace {
  del(key: string): unknown;
  get(key: string): string | null | undefined;
  set(key: string, value: string): unknown;
}

interface AccountNamespace {
  del(key: string): void | null;
  get<Result = unknown>(key: string): Result | null;
  set(key: string, value: unknown): void | null;
}

export interface Store {
  readonly account: AccountNamespace;
  readonly cookie: CookieNamespace;
  readonly local: StorageNamespace;
  readonly session: StorageNamespace;
  readonly sessionCookie: SessionCookieNamespace;
}

const cookies = Cookies.withAttributes({ sameSite: 'strict', secure: true });

const canSetSecureCookie =
  navigator.cookieEnabled &&
  (() => {
    try {
      const key = '__phanpy_can_set_secure_cookie__';
      const value = '1';
      cookies.set(key, value);
      const result = cookies.get(key) === value;
      cookies.remove(key);
      return result;
    } catch {
      return false;
    }
  })();

const local: StorageNamespace = {
  del: (key) => {
    try {
      return localStorage.removeItem(key);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  getJSON<Result = unknown>(key: string) {
    try {
      const value = local.get(key);
      return value === null ? null : (JSON.parse(value) as Result);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  set: (key, value) => {
    try {
      return localStorage.setItem(key, value);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  setJSON: (key, value) => {
    try {
      return local.set(key, JSON.stringify(value));
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
};

const session: StorageNamespace = {
  del: (key) => {
    try {
      return sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  get: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  getJSON<Result = unknown>(key: string) {
    try {
      const value = session.get(key);
      return value === null ? null : (JSON.parse(value) as Result);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  set: (key, value) => {
    try {
      return sessionStorage.setItem(key, value);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  setJSON: (key, value) => {
    try {
      return session.set(key, JSON.stringify(value));
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
};

// Session secure cookie
const cookie: CookieNamespace = {
  del: (key) => cookies.remove(key),
  get: (key) => cookies.get(key),
  set: (key, value) => cookies.set(key, value),
};

// Cookie with sessionStorage fallback
const sessionCookie: SessionCookieNamespace = {
  del: (key) => {
    if (canSetSecureCookie) {
      return cookie.del(key);
    }
    return session.del(key);
  },
  get: (key) => {
    if (canSetSecureCookie) {
      return cookie.get(key);
    }
    return session.get(key);
  },
  set: (key, value) => {
    if (canSetSecureCookie) {
      return cookie.set(key, value);
    }
    return session.set(key, value);
  },
};

// Store with account namespace (id@domain.tld) <- uses id, not username
const account: AccountNamespace = {
  del: (key) => {
    try {
      const data = local.getJSON<Record<string, unknown>>(key) ?? {};
      delete data[getCurrentAccountNS()];
      return local.setJSON(key, data);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  get<Result = unknown>(key: string) {
    try {
      return (local.getJSON<Record<string, unknown>>(key)?.[
        getCurrentAccountNS()
      ] ?? null) as Result;
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
  set: (key, value) => {
    try {
      const data = local.getJSON<Record<string, unknown>>(key) ?? {};
      data[getCurrentAccountNS()] = value;
      return local.setJSON(key, data);
    } catch (error) {
      console.warn(error);
      return null;
    }
  },
};

const store: Store = { account, cookie, local, session, sessionCookie };

export default store;
