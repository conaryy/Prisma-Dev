import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SsoAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const ssoConfigured =
      Boolean(process.env.SSO_ISSUER) &&
      Boolean(process.env.SSO_JWKS_URL) &&
      Boolean(process.env.SSO_AUDIENCE || process.env.SSO_CLIENT_ID);

    if (!ssoConfigured) {
      const req = context.switchToHttp().getRequest();
      req.user = {
        sub: 'local-dev-user',
        email: 'local@dev',
        username: 'local-dev',
        name: 'Local Development User',
        roles: ['admin'],
      };
      return true;
    }

    return super.canActivate(context);
  }
}
