import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import grpc from '@grpc/grpc-js';
import { carregarDefinicao, criarServidor } from './servidorGrpc.js';

const NOTAS = () => [
  { id: 1, titulo: 'Pão', feita: true },
  { id: 2, titulo: 'Luz', feita: false },
  { id: 3, titulo: 'Ler', feita: false },
];

async function arrancar(notas = NOTAS()) {
  const servidor = criarServidor(notas);
  const porta = await new Promise((resolve, reject) =>
    servidor.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (e, p) => (e ? reject(e) : resolve(p))),
  );
  const { Notas } = carregarDefinicao();
  const cliente = new Notas(`127.0.0.1:${porta}`, grpc.credentials.createInsecure());
  // Os métodos do cliente usam callbacks; com um prazo (deadline) de 2 s em cada chamada.
  const chamar = (metodo, pedido) =>
    new Promise((resolve, reject) =>
      cliente[metodo](pedido, { deadline: Date.now() + 2000 }, (e, r) => (e ? reject(e) : resolve(r))),
    );
  return { cliente, chamar, notas, fechar: () => (cliente.close(), servidor.forceShutdown()) };
}

describe('P4 · gRPC', () => {
  it('o .proto define o serviço e as mensagens', () => {
    const { Notas } = carregarDefinicao();
    assert.deepEqual(Object.keys(Notas.service).sort(), ['Criar', 'Listar', 'Obter']);
    assert.equal(Notas.service.Listar.responseStream, true, 'Listar devolve um stream');
    assert.equal(Notas.service.Obter.responseStream, false);
  });

  it('Obter: unário, e NOT_FOUND para um id que não existe', async () => {
    const s = await arrancar();
    try {
      assert.deepEqual(await s.chamar('Obter', { id: 2 }), { id: 2, titulo: 'Luz', feita: false });
      await assert.rejects(s.chamar('Obter', { id: 99 }), (e) => e.code === grpc.status.NOT_FOUND);
    } finally {
      s.fechar();
    }
  });

  it('Listar: um stream de notas, com o filtro', async () => {
    const s = await arrancar();
    try {
      const ler = (pedido) =>
        new Promise((resolve, reject) => {
          const recebidas = [];
          const stream = s.cliente.Listar(pedido);
          stream.on('data', (n) => recebidas.push(n.id));
          stream.on('end', () => resolve(recebidas));
          stream.on('error', reject);
        });
      assert.deepEqual(await ler({}), [1, 2, 3]);
      assert.deepEqual(await ler({ so_por_fazer: true }), [2, 3]);
    } finally {
      s.fechar();
    }
  });

  it('Criar: valida, e dá o id seguinte', async () => {
    const s = await arrancar();
    try {
      assert.deepEqual(await s.chamar('Criar', { titulo: '  Nova  ' }), { id: 4, titulo: 'Nova', feita: false });
      assert.equal(s.notas.length, 4);
      await assert.rejects(s.chamar('Criar', { titulo: '   ' }), (e) => e.code === grpc.status.INVALID_ARGUMENT);
    } finally {
      s.fechar();
    }
  });
});
