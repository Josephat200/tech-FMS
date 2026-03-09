import pinoHttp from 'pino-http';
import { logger } from '../../infrastructure/logger/logger';

export const requestLogger = pinoHttp({ logger });
