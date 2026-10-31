import { Controller, Get, Headers, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { safeEqual } from '../../common/crypto';
import { Public } from '../../common/decorators';
import { AppException } from '../../common/errors';
import { RemindersService } from './reminders.service';

/**
 * Entry points for scheduled jobs on hosts without long-running processes. Vercel Cron calls
 * these with "Authorization: Bearer <CRON_SECRET>" (schedule in apps/api/vercel.json).
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('cron')
export class CronController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly reminders: RemindersService,
  ) {}

  @Public()
  @Get('reminders')
  runReminders(@Headers('authorization') authorization?: string) {
    this.authorize(authorization);
    return this.reminders.scan();
  }

  private authorize(authorization: string | undefined): void {
    // Without a configured secret the endpoints do not exist.
    if (!this.env.CRON_SECRET) throw AppException.notFound('Route');
    if (!authorization || !safeEqual(authorization, `Bearer ${this.env.CRON_SECRET}`)) throw AppException.unauthorized();
  }
}
