// P2 · Um diálogo de confirmação acessível.
//   - "Apagar tarefa" abre o diálogo como MODAL, com o foco no botão "Cancelar" (a escolha segura)
//   - o Escape fecha-o, e o foco volta ao botão que o abriu
//   - "Apagar" fecha e escreve "Tarefa apagada." em #estado; fechar de outra forma escreve "Cancelado."
//   - #estado é anunciado pelos leitores de ecrã quando muda (role="status")
const abrir = document.getElementById('abrir');
const dialogo = document.getElementById('confirmar');
const estado = document.getElementById('estado');

abrir.addEventListener('click', () => {
  dialogo.hidden = false;
});
document.getElementById('cancelar').addEventListener('click', () => {
  dialogo.hidden = true;
  estado.textContent = 'Cancelado.';
});
document.getElementById('apagar').addEventListener('click', () => {
  dialogo.hidden = true;
  estado.textContent = 'Tarefa apagada.';
});
