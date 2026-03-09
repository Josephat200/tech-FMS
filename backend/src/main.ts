import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './infrastructure/logger/logger';
import { pgPool, verifyPostgresConnection } from './infrastructure/db/postgres';

async function bootstrap(): Promise<void> {
  await verifyPostgresConnection();

  const app = createApp();
  const server = createServer(app);
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.warn({ signal }, 'Shutdown signal received');

    const forceClose = setTimeout(() => {
      logger.error('Forced shutdown after grace period');
      process.exit(1);
    }, env.SHUTDOWN_GRACE_PERIOD_MS);

    forceClose.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      await pgPool.end();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    void shutdown('SIGTERM');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    void shutdown('SIGTERM');
  });

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'FLORANTE TECH backend started');
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start application');
  process.exit(1);
});
