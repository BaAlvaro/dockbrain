import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import type { Logger } from '../../utils/logger.js';
import type { PairingManager } from '../security/pairing-manager.js';
import type { UserRepository } from '../../persistence/repositories/user-repository.js';
import type { TaskRepository } from '../../persistence/repositories/task-repository.js';
import type { AuditRepository } from '../../persistence/repositories/audit-repository.js';
import type { PairingTokenRepository } from '../../persistence/repositories/pairing-token-repository.js';
import type { PermissionRepository } from '../../persistence/repositories/permission-repository.js';

export class ApiServer {
  private server: FastifyInstance;
  private adminToken: string;

  constructor(
    private logger: Logger,
    private pairingManager: PairingManager,
    private userRepo: UserRepository,
    private taskRepo: TaskRepository,
    private auditRepo: AuditRepository,
    private pairingTokenRepo: PairingTokenRepository,
    private permissionRepo: PermissionRepository,
    adminToken: string,
    host: string = '127.0.0.1',
    port: number = 3000
  ) {
    this.adminToken = adminToken;
    this.server = Fastify({ logger: false });

    this.server.register(helmet);

    this.setupRoutes();

    this.server.listen({ host, port }, (err) => {
      if (err) {
        this.logger.error({ error: err }, 'Failed to start API server');
        throw err;
      }
      this.logger.info({ host, port }, 'API server started');
    });
  }

  private setupRoutes(): void {
    this.server.addHook('preHandler', async (request, reply) => {
      if (request.url === '/api/v1/health') {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const token = authHeader.substring(7);
      if (token !== this.adminToken) {
        reply.code(401).send({ error: 'Invalid token' });
        return;
      }
    });

    this.server.get('/api/v1/health', async () => {
      return {
        status: 'healthy',
        version: '0.1.0',
        uptime_seconds: process.uptime(),
      };
    });

    this.server.post<{ Body: { ttl_minutes?: number; is_admin?: boolean } }>(
      '/api/v1/pairing/tokens',
      async (request) => {
        const result = this.pairingManager.createPairingToken(
          request.body.ttl_minutes,
          request.body.is_admin
        );

        return {
          token: result.token,
          expires_at: result.expires_at,
        };
      }
    );

    this.server.get('/api/v1/pairing/tokens', async () => {
      const tokens = this.pairingTokenRepo.findActive();
      return { tokens };
    });

    this.server.get('/api/v1/users', async () => {
      const users = this.userRepo.findAll();
      return { users };
    });

    this.server.patch<{
      Params: { id: string };
      Body: { is_active?: boolean; rate_limit_per_minute?: number };
    }>('/api/v1/users/:id', async (request) => {
      const userId = parseInt(request.params.id);
      const updated = this.userRepo.update(userId, request.body);

      if (!updated) {
        throw new Error('User not found');
      }

      return updated;
    });

    this.server.delete<{ Params: { id: string } }>('/api/v1/users/:id', async (request, reply) => {
      const userId = parseInt(request.params.id);
      const deleted = this.userRepo.delete(userId);

      if (!deleted) {
        throw new Error('User not found');
      }

      reply.code(204).send();
    });

    this.server.get<{ Params: { id: string } }>('/api/v1/users/:id/permissions', async (request) => {
      const userId = parseInt(request.params.id);
      const permissions = this.permissionRepo.findByUserId(userId);
      return { user_id: userId, permissions };
    });

    this.server.put<{
      Params: { id: string };
      Body: { permissions: Array<{ tool_name: string; action: string; granted: boolean; requires_confirmation?: boolean }> };
    }>('/api/v1/users/:id/permissions', async (request) => {
      const userId = parseInt(request.params.id);

      this.permissionRepo.setPermissions(
        userId,
        request.body.permissions.map((p) => ({
          ...p,
          user_id: userId,
          granted_by: 'admin',
        }))
      );

      return { updated: request.body.permissions.length };
    });

    this.server.get<{ Querystring: { status?: string; user_id?: string; limit?: string } }>(
      '/api/v1/tasks',
      async (request) => {
        const limit = request.query.limit ? parseInt(request.query.limit) : 50;

        if (request.query.user_id) {
          const tasks = this.taskRepo.findByUserId(parseInt(request.query.user_id), limit);
          return { tasks, total: tasks.length };
        }

        if (request.query.status) {
          const tasks = this.taskRepo.findByStatus(request.query.status as any, limit);
          return { tasks, total: tasks.length };
        }

        const tasks = this.taskRepo.findActive(limit);
        return { tasks, total: tasks.length };
      }
    );

    this.server.get<{ Params: { id: string } }>('/api/v1/tasks/:id', async (request) => {
      const task = this.taskRepo.findById(request.params.id);
      if (!task) {
        throw new Error('Task not found');
      }
      return task;
    });

    this.server.get<{
      Querystring: { user_id?: string; from?: string; to?: string; limit?: string };
    }>('/api/v1/audit', async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit) : 100;

      if (request.query.user_id) {
        const logs = this.auditRepo.findByUserId(parseInt(request.query.user_id), limit);
        return { logs, total: logs.length };
      }

      if (request.query.from && request.query.to) {
        const logs = this.auditRepo.findByTimeRange(
          parseInt(request.query.from),
          parseInt(request.query.to),
          limit
        );
        return { logs, total: logs.length };
      }

      return { logs: [], total: 0 };
    });
  }

  async close(): Promise<void> {
    await this.server.close();
    this.logger.info('API server closed');
  }
}
