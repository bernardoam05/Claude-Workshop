import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verificarPostmortem } from './postmortem.js';

const bom = `# Postmortem: listagem de tarefas em baixo (2026-10-12)

## Resumo
Durante 38 minutos, a listagem de tarefas devolveu 503 a 60% dos pedidos.

## Impacto
60% dos pedidos falharam; 1,2% do orçamento de erro mensal gasto.

## Cronologia
- 14:02 deploy da versão 2.4.1
- 14:09 alerta de taxa de queima (1h/5m)
- 14:40 rollback concluído

## Causas
Uma migração criou um índice sem CONCURRENTLY e bloqueou a tabela. O pipeline não testa
migrações com dados de volume real.

## Ações
- [ ] Testar migrações contra uma cópia anonimizada da produção (@ana, 2026-11-15)
- [x] Regra de lint para CREATE INDEX sem CONCURRENTLY (@rui, 2026-10-20)
`;

describe('P4 · verificarPostmortem', () => {
  it('um postmortem completo e sem culpas não tem problemas', () => {
    assert.deepEqual(verificarPostmortem(bom), []);
  });
  it('aponta as secções em falta', () => {
    const texto = bom.replace('## Impacto', '## Efeitos').replace('## Cronologia', '### Cronologia');
    assert.deepEqual(verificarPostmortem(texto), ['Falta a secção: Impacto', 'Falta a secção: Cronologia']);
  });
  it('aponta ações sem dono ou sem data', () => {
    const texto = bom
      .replace('(@ana, 2026-11-15)', '(@ana)')
      .replace('(@rui, 2026-10-20)', '');
    assert.deepEqual(verificarPostmortem(texto), [
      'Ação sem dono ou data: Testar migrações contra uma cópia anonimizada da produção (@ana)',
      'Ação sem dono ou data: Regra de lint para CREATE INDEX sem CONCURRENTLY',
    ]);
  });
  it('exige pelo menos uma ação', () => {
    const texto = bom.split('## Ações')[0] + '## Ações\nNenhuma.\n';
    assert.deepEqual(verificarPostmortem(texto), ['Sem ações']);
  });
  it('só olha para as tarefas da secção Ações', () => {
    const texto = bom.replace('## Cronologia\n', '## Cronologia\n- [ ] isto não é uma ação\n');
    assert.deepEqual(verificarPostmortem(texto), []);
  });
  it('apanha linguagem de culpa, sem distinguir maiúsculas', () => {
    const texto = bom.replace('Uma migração', 'Foi Erro Humano: o Rui devia ter visto. Uma migração');
    assert.deepEqual(verificarPostmortem(texto), ['Linguagem de culpa: erro humano', 'Linguagem de culpa: devia ter']);
  });
});
