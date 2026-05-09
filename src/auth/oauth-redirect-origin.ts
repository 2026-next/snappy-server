import type { Request } from 'express';

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

type OAuthState = {
  redirectOrigin: string;
};

export function createOAuthState(request: Request) {
  const redirectOrigin = getRequestRedirectOrigin(request);
  if (!redirectOrigin) {
    return undefined;
  }

  return Buffer.from(JSON.stringify({ redirectOrigin })).toString('base64url');
}

export function getOAuthRedirectOrigin(request: Request) {
  const state = getSingleQueryValue(request.query.state);
  if (!state) {
    return getFallbackFrontendOrigin(request);
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf8'),
    ) as Partial<OAuthState>;
    if (
      parsed.redirectOrigin &&
      isAllowedRedirectOrigin(parsed.redirectOrigin)
    ) {
      return parsed.redirectOrigin;
    }
  } catch {
    return getFallbackFrontendOrigin(request);
  }

  return getFallbackFrontendOrigin(request);
}

function getRequestRedirectOrigin(request: Request) {
  const explicitOrigin = getSingleQueryValue(request.query.origin);
  if (explicitOrigin && isAllowedRedirectOrigin(explicitOrigin)) {
    return explicitOrigin;
  }

  const origin = request.headers.origin;
  if (origin && isAllowedRedirectOrigin(origin)) {
    return origin;
  }

  const referer = request.headers.referer;
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (isAllowedRedirectOrigin(refererOrigin)) {
        return refererOrigin;
      }
    } catch {
      return undefined;
    }
  }

  if (isLocalhostRequest(request)) {
    return getLocalhostFrontendOrigin();
  }

  return undefined;
}

function isAllowedRedirectOrigin(origin: string) {
  return getAllowedRedirectOrigins().has(origin) || isLocalhostOrigin(origin);
}

function getAllowedRedirectOrigins() {
  return new Set(
    [
      process.env.FRONTEND_ORIGIN,
      process.env.LOCALHOST_ORIGIN,
      DEFAULT_FRONTEND_ORIGIN,
    ].filter((origin): origin is string => Boolean(origin)),
  );
}

function getDefaultFrontendOrigin() {
  return process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN;
}

function getFallbackFrontendOrigin(request: Request) {
  if (isLocalhostRequest(request)) {
    return getLocalhostFrontendOrigin();
  }

  return getDefaultFrontendOrigin();
}

function getLocalhostFrontendOrigin() {
  return process.env.LOCALHOST_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN;
}

function isLocalhostRequest(request: Request) {
  const hostname =
    request.hostname ?? getHostHeaderHostname(request.headers.host);
  return Boolean(hostname && LOCALHOST_HOSTNAMES.has(hostname));
}

function getHostHeaderHostname(host: string | undefined) {
  if (!host) {
    return undefined;
  }

  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host.split(':')[0];
  }
}

function isLocalhostOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && url.hostname === 'localhost';
  } catch {
    return false;
  }
}

function getSingleQueryValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}
