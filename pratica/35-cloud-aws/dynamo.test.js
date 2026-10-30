import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { CreateTableCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { aws, unico } from './ajuda.js';
import { TABELA, criarNota, marcarFeita, notasDe } from './dynamo.js';

describe('P3 · DynamoDB', () => {
  before(async () => {
    if (!process.env.LOCALSTACK_URL) return;
    const { ddbBase } = aws();
    await ddbBase.send(new CreateTableCommand({
      TableName: TABELA,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{ AttributeName: 'PK', AttributeType: 'S' }, { AttributeName: 'SK', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'PK', KeyType: 'HASH' }, { AttributeName: 'SK', KeyType: 'RANGE' }],
    })).catch((e) => {
      if (e.name !== 'ResourceInUseException') throw e;
    });
  });

  it('cria notas com as chaves do desenho single-table', async () => {
    const { ddb, ddbBase } = aws();
    const u = unico('ana');
    await criarNota(ddb, { utilizador: u, id: '002', titulo: 'Ler' });
    const { Items } = await ddbBase.send(new ScanCommand({ TableName: TABELA }));
    const item = Items.find((i) => i.PK.S === `USER#${u}`);
    assert.ok(item, `não encontrei nenhum item com PK = USER#${u}`);
    assert.deepEqual(item.SK, { S: 'NOTA#002' });
    assert.deepEqual(item.titulo, { S: 'Ler' });
    assert.deepEqual(item.feita, { BOOL: false });
    assert.deepEqual(item.versao, { N: '1' });
  });

  it('não deixa criar duas notas com o mesmo id (escrita condicional)', async () => {
    const { ddb } = aws();
    const u = unico('ana');
    await criarNota(ddb, { utilizador: u, id: '1', titulo: 'Original' });
    await assert.rejects(criarNota(ddb, { utilizador: u, id: '1', titulo: 'Por cima' }), /existe/);
    assert.equal((await notasDe(ddb, u))[0].titulo, 'Original');
  });

  it('notasDe devolve só as do utilizador, ordenadas pelo id', async () => {
    const { ddb } = aws();
    const [ana, bruno] = [unico('ana'), unico('bruno')];
    for (const id of ['003', '001', '002']) await criarNota(ddb, { utilizador: ana, id, titulo: `t${id}` });
    await criarNota(ddb, { utilizador: bruno, id: '001', titulo: 'do bruno' });
    assert.deepEqual(await notasDe(ddb, ana), [
      { id: '001', titulo: 't001', feita: false, versao: 1 },
      { id: '002', titulo: 't002', feita: false, versao: 1 },
      { id: '003', titulo: 't003', feita: false, versao: 1 },
    ]);
  });

  it('usa uma Query e não um Scan', async () => {
    const codigo = (await import('node:fs')).readFileSync(new URL('./dynamo.js', import.meta.url), 'utf8');
    assert.ok(!/ScanCommand/.test(codigo), 'um Scan lê a tabela inteira: numa tabela grande, é lento e caro');
    assert.match(codigo, /QueryCommand\(/);
  });

  it('bloqueio otimista: só atualiza se a versão for a esperada', async () => {
    const { ddb } = aws();
    const u = unico('ana');
    await criarNota(ddb, { utilizador: u, id: '1', titulo: 'x' });
    assert.deepEqual(await marcarFeita(ddb, u, '1', 1), { id: '1', titulo: 'x', feita: true, versao: 2 });
    await assert.rejects(marcarFeita(ddb, u, '1', 1), /conflito/, 'outra pessoa já a tinha mudado (versão 2)');
    await assert.rejects(marcarFeita(ddb, u, 'nao-existe', 1), /conflito/);
  });
});
