import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

// La ruta no exige sesión. Si hay una sesión válida, igual se carga el usuario.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
