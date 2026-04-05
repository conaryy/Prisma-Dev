import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import type { CurrentUser } from '../common/current-user';

type JwtPayload = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  roles?: string[];
};

function parseRoles(payload: JwtPayload) {
  const realmRoles = payload.realm_access?.roles ?? [];
  const directRoles = payload.roles ?? [];
  const resourceRoles = Object.values(payload.resource_access ?? {}).flatMap(
    (item) => item.roles ?? []
  );
  return [...new Set([...realmRoles, ...directRoles, ...resourceRoles])];
}

function normalizeIssuer(value: string) {
  return value.replace(/\/+$/, '');
}

@Injectable()
export class SsoJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const issuer = normalizeIssuer(process.env.SSO_ISSUER || 'https://authapi.ryvidia.my.id');
    const audience = process.env.SSO_AUDIENCE || 'k2s-platform';
    const jwksUri =
      process.env.SSO_JWKS_URL || `${issuer}/.well-known/jwks.json`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      audience,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000,
        jwksUri,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }) as any,
    } as any);
  }

  validate(payload: JwtPayload): CurrentUser {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.preferred_username,
      name: payload.name,
      roles: parseRoles(payload),
    };
  }
}
