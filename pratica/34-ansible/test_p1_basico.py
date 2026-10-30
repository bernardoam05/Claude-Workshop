import json
import subprocess

import yaml  # o PyYAML vem com o Ansible

from conftest import AQUI, BIN, HOSTS, sh


def test_o_inventario_tem_os_grupos_web_e_db():
    r = subprocess.run([BIN / "ansible-inventory", "--list"], cwd=AQUI, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    inv = json.loads(r.stdout)
    assert sorted(inv.get("web", {}).get("hosts", [])) == ["ans-web1", "ans-web2"]
    assert inv.get("db", {}).get("hosts", []) == ["ans-db1"]
    variaveis = inv["_meta"]["hostvars"].get("ans-db1", {})
    assert variaveis.get("ansible_connection") == "community.docker.docker", "falta ansible_connection em [all:vars]"


def test_a_sintaxe_do_playbook_e_valida(playbook):
    r = playbook("p1-basico.yml", "--syntax-check")
    assert r.codigo == 0, r.saida


def test_cada_tarefa_tem_um_nome():
    plays = yaml.safe_load((AQUI / "p1-basico.yml").read_text()) or []
    tarefas = [t for play in plays for t in play.get("tasks", [])]
    assert len(tarefas) == 3, f"esperava 3 tarefas, encontrei {len(tarefas)}"
    for t in tarefas:
        assert t.get("name"), f"há uma tarefa sem name (o name é o que aparece na saída e nos logs): {t}"


def test_a_primeira_execucao_configura_todos_os_hosts(playbook):
    r = playbook("p1-basico.yml")
    assert r.codigo == 0, r.saida
    for h in HOSTS:
        assert sh(h, "id -u app") is not None, f"{h}: o utilizador app não existe"
        assert sh(h, "stat -c '%U %a' /srv/app").strip() == "app 755", f"{h}: /srv/app com dono ou permissões errados"
        assert sh(h, "cat /srv/app/LEIA-ME") == "Gerido pelo Ansible\n"


def test_a_segunda_execucao_nao_muda_nada_idempotencia(playbook):
    r = playbook("p1-basico.yml")
    assert r.codigo == 0, r.saida
    assert r.alteracoes() == {h: 0 for h in HOSTS}, (
        "na segunda execução, nenhuma tarefa devia mudar nada. Um módulo shell/command, por exemplo, "
        "diz sempre 'changed': usa módulos que verificam o estado (user, file, copy).\n" + r.saida
    )
