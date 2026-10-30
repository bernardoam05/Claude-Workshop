// P2 · Feature flags: separar o deploy (o código chega à produção) do lançamento (os utilizadores veem).
import { balde } from './canario.js';

// criarFlags(flags) → { ativa(nome, contexto, padrao = false) }
//   flags: { [nome]: { ligada, utilizadores = [], regras = [], percentagem = 0 } }
//   contexto: { id, ...atributos } (ex.: { id: 'ana', pais: 'PT', plano: 'pro' })
//   ativa(nome, contexto, padrao) decide, por esta ordem:
//     1. flag desconhecida → padrao (o código nunca pode rebentar por causa de uma flag em falta)
//     2. ligada === false → false (o "kill switch": desliga para toda a gente, de imediato)
//     3. o id está em utilizadores → true (a equipa, os testadores beta)
//     4. alguma regra { atributo, valores } tem contexto[atributo] em valores → true
//     5. balde(contexto.id, nome) < percentagem → true (o nome é o sal: cada flag tem a sua
//        divisão, para os mesmos 10% não ficarem com todas as novidades)
//     6. senão → false
export function criarFlags(flags) {
  throw new Error('Por fazer: P2');
}
