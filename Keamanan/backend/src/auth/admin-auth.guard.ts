import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from './current-user';
import { JwksTokenVerifierService } from './jwks-token-verifier.service';

type AuthenticatedRequest = Request & {
  user?: CurrentUser;
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function parseAllowedRoles() {
  return String(process.env.KEAMANAN_ADMIN_ROLES || 'admin,keamanan_admin')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getHostname(value: string | undefined) {
  if (!value) {
    return '';
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.split(':')[0]?.replace(/^\[|\]$/g, '').toLowerCase() ?? '';
  }
}

function isLocalDevelopmentRequest(request: Request) {
  if (process.env.NODE_ENV === 'production' || process.env.KEAMANAN_LOCAL_AUTH_BYPASS === 'false') {
    return false;
  }

  const requestHost = getHostname(request.headers.host);
  const originHost = getHostname(request.headers.origin);
  return LOCAL_HOSTNAMES.has(requestHost) || LOCAL_HOSTNAMES.has(originHost);
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly allowedRoles = parseAllowedRoles();

  constructor(private readonly tokenVerifier: JwksTokenVerifierService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      if (isLocalDevelopmentRequest(request)) {
        request.user = {
          sub: 'local-keamanan-admin',
          username: 'local-keamanan-admin',
          name: 'Local Keamanan Admin',
          roles: ['admin', 'keamanan_admin'],
        };
        return true;
      }

      throw new UnauthorizedException('Bearer token admin diperlukan.');
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token admin tidak valid.');
    }

    const user = await this.tokenVerifier.verifyBearerToken(token);
    request.user = user;

    if (this.allowedRoles.length === 0) {
      return true;
    }

    const hasAllowedRole = user.roles.some((role) => this.allowedRoles.includes(role.toLowerCase()));
    if (!hasAllowedRole) {
      throw new UnauthorizedException('Role Anda tidak diizinkan mengubah data keamanan.');
    }

    return true;
  }
}
