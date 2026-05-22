import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Certificados')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}

  // ── Rutas públicas (sin autenticación) ────────────────────────────────────

  @Get('verify/:uuid')
  @ApiOperation({ summary: 'Verificar autenticidad de un certificado (público)' })
  verify(@Param('uuid') uuid: string) {
    return this.service.verifyByUuid(uuid);
  }

  @Get('verify/:uuid/download')
  @ApiOperation({ summary: 'Descargar PDF de un certificado por UUID público' })
  async downloadByUuid(@Param('uuid') uuid: string, @Res() res: Response) {
    const buffer = await this.service.downloadPdfByUuid(uuid);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificado-${uuid}.pdf"`);
    res.send(buffer);
  }

  // ── Rutas autenticadas ────────────────────────────────────────────────────

  @Get('my')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar mis certificados' })
  getMyCertificates(@CurrentUser() user: JwtPayload) {
    return this.service.getMyCertificates(user.tenantId, user.sub);
  }

  @Get('course/:courseId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener certificado de un curso específico' })
  getByCourse(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
  ) {
    return this.service.getCertificateByCourse(user.tenantId, user.sub, courseId);
  }

  @Get(':id/download')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Descargar PDF de un certificado (autenticado)' })
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.downloadPdf(user.tenantId, user.sub, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificado-${id}.pdf"`);
    res.send(buffer);
  }
}
