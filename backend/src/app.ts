import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { requestLogger } from './common/middlewares/request-logger';
import { apiRouter } from './presentation/routes';
import { notFoundHandler } from './common/middlewares/not-found';
import { errorHandler } from './common/middlewares/error-handler';

export function createApp() {
  const app = express();
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    helmet({
      hsts: env.NODE_ENV === 'production',
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('CORS origin denied'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  const apiLimiter = rateLimit({
    windowMs: env.API_RATE_LIMIT_WINDOW_MS,
    limit: env.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(apiLimiter);

  app.use(requestLogger);

  app.use(env.API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
