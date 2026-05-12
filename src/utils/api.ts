import { compareVersions, satisfies, validate } from 'compare-versions';
import { createRestAPIClient, createStreamingAPIClient } from 'masto';

import {
  BSKY_INSTANCE,
  atprotoInstanceInfo,
  createAtprotoClient,
  createPublicAtprotoClient,
} from './atproto-adapter';
import {
  getCachedAtprotoOAuthSession,
  parseAtprotoOAuthAccessToken,
  restoreAtprotoOAuthSession,
} from './atproto-oauth';
import mem, { type MemoizedFunction } from './mem';
import store from './store';
import {
  getAccount,
  getAccountByAccessToken,
  getAccountByInstance,
  getCurrentAcc,
  saveAccount,
  setCurrentAccountID,
} from './store-utils';

type JsonRecord = Record<string, unknown>;

interface AccountInfo {
  readonly id: string;
  readonly avatar?: string;
  readonly avatar_static?: string;
  readonly displayName?: string;
  readonly [key: string]: unknown;
}

interface StoredAccount {
  accessToken: string;
  atproto?: boolean;
  createdAt?: number;
  info: AccountInfo;
  instanceURL: string;
  lastAccessedAt?: number;
  updatedAt?: number;
  vapidKey?: string | null;
}

interface AtprotoSession {
  readonly service?: string;
  readonly session?: unknown;
  readonly type?: string;
  readonly [key: string]: unknown;
}

interface AtprotoOAuthToken {
  readonly sub: string;
  readonly [key: string]: unknown;
}

interface SearchResult {
  readonly statuses?: readonly unknown[];
}

type InstanceInfo = JsonRecord & {
  readonly configuration?: {
    readonly urls?: {
      readonly streaming?: string;
    };
  };
  readonly domain?: string;
  readonly uri?: string;
  readonly urls?: {
    readonly streamingApi?: string;
  };
};

