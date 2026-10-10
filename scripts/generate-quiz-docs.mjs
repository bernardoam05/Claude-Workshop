#!/usr/bin/env node
// Gera a secção "Quiz rápido" no fim de cada módulo (docs/) e das perguntas gerais no índice,
// a partir de scripts/quiz-questions.json — a MESMA fonte de dados que alimenta scripts/quiz.mjs.
//
// Fonte única de verdade: muda as perguntas no JSON, corre este script, e todos os .md
// atualizam-se sozinhos. Nunca edites à mão o conteúdo entre <!-- quiz:start --> e <!-- quiz:end -->
// num .md — a próxima execução deste script substitui-o.
//
// Uso: node scripts/generate-quiz-docs.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const data = JSON.parse(readFileSync(path.join(here, 'quiz-questions.json'), 'utf8'));

const START = '<!-- quiz:start -->';
const END = '<!-- quiz:end -->';
const LETTERS = ['a', 'b', 'c', 'd'];

function renderQuestion(q, i) {
  const lines = [`**${i + 1}.** ${q.q}`, ''];
  if (q.type === 'mcq') {
    q.options.forEach((opt, idx) => lines.push(`- ${LETTERS[idx]}) ${opt}`));
    lines.push('');
  }
  lines.push('<details><summary>Resposta</summary>', '');
  lines.push(
    q.type === 'mcq'
      ? `**${LETTERS[q.answer]}) ${q.options[q.answer]}** — ${q.explain}`
      : `**${q.answers[0]}** — ${q.explain}`,
  );
  lines.push('', '</details>');
  return lines.join('\n');
}

function renderBlock({ title, isGeneral, questions, cliArg }) {
  const intro = isGeneral
    ? 'Estas perguntas ligam vários módulos entre si: não substituem o quiz de cada módulo, somam-se a ele. Fazem mais sentido depois de teres passado pela maioria dos módulos.'
    : 'Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta.';
  const parts = [
    START,
    '',
    `## Quiz rápido${isGeneral ? ' (perguntas gerais)' : ' (autoavaliação)'}`,
    '',
    `${intro} Versão interativa e corrigida automaticamente: \`node scripts/quiz.mjs ${cliArg}\`.`,
    '',
  ];
  questions.forEach((q, i) => {
    parts.push(renderQuestion(q, i));
    parts.push('');
  });
  parts.push(END);
  return parts.join('\n');
}

// Os marcadores só contam quando ocupam a LINHA TODA (começo e fim de linha), nunca dentro de
// uma frase. Um bug real aconteceu aqui: uma frase a EXPLICAR os marcadores, com
// "`<!-- quiz:start -->`" dentro de código inline, foi confundida com o marcador a sério,
// e o gerador substituiu o pedaço errado do documento. indexOf() simples não distingue os dois;
// uma regex ancorada a início/fim de linha (com a flag "m") distingue.
const START_RE = /^<!-- quiz:start -->$/m;
const END_RE = /^<!-- quiz:end -->$/m;

function upsertBlock(filePath, block) {
  const original = readFileSync(filePath, 'utf8');
  const startMatch = START_RE.exec(original);
  const endMatch = END_RE.exec(original);
  const content =
    startMatch && endMatch && endMatch.index > startMatch.index
      ? original.slice(0, startMatch.index) + block + original.slice(endMatch.index + endMatch[0].length)
      : `${original.trimEnd()}\n\n${block}\n`;
  writeFileSync(filePath, content);
}

for (const mod of data.modules) {
  const file = path.join(root, mod.doc);
  upsertBlock(file, renderBlock({ title: mod.title, isGeneral: false, questions: mod.questions, cliArg: mod.id }));
  console.log('atualizado:', mod.doc);
}

// Perguntas gerais: aditivas, no fim do índice — não substituem nenhum quiz de módulo.
const indexFile = path.join(root, 'docs/00-indice.md');
upsertBlock(indexFile, renderBlock({ title: data.geral.title, isGeneral: true, questions: data.geral.questions, cliArg: 'geral' }));
console.log('atualizado: docs/00-indice.md (perguntas gerais)');
