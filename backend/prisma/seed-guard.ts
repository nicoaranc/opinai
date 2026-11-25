// El seed borra todos los datos y crea un ADMIN con una contraseña conocida,
// así que solo puede ejecutarse contra una base local. No basta con mirar
// NODE_ENV: en tu máquina vale "development" aunque el .env apunte a Supabase.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function assertSafeToSeed(env: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
}): void {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'El seed borra todos los datos: no se ejecuta en producción.',
    );
  }
  if (!env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL.');
  }

  let host: string;
  try {
    host = new URL(env.DATABASE_URL).hostname;
  } catch {
    throw new Error('DATABASE_URL no es una URL válida.');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `El seed solo se ejecuta contra una base local y DATABASE_URL apunta a "${host}".`,
    );
  }
}
