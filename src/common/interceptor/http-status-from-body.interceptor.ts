import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function extractStatusCode(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  if (!('statusCode' in payload)) return undefined;

  const value = (payload as { statusCode?: unknown }).statusCode;
  return typeof value === 'number' ? value : undefined;
}

function extractSuccess(payload: unknown): boolean | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  if (!('success' in payload)) return undefined;

  const value = (payload as { success?: unknown }).success;
  return typeof value === 'boolean' ? value : undefined;
}

@Injectable()
export class HttpStatusFromBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (res?.headersSent) return data;

        // 1) Prefer explicit payload.statusCode
        const explicitStatusCode = extractStatusCode(data);
        if (explicitStatusCode !== undefined) {
          res.status(explicitStatusCode);
          return data;
        }

        // 2) If payload has success boolean but no statusCode, infer one
        const success = extractSuccess(data);
        if (success !== undefined) {
          const inferredStatusCode = success ? 200 : 400;
          res.status(inferredStatusCode);

          // Also keep JSON body consistent by injecting statusCode
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            return { ...(data as Record<string, unknown>), statusCode: inferredStatusCode };
          }
        }

        return data;
      }),
    );
  }
}
