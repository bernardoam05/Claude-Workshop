// P4 · Um cliente WebSocket que sobrevive a quedas de ligação (usa o WebSocket do browser, que o Node
// também tem: new WebSocket(url)).

// esperaAntesDe(tentativa, { base = 500, maximo = 10000, aleatorio = Math.random })
//   → milissegundos a esperar antes da tentativa n (0, 1, 2...): base × 2^tentativa, no máximo `maximo`,
//     com "jitter completo": um valor aleatório entre 0 e esse teto (aleatorio() × teto, arredondado).
//   Sem o aleatório, mil clientes que caíram ao mesmo tempo voltavam todos no mesmo instante.
export function esperaAntesDe(tentativa, { base = 500, maximo = 10000, aleatorio = Math.random } = {}) {
  throw new Error('Por fazer: P4');
}

// new ClienteResiliente(url, { aoMensagem, aoLigar = () => {}, espera = esperaAntesDe })
//   - liga-se logo; quando a ligação abre, chama aoLigar(this), põe a contagem de tentativas a 0, e
//     envia as mensagens que ficaram na fila enquanto estava desligado (pela ordem)
//   - cada mensagem recebida: aoMensagem(JSON.parse(dados))
//   - quando a ligação fecha (e não foi o próprio cliente a fechar): volta a ligar depois de
//     espera(tentativa) ms, e a tentativa seguinte espera mais
//   - enviar(objeto): JSON.stringify e envia já se estiver ligado; senão, guarda na fila
//   - fechar(): fecha de vez (sem voltar a ligar)
//   - get ligado(): true se a ligação estiver aberta
export class ClienteResiliente {
  constructor(url, { aoMensagem, aoLigar = () => {}, espera = esperaAntesDe }) {
    throw new Error('Por fazer: P4');
  }
}
