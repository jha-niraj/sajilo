import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, phoneNumber } from 'better-auth/plugins'
import { db } from '@repo/db'
import { user, session, account, verification, rateLimit } from '@repo/db/schema'
import { resetPasswordEmail, verifyEmailTemplate, welcomeEmail } from './email-templates'

async function sendEmail(to: string, subject: string, html: string) {
    const resendKey = process.env.RESEND_API_KEY
    // Phone sign-ups carry a placeholder address; never mail it.
    if (!resendKey || to.endsWith('@phone.sajilo.app')) return
    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)
    await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@sajilo.app',
        to,
        subject,
        html,
    })
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: { user, session, account, verification, rateLimit },
    }),

    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        // Collectors use a 4-digit PIN as their password. Admin forms enforce stronger passwords.
        minPasswordLength: 4,

        sendResetPassword: async ({ user: u, url }) => {
            await sendEmail(
                u.email,
                'Reset your password',
                resetPasswordEmail({ name: u.name ?? u.email, resetUrl: url }),
            ).catch(console.error)
        },
    },

    emailVerification: {
        sendVerificationEmail: async ({ user: u, url }) => {
            await sendEmail(
                u.email,
                'Verify your email',
                verifyEmailTemplate({ name: u.name ?? u.email, verifyUrl: url }),
            ).catch(console.error)
        },
    },

    databaseHooks: {
        user: {
            create: {
                // Only send welcome immediately for social sign-ups (Google OAuth),
                // where the email is already verified at account creation.
                // Email/password users get the welcome email after OTP verification.
                after: async (u) => {
                    if (!u.emailVerified) return
                    await sendEmail(
                        u.email,
                        'Welcome!',
                        welcomeEmail({ name: u.name ?? u.email }),
                    ).catch(console.error)
                },
            },
        },
    },

    socialProviders:
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? {
                  google: {
                      clientId: process.env.GOOGLE_CLIENT_ID,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                  },
              }
            : {},

    trustedOrigins: [
        process.env.MAIN_APP_URL || 'http://localhost:3100',
        process.env.ADMIN_APP_URL || 'http://localhost:3001',
    ],

    user: {
        additionalFields: {
            role: {
                type: 'string',
                defaultValue: 'USER',
            },
            address: {
                type: 'string',
                required: false,
                input: false,
            },
            isActive: {
                type: 'boolean',
                defaultValue: true,
                required: false,
            },
            bio: {
                type: 'string',
                required: false,
            },
        },
    },

    session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
    },

    baseURL: process.env.BETTER_AUTH_URL,

    // localhost:3100 and :3001 share cookies (cookies ignore ports), so each app gets its own prefix.
    advanced: {
        cookiePrefix: process.env.AUTH_COOKIE_PREFIX || 'better-auth',
        // Without a readable client IP, the rate limiter puts everyone in one shared bucket, so five
        // PIN sign-ins by anyone lock out the next person (and the sign-in right after sign-up).
        // Cloudflare sets cf-connecting-ip to the real visitor address.
        ipAddress: {
            ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
        },
    },

    // A 4-digit PIN has only 10,000 combinations, so PIN sign-in is tightly limited and the
    // counters live in the database (Workers isolates do not share memory).
    rateLimit: {
        enabled: true,
        storage: 'database',
        window: 60,
        max: 100,
        customRules: {
            '/sign-in/phone-number': { window: 300, max: 5 },
            '/sign-in/email': { window: 300, max: 10 },
        },
    },

    plugins: [
        phoneNumber({
            // OTP is not live yet; sign-in is phone + PIN. Wire an SMS provider here to enable it.
            sendOTP: async ({ phoneNumber: phone }) => {
                console.warn(`[auth] OTP requested for ${phone} but no SMS provider is configured`)
            },
        }),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                const resendKey = process.env.RESEND_API_KEY
                if (!resendKey) return
                const { Resend } = await import('resend')
                const resend = new Resend(resendKey)
                const subject = type === 'email-verification'
                    ? 'Your verification code'
                    : type === 'forget-password'
                        ? 'Your password reset code'
                        : 'Your sign-in code'
                await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@sajilo.app',
                    to: email,
                    subject,
                    html: buildOtpEmail({ otp, subject, type }),
                }).catch(console.error)
            },
            otpLength: 6,
            expiresIn: 600, // 10 minutes
        }),
    ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user

function buildOtpEmail({ otp, subject, type }: { otp: string; subject: string; type: string }): string {
    const year = new Date().getFullYear()
    const bodyText = type === 'email-verification'
        ? 'Use this code to verify your email address. It expires in 10 minutes.'
        : type === 'forget-password'
            ? 'Use this code to reset your password. It expires in 10 minutes.'
            : 'Use this code to sign in. It expires in 10 minutes.'
    return `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:40px 16px;">
  <div style="background:#fff;border:1px solid #E2E0DA;border-radius:16px;overflow:hidden;">
    <div style="padding:28px 36px 20px;border-bottom:1px solid #E2E0DA;">
      <span style="font-size:16px;font-weight:600;color:#111211;letter-spacing:-0.015em;">Sajilo</span>
    </div>
    <div style="padding:32px 36px;">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111211;letter-spacing:-0.02em;">${subject}</h1>
      <p style="margin:0 0 28px;font-size:15px;color:#6B6E67;line-height:1.6;">${bodyText}</p>
      <div style="background:#F6F4EE;border:1px solid #E2E0DA;border-radius:12px;padding:20px;text-align:center;letter-spacing:0.3em;font-size:36px;font-weight:700;color:#111211;font-family:monospace;">
        ${otp}
      </div>
      <p style="margin:20px 0 0;font-size:13px;color:#9B9E97;text-align:center;">This code expires in 10 minutes</p>
    </div>
    <div style="padding:16px 36px;border-top:1px solid #E2E0DA;">
      <p style="margin:0;font-size:12px;color:#9B9E97;">If you didn&apos;t request this, you can safely ignore this email.</p>
    </div>
  </div>
  <p style="margin:12px 0 0;font-size:12px;color:#9B9E97;text-align:center;">&copy; ${year} Sajilo</p>
</div>
</body></html>`
}
