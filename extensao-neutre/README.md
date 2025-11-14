# Neutralizador PT-BR (Guia Ophelia Cassiano) — Repo para Extensão Chrome

Esta pasta contém uma **extensão Chrome** pronta para ser carregada (unpacked) e um conjunto de regras e ferramentas para neutralização de gênero em português conforme o *Guia para Linguagem Neutra PT-BR* (Ophelia Cassiano). Inclui painel de diagnóstico e sistema de **sugestão automática** (lightweight) para gerar regras novas quando detectar padrões consistentes que não foram neutralizados.

**O que está neste repositório (pronto para enviar ao GitHub):**

- `src/` — código da extensão (manifest.json, content script, popup, assets)
- `rules/` — regras morfológicas iniciais (JSON) seguindo as diretrizes do Guia (formas com -e/-u, exceções)
- `debug/` — logs e utilitários, scripts para gerar sugestões
- `LICENSE` — MIT (pode alterar)
- `README.md` — este arquivo (instruções rápidas)

**Principais funcionalidades implementadas:**
- Neutralização respeitando formas do Guia (ex.: `elu`, `delu`, `aquelu`, `ê alune`, artigos neutros `e/es`);
- Lista de exceções (ex.: `pessoa`, `estudante`, `cliente`);
- Detecção de páginas biográficas (Wikipédia) e bloqueio automático quando infobox indica gênero (ex.: "Travesti", "Mulher", "Homem");
- Popup com painel de diagnóstico, logs e botão para aplicar sugestões automáticas de regras;
- Sistema de **sugestões automáticas**: analisa textos que não foram convertidos e propõe regras frequentes para revisão, que podem ser aplicadas manualmente pelo usuário;
- Toggle de ativação/desativação;
- Compatível com Manifest V3.

---

## Como usar (passos rápidos)

1. Baixe e extraia a pasta `neutralizador_ophelia_repo/src` (ou carregue todo o repositório).
2. No Chrome: vá para `chrome://extensions/`, ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `src/` do repositório.
4. Abra uma página (ex.: https://pt.wikipedia.org/wiki/Aluno), abra o popup da extensão e use o painel de diagnóstico. Use "Ver status" para ver logs.
5. Se desejar, revise as sugestões geradas no painel e aplique-as.

---

Se quiser que eu já crie o repositório no teu GitHub, posso gerar o ZIP pronto para upload e te mandar instruções passo‑a‑passo para publicar (tu mesmo/a faz o upload).