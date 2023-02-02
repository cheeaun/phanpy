import { getCurrentAccountNS } from './store-utils';

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

export default { local, session, account };
