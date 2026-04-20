import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from './current-user';
import { JwksTokenVerifierService } from './jwks-token-verifier.service';

type AuthenticatedRequest = Request & {
  user?: CurrentUser;
};

function parseAllowedRoles() {
  return String(process.env.KEAMANAN_ADMIN_ROLES || 'admin,keamanan_admin')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly allowedRoles = parseAllowedRoles();

  constructor(private readonly tokenVerifier: JwksTokenVerifierService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
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
