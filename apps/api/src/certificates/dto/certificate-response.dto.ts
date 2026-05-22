export class CertificateResponseDto {
  id:            string;
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  tenantName:    string;
  issuedAt:      Date;
  verifyUrl:     string;

  static from(cert: any, baseUrl: string): CertificateResponseDto {
    return {
      id:            cert.id,
      publicUuid:    cert.publicUuid,
      recipientName: cert.recipientName,
      courseTitle:   cert.courseTitle,
      tenantName:    cert.tenantName,
      issuedAt:      cert.issuedAt,
      verifyUrl:     `${baseUrl}/certificates/verify/${cert.publicUuid}`,
    };
  }
}

export class VerifyCertificateDto {
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  tenantName:    string;
  issuedAt:      Date;
  isValid:       boolean;
}
