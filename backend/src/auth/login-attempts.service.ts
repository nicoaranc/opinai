import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export const MAX_FAILED_ATTEMPTS = 5;
export const ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;
// Tope de emails registrados en memoria, para que no crezca sin límite
const MAX_TRACKED = 10_000;

// Límite de logins fallidos por cuenta (email), sin importar la IP: frena el
// ataque a una cuenta desde muchas IPs. Se guarda en memoria, así que se
// reinicia si el servidor se reinicia; suficiente con una sola instancia.
// También cuenta emails que no existen, para no revelar cuáles están registrados.
@Injectable()
export class LoginAttemptsService {
  private readonly failures = new Map<string, number[]>();

  // Lanza 429 si la cuenta superó el máximo de fallos en la ventana
  assertAllowed(email: string, now = Date.now()): void {
    const recent = this.recent(email, now);
    if (recent.length < MAX_FAILED_ATTEMPTS) return;

    const retryInMs = recent[0] + ATTEMPTS_WINDOW_MS - now;
    const minutes = Math.max(1, Math.ceil(retryInMs / 60_000));
    throw new HttpException(
      `Demasiados intentos fallidos para esta cuenta. Prueba de nuevo en ${minutes} min.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  recordFailure(email: string, now = Date.now()): void {
    const recent = this.recent(email, now);
    recent.push(now);
    // Se reinserta al final para que el Map quede ordenado por último fallo
    this.failures.delete(email);
    this.failures.set(email, recent);
    if (this.failures.size > MAX_TRACKED) {
      const oldest = this.failures.keys().next().value;
      if (oldest !== undefined) this.failures.delete(oldest);
    }
  }

  reset(email: string): void {
    this.failures.delete(email);
  }

  private recent(email: string, now: number): number[] {
    const since = now - ATTEMPTS_WINDOW_MS;
    const recent = (this.failures.get(email) ?? []).filter((t) => t > since);
    if (recent.length) this.failures.set(email, recent);
    else this.failures.delete(email);
    return recent;
  }
}
