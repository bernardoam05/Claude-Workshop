// Configuração lida de variáveis de ambiente e validada no arranque (fail fast).

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória em falta: ${name}`);
  }
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  rabbitUrl: required('RABBITMQ_URL'),
} as const;
