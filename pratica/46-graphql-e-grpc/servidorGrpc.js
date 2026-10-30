// P4 · O servidor gRPC do serviço de notas.
import grpc from '@grpc/grpc-js'; // eslint-disable-line no-unused-vars
import protoLoader from '@grpc/proto-loader'; // eslint-disable-line no-unused-vars

// carregarDefinicao() → o pacote "notas" do notas.proto (protoLoader.loadSync com
//   { keepCase: true, defaults: true }, e depois grpc.loadPackageDefinition(...).notas)
export function carregarDefinicao() {
  throw new Error('Por fazer: P4');
}

// criarServidor(notas) → um grpc.Server com o serviço Notas implementado sobre o array `notas`
//   ([{ id, titulo, feita }]):
//   - Obter: a nota com esse id; se não existir, o erro { code: grpc.status.NOT_FOUND, message: "..." }
//   - Listar: escreve (call.write) cada nota, só as por fazer se so_por_fazer, e termina (call.end())
//   - Criar: título vazio (depois de tirar os espaços) → { code: grpc.status.INVALID_ARGUMENT };
//            senão, acrescenta { id: <maior id + 1>, titulo, feita: false } e devolve-a
// (o servidor ainda não está a ouvir: quem o usa faz bindAsync)
export function criarServidor(notas) {
  throw new Error('Por fazer: P4');
}
