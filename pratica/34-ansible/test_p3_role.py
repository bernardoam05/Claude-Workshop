from conftest import HOSTS, sh

ESPERADO = {
    "ans-web1": "Servidor ans-web1 · equipa plataforma\nUtilizadores: ana, bruno\n",
    "ans-web2": "Servidor ans-web2 · equipa plataforma\nUtilizadores: ana, bruno\n",
    "ans-db1": "Servidor ans-db1 · equipa dados\nUtilizadores: ana, carla\n",
}


def test_a_sintaxe_do_playbook_e_valida(playbook):
    r = playbook("p3-site.yml", "--syntax-check")
    assert r.codigo == 0, r.saida


def test_a_role_cria_os_utilizadores_certos_em_cada_grupo(playbook):
    r = playbook("p3-site.yml")
    assert r.codigo == 0, r.saida
    for h in ["ans-web1", "ans-web2"]:
        assert sh(h, "id -u bruno") is not None, f"{h}: falta o bruno (vem dos defaults da role)"
        assert sh(h, "id -u carla") is None, f"{h}: a carla só devia existir nos servidores db"
    assert sh("ans-db1", "id -u carla") is not None, "ans-db1: falta a carla (vem do group_vars/db.yml)"
    assert sh("ans-db1", "id -u bruno") is None, "ans-db1: o group_vars/db.yml devia substituir a lista, não somar"
    for h in HOSTS:
        assert sh(h, "grep '^ana:' /etc/passwd | cut -d: -f7").strip() == "/bin/sh"


def test_o_motd_usa_os_defaults_ou_o_group_vars_conforme_o_host():
    for h, texto in ESPERADO.items():
        assert sh(h, "cat /etc/motd") == texto, f"{h}: /etc/motd diferente do esperado"


def test_idempotente_e_o_handler_so_correu_uma_vez(playbook):
    r = playbook("p3-site.yml")
    assert r.codigo == 0, r.saida
    assert r.alteracoes() == {h: 0 for h in HOSTS}, r.saida
    for h in HOSTS:
        assert (sh(h, "cat /var/log/motd-alteracoes") or "").count("alterado") == 1
