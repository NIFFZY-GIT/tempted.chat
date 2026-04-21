import nodemailer from "nodemailer";

// Lazy transporter — created on first use so env vars are always available
// regardless of when the module is first imported (avoids cold-start issues
// where process.env may not be fully populated at import time).
let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST ?? "smtp.zoho.com";
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";

  if (!user || !pass) {
    throw new Error(`SMTP credentials missing: SMTP_USER=${user ? "set" : "MISSING"}, SMTP_PASS=${pass ? "set" : "MISSING"}`);
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return _transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const transport = getTransporter();
  const from = `"Tempted Chat" <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@zevarone.com"}>`;

  console.log(`[email] Sending "${subject}" to ${to} via ${process.env.SMTP_HOST ?? "smtp.zoho.com"}`);

  await transport.sendMail({ from, to, subject, html });

  console.log(`[email] Sent successfully to ${to}`);
}

// ─── Invoice Email ────────────────────────────────────────────────────────────

export interface InvoiceEmailParams {
  orderId: string;
  planName: string;
  tier: "vip" | "vvip";
  durationLabel: string;
  amountCents: number;
  activatedAt: number;
  expiresAt: number;
}

function formatDate(ms: number): string {
  return new Date(ms).toUTCString().replace(" GMT", " UTC");
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildInvoiceEmail(params: InvoiceEmailParams): string {
  const { orderId, planName, tier, durationLabel, amountCents, activatedAt, expiresAt } = params;

  const tierColor = tier === "vvip" ? "#a855f7" : "#f59e0b";
  const tierBg = tier === "vvip" ? "rgba(168,85,247,0.12)" : "rgba(245,158,11,0.12)";
  const tierLogo =
    tier === "vvip"
      ? "https://tempted.chat/asstes/vvip/vviplogo.png"
      : "https://tempted.chat/asstes/vip/viplogo.png";
  const tierLabel = tier === "vvip" ? "VVIP" : "VIP";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tempted Chat — Purchase Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png"
                   alt="Tempted Chat" height="48"
                   style="height:48px;display:block;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#13131a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

              <!-- Card top accent -->
              <div style="height:3px;background:linear-gradient(90deg,${tierColor},#ec4899);"></div>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px;">

                <!-- Tier badge + icon -->
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <img src="${tierLogo}" alt="${tierLabel}" height="72"
                         style="height:72px;display:block;margin-bottom:14px;" />
                    <span style="display:inline-block;padding:6px 18px;border-radius:100px;background:${tierBg};color:${tierColor};font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                      ${tierLabel} Activated
                    </span>
                  </td>
                </tr>

                <!-- Thank-you heading -->
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.25;">
                      Thank you for your purchase!
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <p style="margin:0;color:#888;font-size:15px;line-height:1.6;">
                      Your ${tierLabel} subscription is now active. Enjoy unlimited access.
                    </p>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
                  </td>
                </tr>

                <!-- Invoice table -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#888;font-size:13px;padding-bottom:14px;">Order ID</td>
                        <td align="right" style="color:#ccc;font-size:13px;font-family:monospace;padding-bottom:14px;">${orderId}</td>
                      </tr>
                      <tr>
                        <td style="color:#888;font-size:13px;padding-bottom:14px;">Plan</td>
                        <td align="right" style="color:#fff;font-size:13px;font-weight:600;padding-bottom:14px;">${planName}</td>
                      </tr>
                      <tr>
                        <td style="color:#888;font-size:13px;padding-bottom:14px;">Duration</td>
                        <td align="right" style="color:#ccc;font-size:13px;padding-bottom:14px;">${durationLabel}</td>
                      </tr>
                      <tr>
                        <td style="color:#888;font-size:13px;padding-bottom:14px;">Activated</td>
                        <td align="right" style="color:#ccc;font-size:13px;padding-bottom:14px;">${formatDate(activatedAt)}</td>
                      </tr>
                      <tr>
                        <td style="color:#888;font-size:13px;padding-bottom:0;">Expires</td>
                        <td align="right" style="color:#ccc;font-size:13px;padding-bottom:0;">${formatDate(expiresAt)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
                  </td>
                </tr>

                <!-- Total -->
                <tr>
                  <td style="padding-bottom:36px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#fff;font-size:16px;font-weight:700;">Total Paid</td>
                        <td align="right" style="color:${tierColor};font-size:22px;font-weight:800;">${formatPrice(amountCents)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="https://tempted.chat"
                       style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,${tierColor},#ec4899);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;letter-spacing:0.5px;">
                      Start Chatting
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
                  </td>
                </tr>

                <!-- Footer note -->
                <tr>
                  <td align="center">
                    <p style="margin:0;color:#555;font-size:12px;line-height:1.7;">
                      If you did not make this purchase, please contact us immediately at
                      <a href="mailto:support@zevarone.com" style="color:#888;text-decoration:none;">support@zevarone.com</a>.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer brand -->
          <tr>
            <td align="center" style="padding-top:32px;padding-bottom:8px;">
              <img src="https://tempted.chat/asstes/zevaronelogo/Asset 13.svg"
                   alt="Zevarone" height="22"
                   style="height:22px;display:block;opacity:0.5;" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;color:#444;font-size:11px;">
                &copy; ${new Date().getFullYear()} Zevarone. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Account Block Warning Email ─────────────────────────────────────────────

export function buildAccountBlockedEmail(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tempted Chat — Account Restricted</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png"
                   alt="Tempted Chat" height="48" style="height:48px;display:block;" />
            </td>
          </tr>

          <tr>
            <td style="background:#13131a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
              <div style="height:3px;background:linear-gradient(90deg,#ef4444,#f97316);"></div>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px;">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <div style="width:64px;height:64px;border-radius:999px;background:rgba(239,68,68,0.12);display:inline-flex;align-items:center;justify-content:center;font-size:30px;">⚠️</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Account Restricted</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <p style="margin:0;color:#9ca3af;font-size:15px;line-height:1.7;max-width:460px;">
                      Your Tempted Chat account has been blocked by the moderation team. You will not be able to sign in until the restriction is removed.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <p style="margin:0;color:#d1d5db;font-size:14px;line-height:1.7;">
                      If you believe this was a mistake, contact
                      <a href="mailto:support@zevarone.com" style="color:#f9a8d4;text-decoration:none;">support@zevarone.com</a>
                      for review.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAccountWarningEmail(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tempted Chat — Warning Notice</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png"
                   alt="Tempted Chat" height="48" style="height:48px;display:block;" />
            </td>
          </tr>

          <tr>
            <td style="background:#13131a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
              <div style="height:3px;background:linear-gradient(90deg,#f59e0b,#ec4899);"></div>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px;">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <div style="width:64px;height:64px;border-radius:999px;background:rgba(245,158,11,0.12);display:inline-flex;align-items:center;justify-content:center;font-size:30px;">⚠️</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Warning Notice</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <p style="margin:0;color:#9ca3af;font-size:15px;line-height:1.7;max-width:460px;">
                      Your Tempted Chat account has received a moderation warning. Continued violations may result in account restrictions or a permanent block.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <p style="margin:0;color:#d1d5db;font-size:14px;line-height:1.7;">
                      Please review the platform rules. If you need help or want to appeal, contact
                      <a href="mailto:support@zevarone.com" style="color:#f9a8d4;text-decoration:none;">support@zevarone.com</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Admin Invite Email ───────────────────────────────────────────────────────

export function buildAdminInviteEmail(inviterName: string, inviteLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You&apos;re invited to manage Tempted Chat</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png"
                   alt="Tempted Chat" height="48" style="height:48px;display:block;" />
            </td>
          </tr>

          <tr>
            <td style="background:#13131a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
              <div style="height:3px;background:linear-gradient(90deg,#a855f7,#ec4899);"></div>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px;">

                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <div style="width:60px;height:60px;border-radius:50%;background:rgba(168,85,247,0.12);display:inline-flex;align-items:center;justify-content:center;">
                      <span style="font-size:28px;">🛡️</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">Admin Invitation</h1>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <p style="margin:0;color:#888;font-size:15px;line-height:1.7;max-width:420px;">
                      <strong style="color:#ccc;">${inviterName}</strong> has invited you to become an
                      administrator on <strong style="color:#ccc;">Tempted Chat</strong>.
                      Click the button below to accept. This invite expires in <strong style="color:#ccc;">48 hours</strong>.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="${inviteLink}"
                       style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;letter-spacing:0.5px;">
                      Accept Admin Invite
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <p style="margin:0;color:#555;font-size:12px;line-height:1.7;">
                      If the button doesn&apos;t work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:8px 0 0;word-break:break-all;">
                      <a href="${inviteLink}" style="color:#888;font-size:12px;text-decoration:underline;">${inviteLink}</a>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
                  </td>
                </tr>

                <tr>
                  <td align="center">
                    <p style="margin:0;color:#555;font-size:12px;line-height:1.7;">
                      If you didn&apos;t expect this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-top:32px;padding-bottom:8px;">
              <img src="https://tempted.chat/asstes/zevaronelogo/Asset 13.svg"
                   alt="Zevarone" height="22" style="height:22px;display:block;opacity:0.5;" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;color:#444;font-size:11px;">
                &copy; ${new Date().getFullYear()} Zevarone. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Password Reset Email ─────────────────────────────────────────────────────

export function buildPasswordResetEmail(code: string): string {
  // Render the 6-digit code as spaced individual character boxes for readability.
  const codeBoxes = code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;font-size:28px;font-weight:900;color:#ffffff;background:#1e1e2a;border:1px solid rgba(255,255,255,0.12);border-radius:10px;margin:0 4px;font-family:monospace,monospace;">${d}</span>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tempted Chat — Your Reset Code</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png"
                   alt="Tempted Chat" height="48"
                   style="height:48px;display:block;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#13131a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

              <!-- Card top accent -->
              <div style="height:3px;background:linear-gradient(90deg,#ec4899,#a855f7);"></div>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 40px;">

                <!-- Icon -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <div style="width:60px;height:60px;border-radius:50%;background:rgba(236,72,153,0.12);display:inline-flex;align-items:center;justify-content:center;">
                      <span style="font-size:28px;">🔑</span>
                    </div>
                  </td>
                </tr>

                <!-- Heading -->
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">
                      Your Password Reset Code
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <p style="margin:0;color:#888;font-size:15px;line-height:1.7;max-width:420px;">
                      Enter the code below in the app to reset your Tempted Chat password.
                      This code expires in <strong style="color:#ccc;">15 minutes</strong>.
                    </p>
                  </td>
                </tr>

                <!-- Code boxes -->
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <div style="display:inline-block;background:rgba(236,72,153,0.04);border:1px solid rgba(236,72,153,0.15);border-radius:16px;padding:20px 24px;">
                      ${codeBoxes}
                    </div>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
                  </td>
                </tr>

                <!-- Security note -->
                <tr>
                  <td align="center">
                    <p style="margin:0;color:#555;font-size:12px;line-height:1.7;">
                      If you did not request a password reset, you can safely ignore this email.
                      Your password will not change.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer brand -->
          <tr>
            <td align="center" style="padding-top:32px;padding-bottom:8px;">
              <img src="https://tempted.chat/asstes/zevaronelogo/Asset 13.svg"
                   alt="Zevarone" height="22"
                   style="height:22px;display:block;opacity:0.5;" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;color:#444;font-size:11px;">
                &copy; ${new Date().getFullYear()} Zevarone. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
