import { z } from 'zod';

// "" cuenta como borrar el campo (null)
const clearable = <T extends z.ZodType>(schema: T) =>
  z.union([z.literal('').transform(() => null), schema]).nullish();

export const updateProfileSchema = z.strictObject({
  displayName: clearable(z.string().trim().min(1).max(50)),
  bio: clearable(z.string().trim().max(500)),
  avatarUrl: clearable(z.url()),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
