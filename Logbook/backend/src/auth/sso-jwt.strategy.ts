import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
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

@Injectable()
export class SsoJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const issuer = process.env.SSO_ISSUER;
    const audience = process.env.SSO_AUDIENCE || process.env.SSO_CLIENT_ID;
    const jwksUri = process.env.SSO_JWKS_URL;

    if (!issuer || !audience || !jwksUri) {
      // Keep backend bootable for local module development.
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: 'local-dev-only',
        ignoreExpiration: true,
      } as StrategyOptions);
      return;
    }

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
    } as StrategyOptions);
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
