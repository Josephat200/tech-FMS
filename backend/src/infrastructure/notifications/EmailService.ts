import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../logger/logger';

export class EmailService {
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string | null;

  constructor() {
    const isConfigured =
      Boolean(env.SMTP_HOST) &&
      Boolean(env.SMTP_PORT) &&
      Boolean(env.SMTP_USER) &&
      Boolean(env.SMTP_PASS) &&
      Boolean(env.SMTP_FROM);

    if (!isConfigured) {
      this.transporter = null;
      this.fromAddress = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    this.fromAddress = env.SMTP_FROM ?? null;
  }

  async sendAccountCreatedEmail(input: {
    to: string;
    firstName: string;
    temporaryPassword: string;
    role: string;
  }): Promise<void> {
    if (!this.transporter || !this.fromAddress) {
      logger.warn(
        {
          email: input.to,
        },
        'SMTP not configured. Skipping account creation email notification.',
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: 'Your FLORANTE TECH account has been created',
      text: `Hello ${input.firstName},\n\nYour account has been created with role: ${input.role}.\nTemporary password: ${input.temporaryPassword}\n\nPlease sign in and change your password immediately.\n\nFLORANTE TECH`,
    });
  }

  async sendLoginVerificationCode(input: {
    to: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void> {
    if (!this.transporter || !this.fromAddress) {
      logger.warn(
        {
          email: input.to,
        },
        'SMTP not configured. Skipping MFA verification email delivery.',
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: 'FLORANTE TECH login verification code',
      text: `Your one-time verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.\n\nIf you did not attempt to sign in, contact your administrator immediately.`,
    });
  }
}
