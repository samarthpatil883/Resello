import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
});

export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
) {
  const subject =
    purpose === 'VERIFY_EMAIL' ? 'Verify your Resello email' : 'Reset your Resello password';
  if (env.NODE_ENV === 'development') {
    console.info(`Resello ${purpose} OTP for ${email}: ${code}`);
  }

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject,
    text: `Your Resello code is ${code}. It expires in 10 minutes.`,
  });
}
