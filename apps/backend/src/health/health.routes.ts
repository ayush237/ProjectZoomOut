import type { ZoomOutApp } from '../app.js';
import type { HealthService } from './health.service.js';

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * `GET /health`
 *
 * The handler holds no logic beyond translating a domain report into an HTTP status —
 * the decision itself belongs to `HealthService`. A non-200 when the database is
 * unreachable is what makes this usable as a container or load-balancer probe.
 */
export function registerHealthRoutes(app: ZoomOutApp, service: HealthService): void {
  app.get('/health', async (_request, reply) => {
    const report = await service.check();
    const statusCode = report.status === 'ok' ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE;

    return reply.status(statusCode).send(report);
  });
}
