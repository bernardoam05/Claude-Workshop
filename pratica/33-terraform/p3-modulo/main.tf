# P3 · Um módulo reutilizado: a raiz cria vários sites a partir de modulos/site.
#
# 1. Bloco terraform com o provider kreuzwerker/docker (~> 3.6), como no P2.
# 2. Variável "sites": um map de objetos { porta = number, mensagem = string }, por omissão:
#        azul  → porta 8092, mensagem "Site azul"
#        verde → porta 8093, mensagem "Site verde"
# 3. Um bloco module "site", com for_each sobre var.sites e source = "./modulos/site", que passa:
#        nome     = "tf-pratica-<chave>"   (ex.: tf-pratica-azul)
#        porta    = a porta do site
#        mensagem = a mensagem do site
# 4. Output "urls": um map chave → url de cada módulo (ex.: { azul = "http://127.0.0.1:8092", ... }).
