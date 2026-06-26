import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports:     [CertificatesModule],
  controllers: [QuizController],
  providers:   [QuizService],
  exports:     [QuizService],
})
export class QuizModule {}
