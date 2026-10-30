// Peças partilhadas pelos testes do módulo 55.
import Anthropic from '@anthropic-ai/sdk';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { arrancarFalso } from './servidorFalso.js';

// Um cliente do SDK oficial, apontado para o servidor falso. maxRetries: 0, para os testes de erros
// verem o primeiro erro (o SDK, por omissão, repete 2 vezes os 429 e 5xx sozinho).
export async function clienteFalso() {
  const falso = await arrancarFalso();
  const cliente = new Anthropic({ apiKey: 'chave-de-teste', baseURL: falso.url, maxRetries: 0 });
  return { falso, cliente };
}

// Um "embedder" falso, mas determinista: conta palavras de um pequeno vocabulário.
// (Um embedder a sério captaria o significado, e "férias" ficaria perto de "descanso"; este só vê
// palavras iguais. Chega para testar a canalização: guardar, procurar, ordenar.)
export const VOCABULARIO = ['férias', 'dias', 'salário', 'pagamento', 'teletrabalho', 'casa', 'computador', 'reembolso'];
export function embedFalso(texto) {
  const palavras = texto.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  // 0,01 em todas as posições: um vetor só com zeros não tem direção, e o cosseno não se calcula.
  return VOCABULARIO.map((v) => palavras.filter((p) => p === v).length + 0.01);
}

export async function bdComVetores() {
  const db = new PGlite({ extensions: { vector } });
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE pedacos (id SERIAL PRIMARY KEY, documento TEXT, texto TEXT, embedding vector(${VOCABULARIO.length}));
  `);
  return db;
}
