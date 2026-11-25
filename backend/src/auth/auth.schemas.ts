import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Email inválido' }));

export const registerSchema = z.object({
  email,
  // Se guarda en minúsculas: "Ana" y "ana" son el mismo usuario
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, {
      error: 'Solo puede tener letras, números y guiones bajos',
    }),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(50).optional(),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});
export type LoginDto = z.infer<typeof loginSchema>;
