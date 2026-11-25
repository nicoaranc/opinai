import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';
import { AllExceptionsFilter, ErrorBody } from './all-exceptions.filter.js';

function run(exception: unknown) {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: { reply, getRequestUrl: () => '/media/x' },
  } as unknown as HttpAdapterHost;
  const host = {
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter(adapterHost);
  vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  filter.catch(exception, host);

  const [, body, status] = reply.mock.calls[0] as [unknown, ErrorBody, number];
  return { body, status };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
  });

describe('AllExceptionsFilter', () => {
  it('mantiene el estado y mensaje de las HttpException', () => {
    const { body, status } = run(new NotFoundException('Obra no encontrada'));
    expect(status).toBe(404);
    expect(body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Obra no encontrada',
      path: '/media/x',
    });
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it('conserva la lista de mensajes de validación', () => {
    const { body } = run(new BadRequestException(['rating: Too big']));
    expect(body.message).toEqual(['rating: Too big']);
  });

  it.each([
    ['P2002', 409],
    ['P2003', 409],
    ['P2025', 404],
  ])('traduce el error de Prisma %s a %i', (code, expected) => {
    expect(run(prismaError(code)).status).toBe(expected);
  });

  it('oculta el detalle de los errores inesperados', () => {
    const { body, status } = run(new Error('password=secreta'));
    expect(status).toBe(500);
    expect(body.message).toBe('Error interno del servidor');
  });

  it('trata los errores de Prisma desconocidos como 500', () => {
    expect(run(prismaError('P1001')).status).toBe(500);
  });
});
