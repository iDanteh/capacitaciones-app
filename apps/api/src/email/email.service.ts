import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface TenantBranding {
  name:         string;
  logoUrl:      string | null;
  primaryColor: string | null;
  appName:      string | null;
}

export interface SendInviteOptions {
  to:          string;
  inviterName: string;
  companyName: string;
  role:        string;
  token:       string;
  branding?:   TenantBranding;
}

export interface SendPasswordChangedOptions {
  to:        string;
  firstName: string;
  branding?: TenantBranding;
}

export interface SendPasswordResetOptions {
  to:        string;
  firstName: string;
  token:     string;
  branding?: TenantBranding;
}

// Tiempos de backoff: 5s → 25s → 125s
const RETRY_DELAYS_MS = [5_000, 25_000, 125_000];

/**
 * Servicio de email centralizado (Resend).
 *
 * Todos los métodos `send*` son fire-and-forget: retornan void de forma
 * síncrona y despachan el envío fuera del event loop de la request actual.
 * Esto garantiza que el tiempo de respuesta de la API no dependa de la
 * latencia del proveedor de email.
 *
 * Retry automático: hasta 3 intentos con backoff exponencial (5s, 25s, 125s).
 * Si los 3 intentos fallan, se logea el error y se descarta — el token de
 * invitación sigue vigente en BD y el admin puede re-invitar.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.resend    = new Resend(this.config.get<string>('email.apiKey') ?? 'dummy');
    this.from      = this.config.get<string>('email.from', 'noreply@capacitaciones.app');
    this.frontendUrl = this.config.get<string>('frontendUrl', 'http://localhost:3000');
  }

  // ── Emails públicos ────────────────────────────────────────────────────────

  /** Envía una invitación de forma no bloqueante. */
  sendInvite(options: SendInviteOptions): void {
    const inviteUrl  = `${this.frontendUrl}/accept-invite?token=${options.token}`;
    const roleLabel: Record<string, string> = {
      ADMIN:    'Administrador',
      MANAGER:  'Manager',
      EMPLOYEE: 'Empleado',
    };

    this.dispatch(
      () => this.resend.emails.send({
        from:    this.from,
        to:      options.to,
        subject: `${options.inviterName} te invitó a ${options.companyName}`,
        html:    this.buildInviteHtml(options, inviteUrl, roleLabel),
      }),
      { to: options.to, template: 'invite' },
    );
  }

  /** Envía el enlace de recuperación de contraseña. */
  sendPasswordReset(options: SendPasswordResetOptions): void {
    const resetUrl = `${this.frontendUrl}/reset-password/${options.token}`;
    this.dispatch(
      () => this.resend.emails.send({
        from:    this.from,
        to:      options.to,
        subject: 'Recupera tu contraseña',
        html:    this.buildPasswordResetHtml(options, resetUrl),
      }),
      { to: options.to, template: 'passwordReset' },
    );
  }

  /** Notifica al usuario que su contraseña fue cambiada. */
  sendPasswordChanged(options: SendPasswordChangedOptions): void {
    this.dispatch(
      () => this.resend.emails.send({
        from:    this.from,
        to:      options.to,
        subject: 'Tu contraseña fue cambiada',
        html:    this.buildPasswordChangedHtml(options),
      }),
      { to: options.to, template: 'passwordChanged' },
    );
  }

  // ── Motor de despacho (privado) ────────────────────────────────────────────

  /**
   * Ejecuta `fn` fuera del event loop actual y reintenta con backoff exponencial.
   *
   * @param fn       - Función async que realiza el envío real.
   * @param meta     - Datos para logging (destinatario, template).
   * @param attempt  - Intento actual (base 0).
   */
  private dispatch(
    fn:      () => Promise<unknown>,
    meta:    { to: string; template: string },
    attempt  = 0,
  ): void {
    setImmediate(async () => {
      try {
        await fn();
        if (attempt > 0) {
          this.logger.log(`Email [${meta.template}] → ${meta.to} enviado en intento ${attempt + 1}`);
        }
      } catch (err) {
        const maxAttempts = RETRY_DELAYS_MS.length + 1;
        this.logger.warn(
          `Email [${meta.template}] → ${meta.to} falló (intento ${attempt + 1}/${maxAttempts}): ${(err as Error).message}`,
        );

        if (attempt < RETRY_DELAYS_MS.length) {
          setTimeout(
            () => this.dispatch(fn, meta, attempt + 1),
            RETRY_DELAYS_MS[attempt],
          );
        } else {
          this.logger.error(
            `Email [${meta.template}] → ${meta.to} descartado tras ${maxAttempts} intentos fallidos.`,
          );
        }
      }
    });
  }

  // ── Templates HTML (privados) ──────────────────────────────────────────────

  private buildInviteHtml(
    options:   SendInviteOptions,
    inviteUrl: string,
    roleLabel: Record<string, string>,
  ): string {
    const b            = options.branding;
    const primaryColor = b?.primaryColor || '#1E4F7A';
    const platformName = b?.appName || b?.name || 'Capta';
    const initial      = platformName.charAt(0).toUpperCase();

    const logoHtml = b?.logoUrl
      ? `<img src="${b.logoUrl}" alt="${platformName}" style="height:36px;max-width:160px;object-fit:contain;display:block;">`
      : `<div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:${primaryColor};">
           <span style="color:#FFFFFF;font-weight:700;font-size:16px;">${initial}</span>
         </div>`;

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid #E3E3E3;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 32px;">
            <div style="margin-bottom:32px;">${logoHtml}</div>
            <h1 style="font-size:22px;font-weight:600;color:#171717;margin:0 0 8px;">Tienes una invitación</h1>
            <p style="font-size:15px;color:#707070;margin:0 0 28px;line-height:1.6;">
              <strong style="color:#171717;">${options.inviterName}</strong> te invitó a unirte a
              <strong style="color:#171717;">${options.companyName}</strong> como
              <strong style="color:#171717;">${roleLabel[options.role] ?? options.role}</strong>.
            </p>
            <a href="${inviteUrl}"
               style="display:inline-block;background:${primaryColor};color:#FFFFFF;font-weight:600;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;">
              Aceptar invitación
            </a>
            <p style="font-size:13px;color:#A1A1A1;margin:28px 0 0;line-height:1.5;">
              Este enlace expira en 7 días.<br>
              Si no esperabas esta invitación, puedes ignorar este correo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#F5F5F5;border-top:1px solid #E3E3E3;">
            <p style="font-size:12px;color:#A1A1A1;margin:0;">
              © ${new Date().getFullYear()} ${platformName}. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private buildPasswordResetHtml(options: SendPasswordResetOptions, resetUrl: string): string {
    const b            = options.branding;
    const primaryColor = b?.primaryColor || '#1E4F7A';
    const platformName = b?.appName || b?.name || 'Capta';
    const initial      = platformName.charAt(0).toUpperCase();

    const logoHtml = b?.logoUrl
      ? `<img src="${b.logoUrl}" alt="${platformName}" style="height:36px;max-width:160px;object-fit:contain;display:block;">`
      : `<div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:${primaryColor};">
           <span style="color:#FFFFFF;font-weight:700;font-size:16px;">${initial}</span>
         </div>`;

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid #E3E3E3;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 32px;">
            <div style="margin-bottom:32px;">${logoHtml}</div>
            <h1 style="font-size:22px;font-weight:600;color:#171717;margin:0 0 8px;">Recupera tu contraseña</h1>
            <p style="font-size:15px;color:#707070;margin:0 0 28px;line-height:1.6;">
              Hola <strong style="color:#171717;">${options.firstName}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta.
            </p>
            <a href="${resetUrl}"
               style="display:inline-block;background:${primaryColor};color:#FFFFFF;font-weight:600;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;">
              Restablecer contraseña
            </a>
            <p style="font-size:13px;color:#A1A1A1;margin:28px 0 0;line-height:1.5;">
              Este enlace expira en <strong>1 hora</strong>.<br>
              Si no solicitaste recuperar tu contraseña, puedes ignorar este correo — tu cuenta está segura.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#F5F5F5;border-top:1px solid #E3E3E3;">
            <p style="font-size:12px;color:#A1A1A1;margin:0;">
              © ${new Date().getFullYear()} ${platformName}. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private buildPasswordChangedHtml(options: SendPasswordChangedOptions): string {
    const b            = options.branding;
    const primaryColor = b?.primaryColor || '#1E4F7A';
    const platformName = b?.appName || b?.name || 'Capta';
    const initial      = platformName.charAt(0).toUpperCase();

    const logoHtml = b?.logoUrl
      ? `<img src="${b.logoUrl}" alt="${platformName}" style="height:36px;max-width:160px;object-fit:contain;display:block;">`
      : `<div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:${primaryColor};">
           <span style="color:#FFFFFF;font-weight:700;font-size:16px;">${initial}</span>
         </div>`;

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid #E3E3E3;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 32px;">
            <div style="margin-bottom:32px;">${logoHtml}</div>
            <h1 style="font-size:22px;font-weight:600;color:#171717;margin:0 0 8px;">Tu contraseña fue cambiada</h1>
            <p style="font-size:15px;color:#707070;margin:0 0 28px;line-height:1.6;">
              Hola <strong style="color:#171717;">${options.firstName}</strong>, tu contraseña fue actualizada exitosamente.
            </p>
            <p style="font-size:15px;color:#707070;margin:0 0 28px;line-height:1.6;">
              Si no realizaste este cambio, contacta a tu administrador de inmediato o cambia tu contraseña nuevamente.
            </p>
            <p style="font-size:13px;color:#A1A1A1;margin:28px 0 0;line-height:1.5;">
              Si realizaste tú este cambio, puedes ignorar este correo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#F5F5F5;border-top:1px solid #E3E3E3;">
            <p style="font-size:12px;color:#A1A1A1;margin:0;">
              © ${new Date().getFullYear()} ${platformName}. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
