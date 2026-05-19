import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';

@Module({
  providers:   [StripeService, SubscriptionsService],
  controllers: [SubscriptionsController],
  exports:     [SubscriptionsService, StripeService],
})
export class SubscriptionsModule {}
