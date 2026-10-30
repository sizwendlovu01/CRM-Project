import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { changePasswordSchema, updateProfileSchema } from '@crm/shared';
import type { z } from 'zod';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { ZBody } from '../../common/zod';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch()
  updateProfile(@CurrentUser() user: AuthUser, @ZBody(updateProfileSchema) body: z.infer<typeof updateProfileSchema>) {
    return this.users.updateProfile(user.id, body);
  }

  @Post('password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: AuthUser, @ZBody(changePasswordSchema) body: z.infer<typeof changePasswordSchema>) {
    await this.users.changePassword(user, body.currentPassword, body.newPassword);
    return { message: 'Password updated. Other sessions have been signed out.' };
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.users.listSessions(user);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.users.revokeSession(user, id);
  }

  @Post('sessions/revoke-others')
  @HttpCode(204)
  async revokeOthers(@CurrentUser() user: AuthUser) {
    await this.users.revokeOtherSessions(user);
  }
}
