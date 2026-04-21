import nodemailer from "nodemailer";

// Lazy transporter — created on first use so env vars are always available
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
  const from = `"tempted.chat" <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@zevarone.com"}>`;

  console.log(`[email] Sending "${subject}" to ${to} via ${process.env.SMTP_HOST ?? "smtp.zoho.com"}`);

  await transport.sendMail({ from, to, subject, html });

  console.log(`[email] Sent successfully to ${to}`);
}

// ─── UI SHARED COMPONENTS ───────────────────────────────────────────────────

const FOOTER_HTML = `
  <!-- Footer brand -->
  <tr>
    <td align="center" style="padding-top:40px;padding-bottom:12px;">
      <p style="margin:0 0 12px 0;color:#636363;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Powered by</p>
      <img src="https://tempted.chat/asstes/zevaronelogo/Asset 12.png"
           alt="Zevarone" height="28"
           style="height:28px;display:block;opacity:0.8;" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <p style="margin:0;color:#444;font-size:11px;letter-spacing:0.2px;">
        &copy; ${new Date().getFullYear()} Zevarone. All rights reserved.
      </p>
    </td>
  </tr>
`;

function formatDate(ms: number): string {
  return new Date(ms).toUTCString().replace(" GMT", " UTC");
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>tempted.chat — Purchase Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png" alt="tempted.chat" height="48" style="height:48px;display:block;" />
            </td>
          </tr>
          <tr>
            <td style="background:#13131a;border-radius:24px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
              <div style="height:4px;background:linear-gradient(90deg,${tierColor},#ec4899);"></div>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px;">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <img src="${tierLogo}" alt="${tierLabel}" height="80" style="height:80px;display:block;margin-bottom:16px;" />
                    <span style="display:inline-block;padding:8px 20px;border-radius:100px;background:${tierBg};color:${tierColor};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                      ${tierLabel} Status Active
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;line-height:1.2;">Thank you for your purchase!</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:40px;">
                    <p style="margin:0;color:#94a3b8;font-size:16px;line-height:1.6;">Your subscription is now active. You have full access to all ${tierLabel} features.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:rgba(255,255,255,0.03);border-radius:16px;padding:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#64748b;font-size:13px;padding-bottom:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Plan Details</td>
                        <td align="right" style="color:#64748b;font-size:13px;padding-bottom:12px;font-family:monospace;">ID: ${orderId.slice(0,8)}...</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;font-size:14px;padding-bottom:8px;">Plan Name</td>
                        <td align="right" style="color:#fff;font-size:14px;font-weight:600;padding-bottom:8px;">${planName}</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;font-size:14px;padding-bottom:8px;">Billing Period</td>
                        <td align="right" style="color:#fff;font-size:14px;padding-bottom:8px;">${durationLabel}</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;font-size:14px;padding-bottom:8px;">Activated On</td>
                        <td align="right" style="color:#fff;font-size:14px;padding-bottom:8px;">${formatDate(activatedAt)}</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;font-size:14px;">Renews/Expires</td>
                        <td align="right" style="color:#fff;font-size:14px;">${formatDate(expiresAt)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:32px;padding-bottom:32px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#fff;font-size:18px;font-weight:700;">Total Paid</td>
                        <td align="right" style="color:${tierColor};font-size:28px;font-weight:900;">${formatPrice(amountCents)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="https://tempted.chat" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,${tierColor},#ec4899);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:100px;box-shadow:0 10px 20px rgba(236,72,153,0.2);">Start Chatting Now</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${FOOTER_HTML}
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
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Account Restricted</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr><td align="center" style="padding-bottom:32px;"><img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png" alt="tempted.chat" height="48" style="height:48px;display:block;" /></td></tr>
          <tr>
            <td style="background:#13131a;border-radius:24px;border:1px solid rgba(239,68,68,0.2);overflow:hidden;">
              <div style="height:4px;background:#ef4444;"></div>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 40px;">
                <tr><td align="center" style="padding-bottom:24px;"><div style="width:72px;height:72px;border-radius:100px;background:rgba(239,68,68,0.1);line-height:72px;font-size:32px;text-align:center;">🚫</div></td></tr>
                <tr><td align="center" style="padding-bottom:16px;"><h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">Account Blocked</h1></td></tr>
                <tr><td align="center" style="padding-bottom:32px;"><p style="margin:0;color:#94a3b8;font-size:16px;line-height:1.7;">Your account has been permanently restricted for violating our community guidelines. You can no longer access your profile or messages.</p></td></tr>
                <tr><td align="center" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:32px;"><p style="margin:0;color:#64748b;font-size:14px;">Questions? Contact <a href="mailto:support@zevarone.com" style="color:#ef4444;text-decoration:none;font-weight:600;">support@zevarone.com</a></p></td></tr>
              </table>
            </td>
          </tr>
          ${FOOTER_HTML}
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
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Account Warning</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr><td align="center" style="padding-bottom:32px;"><img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png" alt="tempted.chat" height="48" style="height:48px;display:block;" /></td></tr>
          <tr>
            <td style="background:#13131a;border-radius:24px;border:1px solid rgba(245,158,11,0.2);overflow:hidden;">
              <div style="height:4px;background:#f59e0b;"></div>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 40px;">
                <tr><td align="center" style="padding-bottom:24px;"><div style="width:72px;height:72px;border-radius:100px;background:rgba(245,158,11,0.1);line-height:72px;font-size:32px;text-align:center;">⚠️</div></td></tr>
                <tr><td align="center" style="padding-bottom:16px;"><h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">Warning Notice</h1></td></tr>
                <tr><td align="center" style="padding-bottom:32px;"><p style="margin:0;color:#94a3b8;font-size:16px;line-height:1.7;">Our moderation team noticed activity that violates our terms. Continued violations will lead to a permanent account ban.</p></td></tr>
                <tr><td align="center" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:32px;"><p style="margin:0;color:#64748b;font-size:14px;">Please review the rules to keep your account safe.</p></td></tr>
              </table>
            </td>
          </tr>
          ${FOOTER_HTML}
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
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Admin Invitation</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr><td align="center" style="padding-bottom:32px;"><img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png" alt="tempted.chat" height="48" style="height:48px;display:block;" /></td></tr>
          <tr>
            <td style="background:#13131a;border-radius:24px;border:1px solid rgba(168,85,247,0.2);overflow:hidden;">
              <div style="height:4px;background:linear-gradient(90deg,#a855f7,#ec4899);"></div>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 40px;">
                <tr><td align="center" style="padding-bottom:24px;"><div style="width:72px;height:72px;border-radius:100px;background:rgba(168,85,247,0.1);line-height:72px;font-size:32px;text-align:center;">🛡️</div></td></tr>
                <tr><td align="center" style="padding-bottom:16px;"><h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">Admin Invitation</h1></td></tr>
                <tr><td align="center" style="padding-bottom:32px;"><p style="margin:0;color:#94a3b8;font-size:16px;line-height:1.7;"><strong>${inviterName}</strong> has invited you to join the moderation team of <strong>tempted.chat</strong>.</p></td></tr>
                <tr><td align="center" style="padding-bottom:40px;"><a href="${inviteLink}" style="display:inline-block;padding:16px 40px;background:#a855f7;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;">Accept Invitation</a></td></tr>
                <tr><td align="center"><p style="margin:0;color:#555;font-size:12px;">This link will expire in 48 hours.</p></td></tr>
              </table>
            </td>
          </tr>
          ${FOOTER_HTML}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Password Reset Email ─────────────────────────────────────────────────────

export function buildPasswordResetEmail(code: string): string {
  const codeBoxes = code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;width:42px;height:52px;line-height:52px;text-align:center;font-size:24px;font-weight:900;color:#ffffff;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;margin:0 4px;font-family:monospace;">${d}</span>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Reset Code</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr><td align="center" style="padding-bottom:32px;"><img src="https://tempted.chat/asstes/logo/logologoheartandtempetedchat.png" alt="tempted.chat" height="48" style="height:48px;display:block;" /></td></tr>
          <tr>
            <td style="background:#13131a;border-radius:24px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
              <div style="height:4px;background:#ec4899;"></div>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 40px;">
                <tr><td align="center" style="padding-bottom:24px;"><div style="width:72px;height:72px;border-radius:100px;background:rgba(236,72,153,0.1);line-height:72px;font-size:32px;text-align:center;">🔑</div></td></tr>
                <tr><td align="center" style="padding-bottom:12px;"><h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">Reset Your Password</h1></td></tr>
                <tr><td align="center" style="padding-bottom:32px;"><p style="margin:0;color:#94a3b8;font-size:16px;">Use the verification code below to secure your account.</p></td></tr>
                <tr><td align="center" style="padding-bottom:32px;">${codeBoxes}</td></tr>
                <tr><td align="center" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:32px;"><p style="margin:0;color:#64748b;font-size:13px;">Code expires in 15 minutes. If you didn't request this, ignore this email.</p></td></tr>
              </table>
            </td>
          </tr>
          ${FOOTER_HTML}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}