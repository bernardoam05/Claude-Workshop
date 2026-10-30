// P4 · Componentes de servidor e de cliente: o que pode ir para o browser?
// No App Router do Next.js, os componentes são de SERVIDOR por omissão (correm só no servidor,
// podem ler a base de dados, e o seu código nunca chega ao browser). Um ficheiro que comece com
// a diretiva 'use client' é de CLIENTE, e TUDO o que ele importa passa também a ser de cliente
// (vai no JavaScript enviado ao browser).

// verificarFronteiras(modulos) → lista de problemas (texto), ordenada
//   modulos: { [caminho]: { codigo, importa: [caminhos de outros módulos ou pacotes] } }
//   1. Um módulo é de cliente se o código começar pela diretiva 'use client' (ou "use client",
//      com ou sem ';', depois de espaços ou linhas em branco), ou se for importado, direta ou
//      indiretamente, por um módulo de cliente. (Imports de pacotes que não estão em `modulos`
//      não se seguem.)
//   2. Para cada módulo de cliente:
//      - cada process.env.NOME com NOME que não comece por NEXT_PUBLIC_ →
//          '<caminho>: process.env.<NOME> no cliente' (o segredo ia parar ao browser)
//      - importar 'server-only', 'pg', 'fs' ou 'node:fs' → '<caminho>: importa <pacote> no cliente'
//      - export default async function → '<caminho>: componente async no cliente'
export const SO_SERVIDOR = ['server-only', 'pg', 'fs', 'node:fs'];

export function verificarFronteiras(modulos) {
  throw new Error('Por fazer: P4');
}
