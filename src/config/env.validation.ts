type Env = Record<string, string | undefined>;

const requiredVariables = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'KAKAO_CLIENT_ID',
  'KAKAO_CLIENT_SECRET',
  'GCP_STORAGE_BUCKET',
] as const;

const optionalPositiveIntegerVariables = [
  'PORT',
  'JWT_ACCESS_EXPIRES_IN_SECONDS',
  'JWT_REFRESH_EXPIRES_IN_SECONDS',
] as const;

const optionalUrlVariables = [
  'FRONTEND_ORIGIN',
  'LOCALHOST_ORIGIN',
  'GOOGLE_CALLBACK_URL',
  'KAKAO_CALLBACK_URL',
] as const;

export function validateEnv(env: Env = process.env) {
  const errors = [
    ...validateRequiredVariables(env),
    ...validateFrontendOrigin(env),
    ...validatePositiveIntegerVariables(env),
    ...validateUrlVariables(env),
  ];

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.join('\n')}`);
  }
}

function validateRequiredVariables(env: Env) {
  return requiredVariables
    .filter((variable) => isBlank(env[variable]))
    .map((variable) => `- ${variable} is required`);
}

function validateFrontendOrigin(env: Env) {
  if (!isBlank(env.FRONTEND_ORIGIN) || !isBlank(env.LOCALHOST_ORIGIN)) {
    return [];
  }

  return ['- FRONTEND_ORIGIN or LOCALHOST_ORIGIN is required'];
}

function validatePositiveIntegerVariables(env: Env) {
  return optionalPositiveIntegerVariables
    .filter((variable) => !isBlank(env[variable]))
    .filter((variable) => !isPositiveInteger(env[variable]))
    .map((variable) => `- ${variable} must be a positive integer`);
}

function validateUrlVariables(env: Env) {
  return optionalUrlVariables
    .filter((variable) => !isBlank(env[variable]))
    .filter((variable) => !isValidHttpUrl(env[variable]))
    .map((variable) => `- ${variable} must be a valid http(s) URL`);
}

function isBlank(value: string | undefined) {
  return value === undefined || value.trim() === '';
}

function isPositiveInteger(value: string | undefined) {
  if (!value) {
    return false;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

function isValidHttpUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
