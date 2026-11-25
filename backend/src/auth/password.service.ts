import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import argon2 from 'argon2';

// Configuración de argon2id recomendada por OWASP: 19 MiB, 2 iteraciones, 1 hilo.
// Los valores por defecto de la librería (64 MiB) agotarían la RAM del plan
// gratis de Render con pocos logins simultáneos.
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

// Como mucho 4 cálculos a la vez (~76 MiB). El resto espera en cola y,
// si la cola se llena, se responde 503 en vez de acumular memoria.
const MAX_CONCURRENT = 4;
const MAX_QUEUED = 50;

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;
  private running = 0;
  private readonly queue: (() => void)[] = [];

  hash(password: string): Promise<string> {
    return this.limited(() => argon2.hash(password, ARGON2_OPTIONS));
  }

  // Si no hay hash (el email no existe) igual se verifica contra uno falso, para
  // que la respuesta tarde lo mismo y no revele qué emails están registrados.
  async verify(hash: string | undefined, password: string): Promise<boolean> {
    this.dummyHash ??= this.hash('dummy-password-for-timing');
    const target = hash ?? (await this.dummyHash);
    try {
      const valid = await this.limited(() => argon2.verify(target, password));
      return valid && hash !== undefined;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      // Hash con formato inválido
      return false;
    }
  }

  // true si el hash se creó con parámetros distintos a los actuales
  needsRehash(hash: string): boolean {
    const { memoryCost, timeCost, parallelism } = ARGON2_OPTIONS;
    return argon2.needsRehash(hash, { memoryCost, timeCost, parallelism });
  }

  private async limited<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= MAX_CONCURRENT) {
      if (this.queue.length >= MAX_QUEUED) {
        throw new ServiceUnavailableException(
          'El servidor está ocupado, inténtalo de nuevo en unos segundos',
        );
      }
      // Al despertar, hereda el hueco del que terminó (running no cambia)
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else {
      this.running++;
    }
    try {
      return await task();
    } finally {
      // El hueco pasa directo al siguiente en cola, para que una petición
      // nueva no pueda colarse entre medio y superar el máximo
      const next = this.queue.shift();
      if (next) next();
      else this.running--;
    }
  }
}
