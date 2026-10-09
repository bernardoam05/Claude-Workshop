#!/usr/bin/env node
// Quiz de autoavaliação do workshop. Zero dependências: só o Node, de propósito —
// é o mesmo princípio dos testes da API e do worker (node:test, sem framework).
//
// Uso:
//   node scripts/quiz.mjs           → menu com o estado de cada módulo
//   node scripts/quiz.mjs status    → só mostra o progresso, sem perguntar nada
//   node scripts/quiz.mjs 06        → quiz do módulo 06 (RabbitMQ), só com perguntas DESSE módulo
//   node scripts/quiz.mjs geral     → só as perguntas gerais, que ligam vários módulos entre si
//   node scripts/quiz.mjs exame     → tudo: 2 perguntas de cada módulo + todas as gerais
//
// O que isto prova e o que NÃO prova: acertar as perguntas mostra que reconheces os
// conceitos e os factos de cada módulo. Não prova que consegues ESCREVER um Dockerfile
// do zero ou depurar uma fila a sério — isso só os exercícios do módulo 11 testam,
// e aí a correção é a tua própria (com as soluções em <details> para comparares).
//
// Nota de implementação: usamos o ITERADOR ASSÍNCRONO do readline (rl[Symbol.asyncIterator]),
// não rl.question() em sequência. Com stdin em pipe, question() repetido perde as linhas
// seguintes assim que o pipe esvazia (a interface fecha-se antes da próxima pergunta "ouvir").
// O iterador não tem esse problema, e funciona da mesma forma com um terminal real.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(path.join(here, 'quiz-questions.json'), 'utf8'));
const bank = data.modules; // só os módulos com teoria (sem o 00, índice, nem o 11, que já é o próprio teste)
const geral = data.geral;  // perguntas que LIGAM vários módulos — somam-se às dos módulos, nunca as substituem
const resultsPath = path.join(here, '..', '.quiz-results.json');
const PASS_THRESHOLD = 0.7; // 70% para "passar" um módulo

function loadResults() {
  if (!existsSync(resultsPath)) return {};
  try {
    return JSON.parse(readFileSync(resultsPath, 'utf8'));
  } catch {
    return {}; // ficheiro corrompido ou vazio: começa do zero em vez de rebentar
  }
}

function saveResults(results) {
  writeFileSync(resultsPath, JSON.stringify(results, null, 2) + '\n');
}

const normalize = (s) => s.trim().toLowerCase();

// Fisher-Yates: baralha sem repetir posições, para a ordem das perguntas não se tornar previsível.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function askQuestion(nextLine, q, index) {
  console.log(`\n${index + 1}. ${q.q}`);

  if (q.type === 'mcq') {
    const letters = ['a', 'b', 'c', 'd'];
    q.options.forEach((opt, i) => console.log(`   ${letters[i]}) ${opt}`));
    process.stdout.write('   Resposta (a/b/c/d): ');
    const raw = await nextLine();
    const chosen = letters.indexOf(normalize(raw));
    const correct = chosen === q.answer;
    console.log(correct ? '   ✔ Certo.' : `   ✘ Errado. Resposta certa: ${letters[q.answer]}) ${q.options[q.answer]}`);
    console.log(`   → ${q.explain}`);
    return correct;
  }

  // "short": aceita qualquer das variantes em q.answers, sem distinguir maiúsculas/minúsculas nem espaços.
  process.stdout.write('   Resposta: ');
  const raw = await nextLine();
  const correct = q.answers.map(normalize).includes(normalize(raw));
  console.log(correct ? '   ✔ Certo.' : `   ✘ Errado. Resposta aceite: "${q.answers[0]}"`);
  console.log(`   → ${q.explain}`);
  return correct;
}

async function runQuestions(nextLine, questions) {
  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    if (await askQuestion(nextLine, questions[i], i)) score++;
  }
  return score;
}

