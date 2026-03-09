import { describe, expect, it, jest } from '@jest/globals';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../src/common/errors/AppError';
import { authenticate } from '../../src/common/middlewares/authenticate';
import { authorize } from '../../src/common/middlewares/authorize';

describe('Security middleware', () => {
  it('authenticate rejects missing Authorization header', () => {
    const req = { headers: {} } as Request;
    const next = jest.fn();

    authenticate(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('authorize rejects users without required role', () => {
    const req = { user: { sub: 'u1', email: 'u@test.dev', roles: ['USER'] } } as Request;
    const next = jest.fn();
    const middleware = authorize('ADMIN');

    middleware(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });
});
