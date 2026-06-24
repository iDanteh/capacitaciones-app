/**
 * StripeService — Wrapper del SDK de Stripe v22+.
 *
 * Centraliza la inicialización del cliente y la verificación de webhooks.
 * El resto de la app importa este servicio en lugar de instanciar Stripe directamente.
 *
 * Nota (Stripe v22): el export default es `StripeConstructor`, no la clase `Stripe`.
 * Los tipos de recursos (Event, Invoice, etc.) se acceden por inferencia desde los
 * métodos del cliente, evitando importaciones a rutas internas del paquete.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/** Tipo del cliente Stripe inferido desde el constructor */
export type StripeClient = Stripe.Stripe;

/** Tipo de evento de webhook, inferido desde el método constructEvent */
export type StripeEvent = ReturnType<StripeClient['webhooks']['constructEvent']>;

@Injectable()
export class StripeService {
  readonly client: StripeClient;

  constructor(private readonly config: ConfigService) {
    this.client = new Stripe(this.config.getOrThrow<string>('stripe.secretKey'), {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
    });
  }

  /**
   * Verifica la firma del webhook y retorna el evento tipado.
   * Lanza StripeSignatureVerificationError si la firma es inválida.
   */
  constructEvent(rawBody: Buffer, signature: string): StripeEvent {
    const secret = this.config.getOrThrow<string>('stripe.webhookSecret');
    return this.client.webhooks.constructEvent(rawBody, signature, secret);
  }
}
