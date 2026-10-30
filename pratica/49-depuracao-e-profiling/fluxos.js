// P2 · Streams: processar dados grandes aos bocados, com backpressure.
import { createInterface } from 'node:readline';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// somarPorCategoria(entrada) → { [categoria]: soma }
//   entrada: um Readable com texto CSV ('categoria,valor' por linha, com uma linha de cabeçalho
//   que se ignora, e linhas vazias que se ignoram). Os pedaços (chunks) do stream NÃO coincidem
//   com as linhas: uma linha pode vir partida em dois. Lê linha a linha (readline sobre o stream),
//   sem carregar o ficheiro inteiro em memória.
export async function somarPorCategoria(entrada) {
  throw new Error('Por fazer: P2');
}

// transformarLinhas(origem, destino, transformar) → Promise que acaba quando tudo foi escrito
//   Lê texto da origem, aplica transformar(linha) a cada linha (as linhas são separadas por '\n';
//   a última pode não ter '\n') e escreve cada resultado seguido de '\n' no destino.
//   Tem de respeitar a backpressure (se o destino for lento, a leitura espera: nada se acumula em
//   memória) e propagar os erros (se transformar lançar, a Promise rejeita e os streams fecham).
//   Dica: stream.promises.pipeline com um Transform que guarda o pedaço de linha incompleto.
export function transformarLinhas(origem, destino, transformar) {
  throw new Error('Por fazer: P2');
}
