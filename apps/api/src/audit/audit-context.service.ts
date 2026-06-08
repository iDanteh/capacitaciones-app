import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Almacena el contexto HTTP (IP, User-Agent) de la request actual usando
 * AsyncLocalStorage, que propaga el contexto a través de toda la cadena
 * de callbacks asíncronos sin pasar parámetros explícitos.
 *
 * El AuditContextMiddleware lo inicializa al inicio de cada request.
 * El AuditService lo lee síncronamente antes de despachar el log.
 */
@Injectable()
export class AuditContextService {
  private readonly als = new AsyncLocalStorage<RequestContext>();

  /** Ejecuta `fn` dentro de un contexto con la IP y UA de la request actual. */
  run(ctx: RequestContext, fn: () => void): void {
    this.als.run(ctx, fn);
  }

  /** Devuelve el contexto de la request actual, o vacío si no hay contexto activo. */
  get(): RequestContext {
    return this.als.getStore() ?? {};
  }
}
