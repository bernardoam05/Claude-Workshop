// Peças partilhadas pelos testes do módulo 46: um repositório em memória e uma forma de executar
// consultas GraphQL contra o teu esquema e os teus resolvers.
import { readFileSync } from 'node:fs';
import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { criarCarregador } from './carregador.js';
import { resolvers } from './resolvers.js';

export const lerEsquema = () => readFileSync(new URL('./esquema.graphql', import.meta.url), 'utf8');

export function repoFalso() {
  const utilizadores = [
    { id: '1', nome: 'Ana' },
    { id: '2', nome: 'Bruno' },
  ];
  const tarefas = [
    { id: '10', titulo: 'Pagar a luz', feita: true, donoId: '1' },
    { id: '11', titulo: 'Ler o capítulo 3', feita: false, donoId: '1' },
    { id: '12', titulo: 'Comprar pão', feita: false, donoId: '1' },
    { id: '20', titulo: 'Do Bruno', feita: false, donoId: '2' },
  ];
  const chamadas = { utilizadoresPorIds: [] };
  return {
    chamadas,
    tarefas,
    tarefasDe: async (donoId, { feita, limite = 100 } = {}) =>
      tarefas.filter((t) => t.donoId === donoId && (feita === undefined || feita === null || t.feita === feita)).slice(0, limite),
    tarefa: async (id) => tarefas.find((t) => t.id === id) ?? null,
    criar: async (donoId, titulo) => {
      const t = { id: String(100 + tarefas.length), titulo, feita: false, donoId };
      tarefas.push(t);
      return t;
    },
    concluir: async (id) => {
      const t = tarefas.find((x) => x.id === id);
      if (t) t.feita = true;
      return t ?? null;
    },
    utilizadoresPorIds: async (ids) => {
      chamadas.utilizadoresPorIds.push([...ids]);
      return ids.map((id) => utilizadores.find((u) => u.id === id) ?? null);
    },
  };
}

// executar(consulta, { utilizador, variaveis, repo }) → { data, errors }
export async function executar(consulta, { utilizador = { id: '1', nome: 'Ana' }, variaveis, repo = repoFalso() } = {}) {
  const schema = makeExecutableSchema({ typeDefs: lerEsquema(), resolvers });
  // Um contexto (e um carregador) NOVO por pedido.
  const carregadores = { utilizador: criarCarregador((ids) => repo.utilizadoresPorIds(ids)) };
  const r = await graphql({ schema, source: consulta, variableValues: variaveis, contextValue: { utilizador, repo, carregadores } });
  // O graphql cria os objetos do resultado sem protótipo; o JSON deixa-os como objetos normais,
  // como o cliente os veria depois de passarem pela rede.
  return { ...JSON.parse(JSON.stringify(r)), repo };
}