async function runModuleQuiz(nextLine, mod) {
  console.log(`\n=== Módulo ${mod.id} · ${mod.title} ===`);
  console.log(`(se tiveres dúvidas, a resposta certa de cada pergunta aponta para ${mod.doc})`);

  const questions = shuffle(mod.questions);
  const score = await runQuestions(nextLine, questions);
  const pct = score / questions.length;

  console.log(`\nResultado: ${score}/${questions.length} (${Math.round(pct * 100)}%)`);
  if (pct >= PASS_THRESHOLD) {
    console.log(`✔ Passaste o módulo ${mod.id}. Podes avançar para o seguinte.`);
  } else {
    console.log(`✘ Abaixo de ${Math.round(PASS_THRESHOLD * 100)}%. Revê ${mod.doc} antes de continuares — não avances só para "despachar".`);
  }

  return { score, total: questions.length, pct, passed: pct >= PASS_THRESHOLD, date: new Date().toISOString() };
}

async function runExam(nextLine) {
  console.log('\n=== Exame final: 2 perguntas de cada módulo + TODAS as perguntas gerais ===');
  // As gerais não são amostradas: entram por completo, porque são elas que testam a ligação entre módulos.
  const perModule = bank.flatMap((mod) => shuffle(mod.questions).slice(0, 2));
  const questions = shuffle([...perModule, ...geral.questions]);
  const score = await runQuestions(nextLine, questions);
  const pct = score / questions.length;
  console.log(`\nResultado do exame: ${score}/${questions.length} (${Math.round(pct * 100)}%)`);
  return { score, total: questions.length, pct, passed: pct >= PASS_THRESHOLD, date: new Date().toISOString() };
}

function printStatus(results) {
  console.log('\nEstado por módulo:\n');
  for (const mod of bank) {
    const r = results[mod.id];
    const status = !r ? '— por fazer' : r.passed ? `✔ passou (${Math.round(r.pct * 100)}%)` : `✘ repetir (${Math.round(r.pct * 100)}%)`;
    console.log(`  ${mod.id}  ${mod.title.padEnd(32)} ${status}`);
  }
  if (results.geral) {
    const r = results.geral;
    console.log(`\n  geral  ${geral.title.padEnd(32)} ${r.passed ? `✔ passou (${Math.round(r.pct * 100)}%)` : `✘ repetir (${Math.round(r.pct * 100)}%)`}`);
  }
  if (results.exame) {
    console.log(`  exame final: ${results.exame.score}/${results.exame.total} (${Math.round(results.exame.pct * 100)}%) em ${results.exame.date.slice(0, 10)}`);
  }
  console.log('\n(Nota: os módulos 00 e 11 não têm quiz de propósito — 00 é o índice, e o 11 É o próprio teste: os exercícios práticos, com soluções em <details> dentro de cada um.)\n');
}

async function main() {
  const arg = process.argv[2];
  const results = loadResults();

  if (!arg || arg === 'status') {
    printStatus(results);
    if (!arg) {
      console.log('Uso: node scripts/quiz.mjs <módulo|exame|status>');
      console.log('Exemplo: node scripts/quiz.mjs 06\n');
    }
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const iterator = rl[Symbol.asyncIterator]();
  // nextLine(): lê a próxima linha sem perder as seguintes; '' se o input acabar (EOF) a meio.
  const nextLine = async () => {
    const { value, done } = await iterator.next();
    return done ? '' : value;
  };

  try {
    if (arg === 'exame') {
      results.exame = await runExam(nextLine);
      saveResults(results);
      return;
    }

    if (arg === 'geral') {
      // Reaproveita runModuleQuiz com um "módulo" sintético: mesma mecânica, perguntas diferentes.
      results.geral = await runModuleQuiz(nextLine, { id: 'geral', title: geral.title, doc: 'docs/00-indice.md', questions: geral.questions });
      saveResults(results);
      printStatus(results);
      return;
    }

    const id = arg.padStart(2, '0');
    const mod = bank.find((m) => m.id === id);
    if (!mod) {
      const disponiveis = bank.map((m) => m.id).join(', ');
      console.log(`Módulo "${arg}" não encontrado. Disponíveis: ${disponiveis}, ou "exame" / "status".`);
      return;
    }

    results[mod.id] = await runModuleQuiz(nextLine, mod);
    saveResults(results);
    printStatus(results);
  } finally {
    rl.close();
  }
}

main();
