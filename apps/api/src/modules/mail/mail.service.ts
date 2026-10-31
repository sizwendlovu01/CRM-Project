import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { JobsService } from '../jobs/jobs.service';
import type { RenderedEmail } from './mail.templates';

export interface MailMessage extends RenderedEmail {
  to: string;
}

const JOB_NAME = 'email.send';

/**
 * Transactional email. Messages are delivered by a background job so slow SMTP never blocks
 * a request. Locally, SMTP points at Mailpit (http://localhost:8025) - no paid provider needed.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;
  /** Captured messages when MAIL_TRANSPORT=memory (tests only). */
  readonly outbox: MailMessage[] = [];

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly jobs: JobsService,
  ) {
    if (env.MAIL_TRANSPORT === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
        connectionTimeout: 10_000,
      });
    }
  }

  onModuleInit(): void {
    this.jobs.register(JOB_NAME, (data) => this.deliver(data as unknown as MailMessage));
  }

  async send(message: MailMessage): Promise<void> {
    await this.jobs.enqueue(JOB_NAME, { ...message });
  }

  async deliver(message: MailMessage): Promise<void> {
    if (this.env.MAIL_TRANSPORT === 'none') {
      this.logger.warn(`Email "${message.subject}" not sent: MAIL_TRANSPORT=none`);
      return;
    }
    if (!this.transporter) {
      this.outbox.push(message);
      return;
    }
    await this.transporter.sendMail({
      from: this.env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    this.logger.log(`Email "${message.subject}" delivered`);
  }
}
