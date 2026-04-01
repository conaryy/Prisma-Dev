import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleDriveService } from './google-drive.service';

@Controller()
export class GoogleDriveCallbackController {
  constructor(private readonly googleDriveService: GoogleDriveService) {}

  @Get('api/google-drive/callback')
  async handleGoogleDriveCallback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response
  ) {
    const redirectUrl = await this.googleDriveService.handleAuthorizationCallback({
      state,
      code,
      error,
    });

    return response.redirect(redirectUrl);
  }
}
