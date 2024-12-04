import Cookies from 'js-cookie';

import { getCurrentAccountNS } from './store-utils';

const cookies = Cookies.withAttributes({ sameSite: 'strict', secure: true });

const local = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  getJSON: (key) => {
    try {
      return JSON.parse(local.get(key));
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  set: (key, value) => {
    try {
      return localStorage.setItem(key, value);
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  setJSON: (key, value) => {
    try {
      return local.set(key, JSON.stringify(value));
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  del: (key) => {
    try {
      return localStorage.removeItem(key);
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
};

const session = {
  get: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  getJSON: (key) => {
    try {
      return JSON.parse(session.get(key));
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  set: (key, value) => {
    try {
      return sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  setJSON: (key, value) => {
    try {
      return session.set(key, JSON.stringify(value));
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  del: (key) => {
    try {
      return sessionStorage.removeItem(key);
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
};

// Session secure cookie
const cookie = {
  get: (key) => cookies.get(key),
  set: (key, value) => cookies.set(key, value),
  del: (key) => cookies.remove(key),
};

// Cookie with sessionStorage fallback
const sessionCookie = {
  get: (key) => {
    if (navigator.cookieEnabled) {
      return cookie.get(key);
    } else {
      return session.get(key);
    }
  },
  set: (key, value) => {
    if (navigator.cookieEnabled) {
      return cookie.set(key, value);
    } else {
      return session.set(key, value);
    }
  },
  del: (key) => {
    if (navigator.cookieEnabled) {
      return cookie.del(key);
    } else {
      return session.del(key);
    }
  },
};

// Store with account namespace (id@domain.tld) <- uses id, not username
const account = {
  get: (key) => {
    try {
      return local.getJSON(key)[getCurrentAccountNS()];
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  set: (key, value) => {
    try {
      const data = local.getJSON(key) || {};
      data[getCurrentAccountNS()] = value;
      return local.setJSON(key, data);
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
  del: (key) => {
    try {
      const data = local.getJSON(key) || {};
      delete data[getCurrentAccountNS()];
      return local.setJSON(key, data);
    } catch (e) {
      console.warn(e);
      return null;
    }
  },
};

export default { local, session, sessionCookie, cookie, account };
