// O código antigo dos estados de uma tarefa. NÃO MEXER: os testes comparam a tua versão com esta.
export function estadoSeguinteLegado(estado, acao) {
  switch (estado) {
    case 'rascunho':
      if (acao === 'publicar') return 'aberta';
      if (acao === 'cancelar') return 'cancelada';
      break;
    case 'aberta':
      if (acao === 'comecar') return 'em_curso';
      if (acao === 'cancelar') return 'cancelada';
      break;
    case 'em_curso':
      if (acao === 'bloquear') return 'bloqueada';
      if (acao === 'concluir') return 'feita';
      if (acao === 'cancelar') return 'cancelada';
      break;
    case 'bloqueada':
      if (acao === 'desbloquear') return 'em_curso';
      if (acao === 'cancelar') return 'cancelada';
      break;
    case 'feita':
      if (acao === 'reabrir') return 'aberta';
      break;
    case 'cancelada':
      if (acao === 'reabrir') return 'aberta';
      break;
  }
  throw new Error(`Ação "${acao}" impossível no estado "${estado}"`);
}
