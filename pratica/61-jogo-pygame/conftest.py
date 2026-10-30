# Os testes correm o pygame sem janela nem som: o SDL desenha para a memória.
# Tem de ser definido ANTES de o pygame ser importado.
import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
