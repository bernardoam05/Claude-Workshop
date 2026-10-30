// Lê um ficheiro de manifests (pode ter vários objetos separados por ---) e ajuda a procurá-los.
// Os testes leem o YAML como o kubectl o leria; não precisam de um cluster.
import { readFileSync } from 'node:fs';
import { parseAllDocuments } from 'yaml';

export function lerManifests(nome) {
  const texto = readFileSync(new URL(`./manifests/${nome}`, import.meta.url), 'utf8');
  const docs = parseAllDocuments(texto);
  for (const d of docs) {
    if (d.errors.length) throw new Error(`manifests/${nome}: YAML inválido: ${d.errors[0].message}`);
  }
  const objetos = docs.map((d) => d.toJS()).filter((o) => o && typeof o === 'object');
  if (objetos.length === 0) throw new Error(`manifests/${nome} ainda não tem nenhum objeto`);
  return objetos;
}

// Procura um objeto pelo tipo e pelo nome. Falha com uma mensagem clara se não existir.
export function obter(objetos, kind, nome) {
  const o = objetos.find((x) => x.kind === kind && x.metadata?.name === nome);
  if (!o) {
    const existentes = objetos.map((x) => `${x.kind}/${x.metadata?.name}`).join(', ') || 'nenhum';
    throw new Error(`falta o ${kind} "${nome}" (encontrei: ${existentes})`);
  }
  return o;
}

// O primeiro contentor do pod de um Deployment, CronJob, etc.
export const contentor = (podSpec) => podSpec?.containers?.[0] ?? {};

// Um selector "escolhe" um pod se TODAS as labels do selector existirem no pod, com o mesmo valor.
export const seleciona = (selector, labels) =>
  Object.keys(selector ?? {}).length > 0 &&
  Object.entries(selector).every(([k, v]) => labels?.[k] === v);
