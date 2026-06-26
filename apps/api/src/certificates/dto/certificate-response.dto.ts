export class CertificateResponseDto {
  id:            string;
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  tenantName:    string;
  issuedAt:      Date;
  verifyUrl:     string;
  type:          'COURSE' | 'QUIZ';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static from(cert: any, baseUrl: string): CertificateResponseDto {
    return {
      id:            cert.id,
      publicUuid:    cert.publicUuid,
      recipientName: cert.recipientName,
      courseTitle:   cert.courseTitle,
      tenantName:    cert.tenantName,
      issuedAt:      cert.issuedAt,
      verifyUrl:     `${baseUrl}/verify/${cert.publicUuid}`,
      type:          cert.quizAssignmentId ? 'QUIZ' : 'COURSE',
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
  type:          'COURSE' | 'QUIZ';
}
