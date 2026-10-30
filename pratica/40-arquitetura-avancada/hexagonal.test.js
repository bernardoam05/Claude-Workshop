import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarEnviadorEmMemoria, criarLembretes } from './hexagonal.js';

// Um adaptador de repositório em memória (nos testes, as portas são satisfeitas por objetos simples).
function repositorioEmMemoria(tarefas) {
  const lembradas = [];
  return {
    lembradas,
    async tarefasAtrasadas(agora) {
      return tarefas.filter((t) => t.prazo < agora && !lembradas.includes(t.id));
    },
    async marcarLembrada(id) {
      lembradas.push(id);
    },
  };
}

const ana = { email: 'ana@x.pt', nome: 'Ana' };
const bruno = { email: 'bruno@x.pt', nome: 'Bruno' };
const TAREFAS = [
  { id: 1, titulo: 'Relatório', dono: ana, prazo: new Date('2026-10-20') },
  { id: 2, titulo: 'Pagar a luz', dono: ana, prazo: new Date('2026-10-10') },
  { id: 3, titulo: 'Ler', dono: bruno, prazo: new Date('2026-10-25') },
  { id: 4, titulo: 'Futuro', dono: bruno, prazo: new Date('2026-12-01') },
];
const relogio = { agora: () => new Date('2026-10-29T10:00:00Z') };

describe('P3 · o caso de uso, com adaptadores em memória', () => {
  it('um email por pessoa, com as tarefas atrasadas por ordem de prazo', async () => {
    const repositorio = repositorioEmMemoria(TAREFAS);
    const enviador = criarEnviadorEmMemoria();
    const r = await criarLembretes({ repositorio, enviador, relogio }).executar();
    assert.deepEqual(r, { enviados: 2, falhados: 0 });
    const paraAna = enviador.enviados.find((e) => e.para === 'ana@x.pt');
    assert.deepEqual(paraAna, {
      para: 'ana@x.pt',
      assunto: 'Tens 2 tarefas atrasadas',
      texto: '- Pagar a luz (desde 2026-10-10)\n- Relatório (desde 2026-10-20)',
    });
    assert.equal(enviador.enviados.find((e) => e.para === 'bruno@x.pt').assunto, 'Tens 1 tarefa atrasada');
    assert.deepEqual(repositorio.lembradas.sort(), [1, 2, 3]);
  });

  it('se o envio a uma pessoa falhar, as tarefas dela ficam por lembrar e as outras seguem', async () => {
    const repositorio = repositorioEmMemoria(TAREFAS);
    const enviados = [];
    const enviador = {
      async enviar(email) {
        if (email.para === 'ana@x.pt') throw new Error('SMTP recusou');
        enviados.push(email);
      },
    };
    const r = await criarLembretes({ repositorio, enviador, relogio }).executar();
    assert.deepEqual(r, { enviados: 1, falhados: 1 });
    assert.deepEqual(repositorio.lembradas, [3]);
  });

  it('sem nada atrasado, não envia nada', async () => {
    const r = await criarLembretes({ repositorio: repositorioEmMemoria([]), enviador: criarEnviadorEmMemoria(), relogio }).executar();
    assert.deepEqual(r, { enviados: 0, falhados: 0 });
  });

  it('o caso de uso não importa nada de infraestrutura', async () => {
    const codigo = (await import('node:fs')).readFileSync(new URL('./hexagonal.js', import.meta.url), 'utf8');
    assert.ok(!/^import /m.test(codigo), 'o núcleo recebe as portas como parâmetros; não importa pg, nodemailer, fs...');
    const r = await criarLembretes({ repositorio: repositorioEmMemoria([]), enviador: criarEnviadorEmMemoria(), relogio }).executar();
    assert.equal(r.enviados, 0);
  });
});
