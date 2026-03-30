import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUser } from '../common/current-user';

export const CurrentUserDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as CurrentUser | undefined;
  }
);
