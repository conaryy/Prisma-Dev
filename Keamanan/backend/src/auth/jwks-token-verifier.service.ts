import { Injectable, UnauthorizedException } from '@nestjs/common';
import { webcrypto } from 'node:crypto';
import type { CurrentUser } from './current-user';

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtPayload = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  role?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  roles?: string[];
};

type JsonWebKeySetResponse = {
  keys?: Array<Record<string, unknown> & { kid?: string; kty?: string }>;
};

type CachedKey = {
  cacheUntil: number;
  key: unknown;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function parseJson<T>(value: string, fallbackMessage: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new UnauthorizedException(fallbackMessage);
  }
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function parseRoles(payload: JwtPayload) {
  const singleRole = payload.role ? [payload.role] : [];
  const realmRoles = payload.realm_access?.roles ?? [];
  const directRoles = payload.roles ?? [];
  const resourceRoles = Object.values(payload.resource_access ?? {}).flatMap((item) => item.roles ?? []);
  return [...new Set([...singleRole, ...realmRoles, ...directRoles, ...resourceRoles])];
}

@Injectable()
export class JwksTokenVerifierService {
  private readonly issuer = normalizeUrl(process.env.SSO_ISSUER || 'https://authapi.ryvidia.my.id');
  private readonly audience = (process.env.SSO_AUDIENCE || 'k2s-platform').trim();
  private readonly jwksUri = (process.env.SSO_JWKS_URL || `${this.issuer}/.well-known/jwks.json`).trim();
  private readonly clockSkewSeconds = Number.parseInt(process.env.SSO_CLOCK_SKEW || '60', 10) || 60;
  private readonly jwksCacheTtlMs = (Number.parseInt(process.env.SSO_JWKS_CACHE_TTL || '300', 10) || 300) * 1000;
  private readonly keyCache = new Map<string, CachedKey>();

  async verifyBearerToken(token: string): Promise<CurrentUser> {
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('Bearer token tidak valid.');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = segments;
    const header = parseJson<JwtHeader>(decodeBase64Url(encodedHeader).toString('utf8'), 'JWT header tidak valid.');
    const payload = parseJson<JwtPayload>(decodeBase64Url(encodedPayload).toString('utf8'), 'JWT payload tidak valid.');

    if (header.alg !== 'RS256') {
      throw new UnauthorizedException('Algoritma token tidak didukung.');
    }

    if (!header.kid) {
      throw new UnauthorizedException('JWT kid tidak ditemukan.');
    }

    const key = await this.getVerificationKey(header.kid);
    const verified = await webcrypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(encodedSignature),
      Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8')
    );

    if (!verified) {
      throw new UnauthorizedException('Signature token tidak valid.');
    }

    this.assertPayload(payload);

    return {
      sub: payload.sub!,
      email: payload.email,
      username: payload.preferred_username,
      name: payload.name,
      roles: parseRoles(payload),
    };
  }

  private assertPayload(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Subject token tidak ditemukan.');
    }

    if (normalizeUrl(payload.iss || '') !== this.issuer) {
      throw new UnauthorizedException('Issuer token tidak cocok.');
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (!audiences.includes(this.audience)) {
      throw new UnauthorizedException('Audience token tidak cocok.');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && nowSeconds > payload.exp + this.clockSkewSeconds) {
      throw new UnauthorizedException('Token sudah kedaluwarsa.');
    }

    if (typeof payload.nbf === 'number' && nowSeconds + this.clockSkewSeconds < payload.nbf) {
      throw new UnauthorizedException('Token belum aktif.');
    }
  }

  private async getVerificationKey(kid: string) {
    const cached = this.keyCache.get(kid);
    if (cached && cached.cacheUntil > Date.now()) {
      return cached.key as CryptoKey;
    }

    const response = await fetch(this.jwksUri, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Gagal mengambil JWKS.');
    }

    const payload = (await response.json()) as JsonWebKeySetResponse;
    const jwk = (payload.keys ?? []).find((item) => item.kid === kid && item.kty === 'RSA');

    if (!jwk) {
      throw new UnauthorizedException('Kunci verifikasi token tidak ditemukan.');
    }

    const key = await webcrypto.subtle.importKey(
      'jwk',
      {
        ...jwk,
        ext: true,
        key_ops: ['verify'],
      },
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    this.keyCache.set(kid, {
      key,
      cacheUntil: Date.now() + this.jwksCacheTtlMs,
    });

    return key as CryptoKey;
  }
}
