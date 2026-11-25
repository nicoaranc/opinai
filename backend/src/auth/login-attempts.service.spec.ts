import { HttpException } from '@nestjs/common';
import {
  ATTEMPTS_WINDOW_MS,
  LoginAttemptsService,
  MAX_FAILED_ATTEMPTS,
} from './login-attempts.service.js';

const EMAIL = 'ana@opinai.local';
const T0 = 1_000_000;

function failNTimes(service: LoginAttemptsService, n: number, at = T0) {
  for (let i = 0; i < n; i++) service.recordFailure(EMAIL, at);
}

describe('LoginAttemptsService', () => {
  it('permite intentos por debajo del máximo', () => {
    const service = new LoginAttemptsService();
    failNTimes(service, MAX_FAILED_ATTEMPTS - 1);
    expect(() => service.assertAllowed(EMAIL, T0)).not.toThrow();
  });

  it('bloquea con 429 al llegar al máximo e indica cuánto esperar', () => {
    const service = new LoginAttemptsService();
    failNTimes(service, MAX_FAILED_ATTEMPTS);
    try {
      service.assertAllowed(EMAIL, T0 + 60_000);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).message).toContain('14 min');
    }
  });

  it('desbloquea cuando los fallos salen de la ventana', () => {
    const service = new LoginAttemptsService();
    failNTimes(service, MAX_FAILED_ATTEMPTS);
    expect(() =>
      service.assertAllowed(EMAIL, T0 + ATTEMPTS_WINDOW_MS),
    ).not.toThrow();
  });

  it('cuenta cada email por separado y reset limpia el contador', () => {
    const service = new LoginAttemptsService();
    failNTimes(service, MAX_FAILED_ATTEMPTS);
    expect(() => service.assertAllowed('otro@opinai.local', T0)).not.toThrow();
    service.reset(EMAIL);
    expect(() => service.assertAllowed(EMAIL, T0)).not.toThrow();
  });
});
