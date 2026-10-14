// Lê um workflow e devolve-o como objeto, para os testes verificarem a estrutura.
// Usa YAML 1.2 (o do GitHub Actions): ao contrário do YAML 1.1, a chave `on` continua a ser "on",
// e não o booleano true.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export function lerWorkflow(nome) {
  const texto = readFileSync(new URL(`./workflows/${nome}`, import.meta.url), 'utf8');
  const wf = parse(texto);
  if (!wf || typeof wf !== 'object') throw new Error(`workflows/${nome} ainda está vazio`);
  return { wf, texto };
}

// Todos os steps de um job, com `uses` e `run` fáceis de procurar.
export const passos = (job) => job?.steps ?? [];
export const usa = (job, acao) => passos(job).find((s) => typeof s.uses === 'string' && s.uses.startsWith(acao));
export const corre = (job, comando) => passos(job).find((s) => typeof s.run === 'string' && s.run.includes(comando));