interface MastoClient {
  readonly v1: {
    readonly accounts: {
      verifyCredentials(): Promise<AccountInfo>;
    };
    readonly instance: {
      fetch(): Promise<InstanceInfo | null | undefined>;
    };
    readonly preferences: {
      fetch(): Promise<JsonRecord>;
    };
    readonly [key: string]: unknown;
  };
  readonly v2: {
    readonly instance: {
      fetch(): Promise<InstanceInfo | null | undefined>;
    };
    readonly search: {
      list(options: {
        readonly limit: number;
        readonly q: string;
        readonly type: 'statuses';
      }): Promise<SearchResult | null | undefined>;
    };
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

type StreamingClient = unknown;

interface ApiClient {
  _streamingCallback?: ((streaming: StreamingClient) => void) | null;
  accessToken?: string | null;
  atproto?: boolean;
  instance: string;
  masto: MastoClient;
  streaming?: StreamingClient;
  onStreamingReady(callback: (streaming: StreamingClient) => void): void;
}

interface ApiOptions {
  readonly accessToken?: string;
  readonly account?: StoredAccount | null;
  readonly accountID?: string;
  readonly instance?: string;
}

interface ApiResult {
  readonly authenticated: boolean;
  readonly client: ApiClient;
  readonly instance: string;
  readonly masto: MastoClient;
  readonly streaming?: StreamingClient;
}

interface NodeInfoLink {
  readonly href: string;
  readonly rel: string;
}

interface NodeInfoCandidate {
  readonly href: string;
  readonly version: string;
}

interface StoreNamespace {
  del(key: string): unknown;
  get(key: string): unknown;
  getJSON(key: string): unknown;
  set(key: string, value: unknown): unknown;
  setJSON(key: string, value: unknown): unknown;
}

type AccountStoreNamespace = Pick<StoreNamespace, 'del' | 'get' | 'set'>;

interface Store {
  readonly account: AccountStoreNamespace;
  readonly local: StoreNamespace;
}

const typedStore = store as unknown as Store;
const readAccount = getAccount as (
  accountID?: string,
) => StoredAccount | null | undefined;
const readAccountByAccessToken = getAccountByAccessToken as (
  accessToken: string,
) => StoredAccount | null | undefined;
const readAccountByInstance = getAccountByInstance as (
  instance: string,
) => StoredAccount | null | undefined;
const readCurrentAccount = getCurrentAcc as () =>
  | StoredAccount
  | null
  | undefined;
const persistAccount = saveAccount as (account: StoredAccount) => void;
const persistCurrentAccountID = setCurrentAccountID as (
  accountID: string,
) => void;
const readAtprotoOAuthToken = parseAtprotoOAuthAccessToken as (
  accessToken?: string | null,
) => AtprotoOAuthToken | null | undefined;
const restoreAtprotoSession = restoreAtprotoOAuthSession as (
  subject: string,
) => Promise<unknown>;
const readCachedAtprotoOAuthSession = getCachedAtprotoOAuthSession as (
  subject?: string,
) => unknown;

// Default *fallback* instance
const DEFAULT_INSTANCE = 'mastodon.social';

// Per-instance masto instance
// Useful when only one account is logged in
// I'm not sure if I'll ever allow multiple logged-in accounts but oh well...
// E.g. apis['mastodon.social']
const apis: Record<string, ApiClient | undefined> = {};

// Per-account masto instance
// Note: There can be many accounts per instance
// Useful when multiple accounts are logged in or when certain actions require a specific account
// Just in case if I need this one day.
// E.g. accountApis['mastodon.social']['ACCESS_TOKEN']
const accountApis: Record<
  string,
  Record<string, ApiClient | undefined> | undefined
> = {};
window.__ACCOUNT_APIS__ = accountApis;

// Current account masto instance
let currentAccountApi: ApiClient | undefined;

function ensureAccountApis(
  instance: string,
): Record<string, ApiClient | undefined> {
  return (accountApis[instance] ??= {});
}

function getAccountApi(
  instance: string,
  accessToken: string,
): ApiClient | undefined {
  return accountApis[instance]?.[accessToken];
}

function cacheClient(client: ApiClient): void {
  apis[client.instance] = client;
  ensureAccountApis(client.instance);
  if (client.accessToken) {
    ensureAccountApis(client.instance)[client.accessToken] = client;
  }
}

export function initClient({
  instance = DEFAULT_INSTANCE,
  accessToken,
}: {
  readonly accessToken?: string | null;
  readonly instance?: string | null;
}): ApiClient {
  let normalizedInstance = instance ?? DEFAULT_INSTANCE;
  if (/^https?:\/\//.test(normalizedInstance)) {
    normalizedInstance = normalizedInstance
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
  const atprotoSession = parseAtprotoSession(accessToken);
  const atprotoOAuthSession = readAtprotoOAuthToken(accessToken);
  const oauthSession = readCachedAtprotoOAuthSession(atprotoOAuthSession?.sub);
  if (
    isAtprotoInstance(normalizedInstance) ||
    atprotoSession ||
    atprotoOAuthSession
  ) {
    normalizedInstance = BSKY_INSTANCE;
    let client: ApiClient | undefined;
    let persistedAccessToken = accessToken;
    const persistSession = (_event: unknown, session: unknown) => {
      if (!session || !persistedAccessToken) {
        return;
      }
      const account = readAccountByAccessToken(persistedAccessToken);
      if (!account) {
        return;
      }
      const nextAccessToken = JSON.stringify({
        service: atprotoSession?.service,
        session,
        type: 'atproto',
      });
      account.accessToken = nextAccessToken;
      account.updatedAt = Date.now();
      persistAccount(account);
      const cachedAccountApis = accountApis[normalizedInstance];
      if (cachedAccountApis?.[persistedAccessToken] !== undefined) {
        delete cachedAccountApis[persistedAccessToken];
      }
      persistedAccessToken = nextAccessToken;
      if (client) {
        client.accessToken = nextAccessToken;
        ensureAccountApis(normalizedInstance)[nextAccessToken] = client;
      }
    };
    const masto = (
      atprotoSession || atprotoOAuthSession
        ? createAtprotoClient({
            oauthSession,
            persistSession,
            service: atprotoSession?.service,
            session: atprotoSession?.session,
          })
        : createPublicAtprotoClient()
    ) as MastoClient;
    client = {
      accessToken,
      atproto: true,
      instance: normalizedInstance,
      masto,
      onStreamingReady(callback) {
        this._streamingCallback = callback;
      },
    };
    cacheClient(client);
    return client;
  }

  const url = `https://${normalizedInstance}`;

  const masto = createRestAPIClient({
    accessToken: accessToken ?? undefined,
    mediaTimeout: 10 * 60_000,
    timeout: 2 * 60_000,
    url,
  }) as unknown as MastoClient;

  const client: ApiClient = {
    accessToken,
    instance: normalizedInstance,
    masto,
    onStreamingReady(callback) {
      this._streamingCallback = callback;
    },
  };
  cacheClient(client);

  return client;
}

export function isAtprotoInstance(instance?: string | null): boolean {
  return (
    instance === BSKY_INSTANCE || instance === 'atproto' || instance === 'bsky'
  );
}

function parseAtprotoSession(
  accessToken?: string | null,
): AtprotoSession | null {
  if (!accessToken) {
    return null;
  }
  try {
    const data = JSON.parse(accessToken) as AtprotoSession;
    return data?.type === 'atproto' ? data : null;
  } catch {
    return null;
  }
}

export async function hydrateAtprotoOAuthAccessToken(
  accessToken: string,
): Promise<string> {
  const data = readAtprotoOAuthToken(accessToken);
  if (!data) {
    return accessToken;
  }
  await restoreAtprotoSession(data.sub);
  return accessToken;
}

export function hasInstance(instance: string): boolean {
  const instances =
    (typedStore.local.getJSON('instances') as Record<string, unknown> | null) ??
    {};
  return Boolean(instances[instance]);
}

// Get the instance information
// The config is needed for composing
export async function initInstance(
  client: ApiClient,
  instance: string,
): Promise<void> {
  console.log('INIT INSTANCE', client, instance);
  if (client.atproto) {
    const instances =
      (typedStore.local.getJSON('instances') as Record<
        string,
        unknown
      > | null) ?? {};
    instances[BSKY_INSTANCE] = atprotoInstanceInfo();
    typedStore.local.setJSON('instances', instances);
    const nodeInfos =
      (typedStore.local.getJSON('nodeInfos') as Record<
        string,
        unknown
      > | null) ?? {};
    nodeInfos[BSKY_INSTANCE] = {
      software: { name: 'mastodon', version: '4.4.0' },
    };
    typedStore.local.setJSON('nodeInfos', nodeInfos);
    return;
  }
  const { accessToken, masto } = client;
  // Request v2, fallback to v1 if fail
  let info: InstanceInfo | null | undefined;
  __BENCHMARK.start('fetch-instance');
  try {
    info = await masto.v2.instance.fetch();
  } catch {
    // Fallback below.
  }
  if (!info) {
    try {
      info = await masto.v1.instance.fetch();
    } catch {
      // Missing instance info is handled by returning early.
    }
  }
  __BENCHMARK.end('fetch-instance');
  if (!info) {
    return;
  }
  console.log(info);
  const {
    // V1
    uri,
    urls: { streamingApi } = {},
    // V2
    domain,
    configuration: { urls: { streaming } = {} } = {},
  } = info;

  const instances =
    (typedStore.local.getJSON('instances') as Record<string, unknown> | null) ??
    {};
  const canonicalInstance = domain ?? uri;
  if (canonicalInstance) {
    instances[
      canonicalInstance
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '')
        .toLowerCase()
    ] = info;
  }
  if (instance) {
    instances[instance.toLowerCase()] = info;
  }
  typedStore.local.setJSON('instances', instances);

  let nodeInfo: unknown;
  // GoToSocial requires we get the NodeInfo to identify server type
  // Spec: https://github.com/jhass/nodeinfo
  try {
    if (uri || domain) {
      const urlBase = uri ?? `https://${domain}`;
      const wellKnown = (await (
        await fetch(`${urlBase}/.well-known/nodeinfo`)
      ).json()) as { readonly links?: readonly NodeInfoLink[] };
      if (Array.isArray(wellKnown?.links)) {
        const schema = 'http://nodeinfo.diaspora.software/ns/schema/';
        const nodeInfoUrl = wellKnown.links
          .filter(
            (link) =>
              typeof link.rel === 'string' &&
              link.rel.startsWith(schema) &&
              validate(link.rel.slice(schema.length)),
          )
          .map((link): NodeInfoCandidate => {
            const version = link.rel.slice(schema.length);
            return {
              href: link.href,
              version,
            };
          })
          .toSorted((a, b) => -compareVersions(a.version, b.version))
          .find((candidate) => satisfies(candidate.version, '<=2'))?.href;
        if (nodeInfoUrl) {
          nodeInfo = await (await fetch(nodeInfoUrl)).json();
        }
      }
    }
  } catch {
    // NodeInfo is opportunistic metadata.
  }
  const nodeInfos =
    (typedStore.local.getJSON('nodeInfos') as Record<string, unknown> | null) ??
    {};
  if (nodeInfo) {
    nodeInfos[instance.toLowerCase()] = nodeInfo;
  }
  typedStore.local.setJSON('nodeInfos', nodeInfos);

  // This is a weird place to put this but here's updating the masto instance with the streaming API URL set in the configuration
  // Reason: Streaming WebSocket URL may change, unlike the standard API REST URLs
  const supportsWebSocket = 'WebSocket' in window;
  const streamingApiUrl = streaming ?? streamingApi;
  if (supportsWebSocket && streamingApiUrl) {
    console.log('🎏 Streaming API URL:', streamingApiUrl);
    // Masto.config.props.streamingApiUrl = streaming || streamingApi;
    // Legacy masto.ws
    const streamClient = createStreamingAPIClient({
      accessToken: accessToken ?? undefined,
      implementation: WebSocket,
      streamingApiUrl,
    }) as StreamingClient;
    client.streaming = streamClient;
    // Masto.ws = streamClient;
    console.log('🎏 Streaming API client:', client);

    if (client._streamingCallback) {
      try {
        client._streamingCallback(streamClient);
      } catch (error) {
        console.error('Error in streaming callback:', error);
      }
      client._streamingCallback = null;
    }
  }
  __BENCHMARK.end('init-instance');
}

// Get the account information and store it
export async function initAccount(
  client: ApiClient,
  instance: string,
  accessToken: string,
  vapidKey?: string | null,
): Promise<void> {
  if (client.atproto) {
    const atprotoAccount = await client.masto.v1.accounts.verifyCredentials();
    persistCurrentAccountID(atprotoAccount.id);
    persistAccount({
      accessToken,
      atproto: true,
      createdAt: Date.now(),
      info: atprotoAccount,
      instanceURL: BSKY_INSTANCE,
      vapidKey,
    });
    return;
  }
  const { masto } = client;
  const mastoAccount = await masto.v1.accounts.verifyCredentials();

  console.log('CURRENTACCOUNT SET', mastoAccount.id);
  persistCurrentAccountID(mastoAccount.id);

  persistAccount({
    accessToken,
    createdAt: Date.now(),
    info: mastoAccount,
    instanceURL: instance.toLowerCase(),
    vapidKey,
  });
}

export const getPreferences = mem(
  () => (typedStore.account.get('preferences') as JsonRecord | null) ?? {},
  {
    expires: 60 * 1000, // 1 minute
  },
) as MemoizedFunction<readonly [], JsonRecord>;

export function setPreferences(preferences: JsonRecord): void {
  getPreferences.cache.clear(); // Clear memo cache
  typedStore.account.set('preferences', preferences);
}

export function hasPreferences(): boolean {
  return Boolean(getPreferences());
}

// Get preferences
export async function initPreferences(client: ApiClient): Promise<void> {
  try {
    const { masto } = client;
    __BENCHMARK.start('fetch-preferences');
    const preferences = await masto.v1.preferences.fetch();
    __BENCHMARK.end('fetch-preferences');
    setPreferences(preferences);
  } catch (error) {
    // Silently fail
    console.error(error);
  }
}

// Get the masto instance
// If accountID is provided, get the masto instance for that account
export function api({
  instance: requestedInstance,
  accessToken,
  accountID,
  account,
}: ApiOptions = {}): ApiResult {
  // Always lowercase and trim the instance
  const instance = requestedInstance?.toLowerCase().trim();

  // If instance and accessToken are provided, get the masto instance for that account
  if (instance && accessToken) {
    const client =
      getAccountApi(instance, accessToken) ??
      initClient({ accessToken, instance });
    const { masto, streaming } = client;
    return {
      authenticated: true,
      client,
      instance,
      masto,
      streaming,
    };
  }

  if (accessToken) {
    // If only accessToken is provided, get the masto instance for that accessToken
    console.log('X 1', accountApis);
    for (const cachedInstance in accountApis) {
      const clientForAccessToken = getAccountApi(cachedInstance, accessToken);
      if (clientForAccessToken) {
        console.log('X 2', accountApis, cachedInstance, accessToken);
        const { masto, streaming } = clientForAccessToken;
        return {
          authenticated: true,
          client: clientForAccessToken,
          instance: cachedInstance,
          masto,
          streaming,
        };
      }
      console.log('X 3', accountApis, cachedInstance, accessToken);
      const storedAccount = readAccountByAccessToken(accessToken);
      if (storedAccount) {
        const storedAccessToken = storedAccount.accessToken;
        const storedInstance = storedAccount.instanceURL.toLowerCase().trim();
        const client = initClient({
          accessToken: storedAccessToken,
          instance: storedInstance,
        });
        const { masto, streaming } = client;
        return {
          authenticated: true,
          client,
          instance: storedInstance,
          masto,
          streaming,
        };
      }
      throw new Error('Access token not found');
    }
  }

  // If account is provided, get the masto instance for that account
  if (account || accountID) {
    const storedAccount = account ?? readAccount(accountID);
    if (storedAccount) {
      const storedAccessToken = storedAccount.accessToken;
      const storedInstance = storedAccount.instanceURL.toLowerCase().trim();
      const client =
        getAccountApi(storedInstance, storedAccessToken) ??
        initClient({
          accessToken: storedAccessToken,
          instance: storedInstance,
        });
      const { masto, streaming } = client;
      return {
        authenticated: true,
        client,
        instance: storedInstance,
        masto,
        streaming,
      };
    }
    throw new Error(`Account ${accountID} not found`);
  }

  const currentAccount = readCurrentAccount();

  // If only instance is provided, get the masto instance for that instance
  if (instance) {
    if (currentAccountApi?.instance === instance) {
      return {
        authenticated: true,
        client: currentAccountApi,
        instance,
        masto: currentAccountApi.masto,
        streaming: currentAccountApi.streaming,
      };
    }

    if (currentAccount?.instanceURL === instance) {
      const { accessToken: currentAccessToken } = currentAccount;
      currentAccountApi =
        getAccountApi(instance, currentAccessToken) ??
        initClient({ accessToken: currentAccessToken, instance });
      return {
        authenticated: true,
        client: currentAccountApi,
        instance,
        masto: currentAccountApi.masto,
        streaming: currentAccountApi.streaming,
      };
    }

    const instanceAccount = readAccountByInstance(instance);
    if (instanceAccount) {
      const storedAccessToken = instanceAccount.accessToken;
      const client =
        getAccountApi(instance, storedAccessToken) ??
        initClient({ accessToken: storedAccessToken, instance });
      const { masto, streaming } = client;
      return {
        authenticated: true,
        client,
        instance,
        masto,
        streaming,
      };
    }

    const client = apis[instance] ?? initClient({ instance });
    const { masto, streaming, accessToken: clientAccessToken } = client;
    return {
      authenticated: Boolean(clientAccessToken),
      client,
      instance,
      masto,
      streaming,
    };
  }

  // If no instance is provided, get the masto instance for the current account
  if (currentAccountApi) {
    return {
      authenticated: true,
      client: currentAccountApi,
      instance: currentAccountApi.instance,
      masto: currentAccountApi.masto,
      streaming: currentAccountApi.streaming,
    };
  }
  if (currentAccount) {
    const { accessToken: currentAccessToken, instanceURL: currentInstance } =
      currentAccount;
    currentAccountApi =
      getAccountApi(currentInstance, currentAccessToken) ??
      initClient({
        accessToken: currentAccessToken,
        instance: currentInstance,
      });
    return {
      authenticated: true,
      client: currentAccountApi,
      instance: currentInstance,
      masto: currentAccountApi.masto,
      streaming: currentAccountApi.streaming,
    };
  }

  // If no instance is provided and no account is logged in, get the masto instance for DEFAULT_INSTANCE
  const client =
    apis[DEFAULT_INSTANCE] ?? initClient({ instance: DEFAULT_INSTANCE });
  const { masto, streaming } = client;
  return {
    authenticated: false,
    client,
    instance: DEFAULT_INSTANCE,
    masto,
    streaming,
  };
}

window.__API__ = {
  accountApis,
  apis,
};
