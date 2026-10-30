// P4 · Uma piscina (pool) de worker threads para trabalho de CPU, fora do event loop.
import { Worker } from 'node:worker_threads';

// criarPiscina({ tamanho, ficheiro }) → { executar(dados), get ativos, fechar() }
//   Arranca `tamanho` workers com new Worker(ficheiro). executar(dados) → Promise com a resposta:
//   - se houver um worker livre, envia-lhe os dados (postMessage) e espera pela mensagem dele
//   - senão, o trabalho fica numa fila, e o primeiro worker a ficar livre apanha-o
//   - se o worker lançar um erro (evento 'error'), a Promise desse trabalho rejeita, o worker
//     (que morreu) é substituído por um novo, e a piscina continua com `tamanho` workers
//   ativos → quantos trabalhos estão a correr agora
//   fechar() → termina todos os workers (Promise)
export function criarPiscina({ tamanho, ficheiro }) {
  throw new Error('Por fazer: P4');
}
