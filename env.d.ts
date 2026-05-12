/// <reference types="vite/client" />

declare const __BUILD_TIME__: string;
declare const __COMMIT_HASH__: string | undefined;
declare const __COMMIT_TIME__: string | undefined;
declare const __FAKE_COMMIT_HASH__: boolean;

declare module '*.po' {
  export const messages: Record<string, string>;
}

declare module 'punycode/' {
  const punycode: {
    toASCII(domain: string): string;
    toUnicode(domain: string): string;
  };

  export function toASCII(domain: string): string;
  export function toUnicode(domain: string): string;
  export default punycode;
}

interface ImportMetaEnv {
  readonly PHANPY_APP_ERROR_LOGGING?: string;
  readonly PHANPY_CLIENT_NAME?: string;
  readonly PHANPY_DEV?: string;
  readonly PHANPY_DISALLOW_ROBOTS?: string;
  readonly PHANPY_LINGVA_INSTANCES?: string;
  readonly PHANPY_PRIVACY_POLICY_URL?: string;
  readonly PHANPY_REFERRER_POLICY?: string;
  readonly PHANPY_TRANSLANG_INSTANCES?: string;
  readonly PHANPY_WEBSITE?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_PORT?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface BluepyBenchmark {
  start(name: string): void;
  end(name: string): void;
}

declare const __BENCHMARK: BluepyBenchmark;

interface Window {
  __ACCOUNT_APIS__?: Record<string, Record<string, unknown>>;
  __API__?: {
    apis?: Record<string, unknown>;
    accountApis?: Record<string, Record<string, unknown>>;
  };
  __BENCH_RESULTS?: Map<string, unknown>;
  __BENCHMARK?: BluepyBenchmark;
  __BLUEPY_OAUTH_ARGS__?: unknown;
  __BLUEPY_OAUTH_TEST_CLIENT__?: unknown;
  __CLOAK__?: () => void;
  __COMPOSE__?: unknown;
  __generateCodeChallenge?: unknown;
  __IDLE__?: boolean;
  __IGNORE_GET_ACCOUNT_ERROR__?: boolean;
  __nativeAlert?: typeof window.alert;
  __SHARED_DATA__?: unknown;
  __STATES__?: Record<string, unknown>;
  __STATES_STATS__?: () => void;
}
