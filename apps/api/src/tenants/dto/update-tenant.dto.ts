import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: 'Nombre de la empresa' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'URL pública del logo (https://...). Vacío para eliminar.' })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+|^$/, {
    message: 'logoUrl debe ser una URL válida (https://...) o vacío para eliminar',
  })
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Color primario de marca en hex. Ej: #1E4F7A. Vacío para quitar.' })
  @IsOptional()
  @IsString()
  // Acepta un color hex válido (#RRGGBB) o string vacío (= eliminar color personalizado)
  @Matches(/^#[0-9a-fA-F]{6}$|^$/, {
    message: 'primaryColor debe ser un color hex válido (ej: #1E4F7A) o vacío para quitar',
  })
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Dominio personalizado — solo disponible en plan Enterprise' })
  @IsOptional()
  @IsString()
  @MaxLength(253)
  @Matches(/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^$/, {
    message: 'domain debe ser un dominio válido (ej: app.tuempresa.com) o vacío',
  })
  domain?: string;

  @ApiPropertyOptional({ description: 'Nombre de la plataforma (reemplaza "Capta" en la UI). Solo Enterprise + white-label. Vacío para quitar.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  appName?: string;
}
