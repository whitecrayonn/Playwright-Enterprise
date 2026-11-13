// Validation for `.env.json`. Pure: safe to import in the browser.
import type {BrowserName, StudioEnv} from './studio-types';

export const BROWSERS: BrowserName[] = ['chromium', 'firefox', 'webkit'];
export const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const TIMEOUT_MIN_MS = 1_000;
export const TIMEOUT_MAX_MS = 120_000;

export const DEFAULT_ENV: StudioEnv = {
  baseUrl: '',
  browser: 'chromium',
  headless: true,
  timeoutMs: 10_000,
  viewport: {width: 1280, height: 720},
  variables: {},
};

export const VIEWPORT_PRESETS: {label: string; width: number; height: number}[] = [
  {label: 'Desktop', width: 1280, height: 720},
  {label: 'Laptop', width: 1440, height: 900},
  {label: 'Tablet', width: 768, height: 1024},
  {label: 'Phone', width: 390, height: 844},
];

/** Variable names that look sensitive are masked in the UI. */
export function isSensitiveName(name: string): boolean {
  return /pass|secret|token|key|pwd|auth/i.test(name);
}

export type EnvErrors = Partial<Record<'baseUrl' | 'browser' | 'timeoutMs' | 'viewport' | 'variables' | 'file', string>>;

export type EnvValidation =
  | {ok: true; env: StudioEnv}
  | {ok: false; errors: EnvErrors};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toInt(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null;
}

export function validateEnv(input: unknown): EnvValidation {
  const errors: EnvErrors = {};
  if (!isRecord(input)) {
    return {ok: false, errors: {file: '.env.json must contain a JSON object.'}};
  }

  // baseUrl
  let baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim() : '';
  if (!baseUrl) {
    errors.baseUrl = 'Enter the address of the site to test, e.g. https://staging.example.com';
  } else {
    try {
      const u = new URL(baseUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        errors.baseUrl = 'Use an http:// or https:// address.';
      } else {
        // Keep a path prefix but drop a trailing slash so "/login" joins cleanly.
        baseUrl = u.toString().replace(/\/$/, '');
      }
    } catch {
      errors.baseUrl = 'This is not a valid address. Include http:// or https://';
    }
  }

  // browser
  const browser = (input.browser ?? DEFAULT_ENV.browser) as BrowserName;
  if (!BROWSERS.includes(browser)) {
    errors.browser = `Browser must be one of ${BROWSERS.join(', ')}.`;
  }

  // headless
  const headless = input.headless === undefined ? DEFAULT_ENV.headless : input.headless;
  if (typeof headless !== 'boolean') {
    errors.file = 'headless must be true or false.';
  }

  // timeout
  const timeoutMs = toInt(input.timeoutMs ?? DEFAULT_ENV.timeoutMs);
  if (timeoutMs === null || timeoutMs < TIMEOUT_MIN_MS || timeoutMs > TIMEOUT_MAX_MS) {
    errors.timeoutMs = `Timeout must be between ${TIMEOUT_MIN_MS / 1000} and ${TIMEOUT_MAX_MS / 1000} seconds.`;
  }

  // viewport
  const vp = isRecord(input.viewport) ? input.viewport : DEFAULT_ENV.viewport;
  const width = toInt(vp.width);
  const height = toInt(vp.height);
  if (width === null || height === null || width < 320 || width > 3840 || height < 240 || height > 2160) {
    errors.viewport = 'Viewport must be 320–3840 wide and 240–2160 high.';
  }

  // variables
  const variables: Record<string, string> = {};
  if (input.variables !== undefined) {
    if (!isRecord(input.variables)) {
      errors.variables = 'variables must be an object of name → text.';
    } else {
      for (const [name, value] of Object.entries(input.variables)) {
        if (!VARIABLE_NAME.test(name)) {
          errors.variables = `"${name}" is not a valid variable name. Use letters, digits and _ and start with a letter.`;
          break;
        }
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          errors.variables = `Variable ${name} must be text.`;
          break;
        }
        variables[name] = String(value);
      }
    }
  }

  if (Object.keys(errors).length > 0) return {ok: false, errors};
  return {
    ok: true,
    env: {
      baseUrl,
      browser,
      headless: headless as boolean,
      timeoutMs: timeoutMs as number,
      viewport: {width: width as number, height: height as number},
      variables,
    },
  };
}
