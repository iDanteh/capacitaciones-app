import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendInviteOptions {
  to: string;
  inviterName: string;
  companyName: string;
  role: string;
  token: string;
}

/**
 * Servicio de email centralizado (Resend).
 *
 * Usado por UsersModule (invitaciones) y futuros módulos que necesiten email.
 * Si RESEND_API_KEY no está configurada, los emails fallan silenciosamente
 * en desarrollo para no bloquear el flujo.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('email.apiKey') ?? 'dummy');
    this.from = this.config.get<string>('email.from', 'noreply@capacitaciones.app');
    this.frontendUrl = this.config.get<string>('frontendUrl', 'http://localhost:3000');
  }

  async sendInvite(options: SendInviteOptions): Promise<void> {
    const inviteUrl = `${this.frontendUrl}/accept-invite?token=${options.token}`;

    const roleLabel: Record<string, string> = {
      ADMIN: 'Administrador',
      MANAGER: 'Manager',
      EMPLOYEE: 'Empleado',
    };

    try {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: `${options.inviterName} te invitó a ${options.companyName}`,
        html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid #E3E3E3;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 32px;">
            <!-- Logo -->
            <div style="margin-bottom:32px;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#5AC8FA,#0B5A8C);">
                <span style="color:white;font-weight:700;font-size:16px;">L</span>
              </div>
            </div>
            <!-- Content -->
            <h1 style="font-size:22px;font-weight:600;color:#171717;margin:0 0 8px;">Tienes una invitación</h1>
            <p style="font-size:15px;color:#707070;margin:0 0 28px;line-height:1.6;">
              <strong style="color:#171717;">${options.inviterName}</strong> te invitó a unirte a
              <strong style="color:#171717;">${options.companyName}</strong> como
              <strong style="color:#171717;">${roleLabel[options.role] ?? options.role}</strong>.
            </p>
            <!-- CTA -->
            <a href="${inviteUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#5AC8FA,#38BDF8);color:#0B5A8C;font-weight:600;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;">
              Aceptar invitación
            </a>
            <!-- Footer note -->
            <p style="font-size:13px;color:#A1A1A1;margin:28px 0 0;line-height:1.5;">
              Este enlace expira en 7 días.<br>
              Si no esperabas esta invitación, puedes ignorar este correo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#F5F5F5;border-top:1px solid #E3E3E3;">
            <p style="font-size:12px;color:#A1A1A1;margin:0;">
              © ${new Date().getFullYear()} Capacitaciones LMS. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
    } catch (err) {
      // Email failure should not roll back user creation — log and continue
      this.logger.error(`Error al enviar invitación a ${options.to}:`, err);
    }
  }
}
