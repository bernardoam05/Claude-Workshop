from conftest import sh

WEB = ["ans-web1", "ans-web2"]

ESPERADO = """# Gerido pelo Ansible: não edites à mão.
porta = {porta}
ambiente = producao
host = {host}
workers:
  - envio
  - limpeza
"""


def recarregamentos(h):
    return (sh(h, "cat /srv/app/recarregamentos 2>/dev/null") or "").count("recarregado")


def test_a_sintaxe_do_playbook_e_valida(playbook):
    r = playbook("p2-config.yml", "--syntax-check")
    assert r.codigo == 0, r.saida


def test_so_mexe_no_grupo_web(playbook):
    r = playbook("p2-config.yml")
    assert r.codigo == 0, r.saida
    assert "ans-db1" not in r.alteracoes(), "a play devia ser só para o grupo web"


def test_cria_as_pastas_com_um_loop():
    for h in WEB:
        for pasta in ["logs", "dados", "tmp"]:
            assert sh(h, f"test -d /srv/app/{pasta} && echo sim") == "sim\n", f"{h}: falta /srv/app/{pasta}"


def test_o_template_gera_o_ficheiro_com_as_variaveis_do_grupo_e_do_host():
    for h in WEB:
        assert sh(h, "cat /srv/app/app.conf") == ESPERADO.format(porta=8080, host=h)
        assert sh(h, "stat -c %a /srv/app/app.conf").strip() == "644"


def test_o_handler_correu_uma_vez_porque_o_ficheiro_mudou():
    for h in WEB:
        assert recarregamentos(h) == 1


def test_sem_alteracoes_o_handler_nao_corre(playbook):
    r = playbook("p2-config.yml")
    assert r.codigo == 0, r.saida
    assert r.alteracoes() == {h: 0 for h in WEB}, r.saida
    for h in WEB:
        assert recarregamentos(h) == 1, "o handler correu sem nada ter mudado"


def test_mudar_uma_variavel_muda_o_ficheiro_e_volta_a_chamar_o_handler(playbook):
    r = playbook("p2-config.yml", "-e", "porta=9090")
    assert r.codigo == 0, r.saida
    for h in WEB:
        assert sh(h, "cat /srv/app/app.conf") == ESPERADO.format(porta=9090, host=h)
        assert recarregamentos(h) == 2
