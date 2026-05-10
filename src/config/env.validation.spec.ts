import { describe, expect, it } from '@jest/globals';
import { validateEnv } from './env.validation';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/snappy',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  KAKAO_CLIENT_ID: 'kakao-client-id',
  KAKAO_CLIENT_SECRET: 'kakao-client-secret',
  GCP_STORAGE_BUCKET: 'snappy-photo-bucket',
  FRONTEND_ORIGIN: 'https://snappyku.site',
  LOCALHOST_ORIGIN: 'http://localhost:5173',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/oauth/google/callback',
  KAKAO_CALLBACK_URL: 'http://localhost:3000/auth/oauth/kakao/callback',
  PORT: '3000',
  JWT_ACCESS_EXPIRES_IN_SECONDS: '900',
  JWT_REFRESH_EXPIRES_IN_SECONDS: '604800',
};

describe('validateEnv', () => {
  it('accepts a valid environment', () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it.each([
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'KAKAO_CLIENT_ID',
    'KAKAO_CLIENT_SECRET',
    'GCP_STORAGE_BUCKET',
  ])('rejects missing %s', (variable) => {
    const env = { ...validEnv, [variable]: '' };

    expect(() => validateEnv(env)).toThrow(`${variable} is required`);
  });

  it('requires at least one frontend origin', () => {
    const env = {
      ...validEnv,
      FRONTEND_ORIGIN: undefined,
      LOCALHOST_ORIGIN: undefined,
    };

    expect(() => validateEnv(env)).toThrow(
      'FRONTEND_ORIGIN or LOCALHOST_ORIGIN is required',
    );
  });

  it.each([
    'PORT',
    'JWT_ACCESS_EXPIRES_IN_SECONDS',
    'JWT_REFRESH_EXPIRES_IN_SECONDS',
  ])('rejects invalid numeric %s', (variable) => {
    const env = { ...validEnv, [variable]: '0' };

    expect(() => validateEnv(env)).toThrow(
      `${variable} must be a positive integer`,
    );
  });

  it.each([
    'FRONTEND_ORIGIN',
    'LOCALHOST_ORIGIN',
    'GOOGLE_CALLBACK_URL',
    'KAKAO_CALLBACK_URL',
  ])('rejects invalid URL %s', (variable) => {
    const env = { ...validEnv, [variable]: 'not-a-url' };

    expect(() => validateEnv(env)).toThrow(
      `${variable} must be a valid http(s) URL`,
    );
  });
});
