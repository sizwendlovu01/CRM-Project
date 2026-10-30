import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppException } from './errors';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, headersSent: false }),
      getRequest: () => ({ id: 'req-1', url: '/x', method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter();
  jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  filter.catch(exception, host);
  return { status: (status.mock.calls[0] as unknown[])[0], body: (json.mock.calls[0] as unknown[])[0] as Record<string, unknown> };
}

describe('AllExceptionsFilter', () => {
  it('serialises application errors with code and details', () => {
    const { status, body } = run(AppException.conflict('DUPLICATE_CUSTOMER', 'Exists', [{ path: 'email', message: 'dup' }]));
    expect(status).toBe(409);
    expect(body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Exists',
      code: 'DUPLICATE_CUSTOMER',
      details: [{ path: 'email', message: 'dup' }],
      requestId: 'req-1',
    });
  });

  it('maps Nest HTTP exceptions', () => {
    expect(run(new NotFoundException()).body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(run(new ThrottlerException()).body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });

  it('maps Prisma errors without leaking internals', () => {
    const unique = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on secret_column', { code: 'P2002', clientVersion: 'x' });
    const { body } = run(unique);
    expect(body).toMatchObject({ statusCode: 409, code: 'DUPLICATE' });
    expect(JSON.stringify(body)).not.toContain('secret_column');

    const down = new Prisma.PrismaClientInitializationError("Can't reach database server at db:5432", 'x');
    expect(run(down).body).toMatchObject({ statusCode: 503, code: 'SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(run(down).body)).not.toContain('5432');
  });

  it('maps validation errors', () => {
    const result = z.object({ a: z.string() }).safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) expect(run(result.error).body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
  });

  it('hides unexpected errors behind a generic 500', () => {
    const { status, body } = run(new Error('TypeError: cannot read secretToken of undefined'));
    expect(status).toBe(500);
    expect(body.message).toBe('Something went wrong on our side. Please try again.');
    expect(JSON.stringify(body)).not.toContain('secretToken');
  });
});
