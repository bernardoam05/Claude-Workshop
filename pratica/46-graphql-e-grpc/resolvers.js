// P2 · Os resolvers: uma função por campo, que diz de onde vem o valor.
import { GraphQLError } from 'graphql'; // eslint-disable-line no-unused-vars

// O "contexto" (context) é criado por pedido e chega a todos os resolvers:
//   { utilizador: { id, nome } ou null, repo, carregadores }
// repo (já feito, nos testes) tem: tarefasDe(donoId, { feita, limite }), tarefa(id), criar(donoId, titulo),
//   concluir(id), utilizadoresPorIds(ids) (devolve os utilizadores pela MESMA ordem dos ids)
// carregadores.utilizador.load(id): o DataLoader do P3, para ir buscar donos sem N+1.
//
// Regras:
//   - sem utilizador no contexto: "eu" devolve null; tudo o resto lança um GraphQLError com
//     extensions.code = "UNAUTHENTICATED"
//   - "tarefa" e "concluirTarefa" só funcionam com tarefas do próprio (senão devolvem null, como se não
//     existissem: o IDOR do módulo 26)
//   - "tarefas": as do utilizador, filtradas por "feita" se vier, no máximo "primeiras" (que tem de
//     estar entre 1 e 100: senão, GraphQLError com extensions.code = "BAD_USER_INPUT")
//   - "criarTarefa": o título sem espaços nas pontas, com 1 a 200 caracteres (senão BAD_USER_INPUT)
//   - Tarefa.dono: carregadores.utilizador.load(tarefa.donoId)
//   - Utilizador.tarefas(feita): as tarefas desse utilizador (repo.tarefasDe, limite 100)
export const resolvers = {};
