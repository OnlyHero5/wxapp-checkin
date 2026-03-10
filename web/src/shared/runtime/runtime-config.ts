const DEFAULT_APP_BASE_PATH = "/";
const DEFAULT_API_BASE_PATH = "/api/web";
const DEFAULT_API_PROXY_TARGET = "http://127.0.0.1:9989";

type RuntimeEnv = Record<string, string | undefined>;

function trim(value: string | undefined) {
  return `${value ?? ""}`.trim();
}

function stripTrailingSlash(value: string) {
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

function looksLikeAbsoluteUrl(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

export function normalizeAppBasePath(value: string | undefined) {
  const normalized = trim(value);
  if (!normalized || normalized === "/") {
    return DEFAULT_APP_BASE_PATH;
  }

  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${stripTrailingSlash(withLeadingSlash)}/`;
}

export function normalizeApiBasePath(value: string | undefined) {
  const normalized = trim(value);
  if (!normalized) {
    return DEFAULT_API_BASE_PATH;
  }

  if (looksLikeAbsoluteUrl(normalized)) {
    return stripTrailingSlash(normalized);
  }

  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return stripTrailingSlash(withLeadingSlash);
}

export function getRouterBasename(appBasePath: string) {
  const normalized = normalizeAppBasePath(appBasePath);
  return normalized === "/" ? "/" : stripTrailingSlash(normalized);
}

export function shouldProxyApiBase(apiBasePath: string) {
  return apiBasePath.startsWith("/");
}

export function resolveRuntimeConfig(env: RuntimeEnv) {
  const appBasePath = normalizeAppBasePath(env.VITE_APP_BASE_PATH);

  return {
    appBasePath,
    routerBasename: getRouterBasename(appBasePath),
    apiBasePath: normalizeApiBasePath(env.VITE_API_BASE_PATH),
    apiProxyTarget: trim(env.VITE_API_PROXY_TARGET) || DEFAULT_API_PROXY_TARGET
  };
}
