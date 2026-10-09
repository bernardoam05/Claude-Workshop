import { z } from 'zod';

// Validação na FRONTEIRA do sistema: tudo o que chega do exterior é suspeito até provar o contrário.
// Dentro da aplicação já podemos confiar nos tipos.
export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'O título é obrigatório').max(200, 'Máximo de 200 caracteres'),
});

export const updateTaskSchema = z.object({
  done: z.boolean(),
});

// Parâmetros de URL chegam sempre como string; coerce converte e valida em simultâneo.
export const idParamSchema = z.coerce.number().int().positive();

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido').max(254),
  // Mínimo 8 caracteres. Máximo 72: o bcrypt ignora tudo depois dos 72 bytes.
  password: z.string().min(8, 'A password tem de ter pelo menos 8 caracteres').max(72, 'Máximo de 72 caracteres'),
});
