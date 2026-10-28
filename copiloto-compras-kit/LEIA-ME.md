# Kit: Copiloto de Compras de Peças

Tudo o que o Cursor precisa para gerar o projeto já com o design system da Localiza.

## Conteúdo

```
copiloto-compras-kit/
  prompt-comprador-de-pecas-agentico.md   o prompt para colar no chat do Cursor
  .cursor/rules/localiza-design-system.mdc regra que o Cursor aplica sozinho na pasta apps/web
  design-system/localiza/
    README.md          guia da marca: cor, tipografia, voz, formas, estados
    tokens.json        tokens originais
    tokens.css         as mesmas variáveis em CSS (--primary-default, --spacing-2, ...)
    components.css     estilos dos 10 componentes
    components.tsx     Button, IconButton, TextField, Checkbox, Chip, Alert, Tabs, Card, Tooltip, Accordion
    components/*.md    guia de uso de cada componente
```

## Como usar no Cursor

1. Copie a pasta `copiloto-compras-kit` para onde o projeto vai morar (ex.: `Desktop\copiloto-compras`) e abra essa pasta no Cursor (**File → Open Folder**).
2. Confira em **Cursor Settings → Rules** que a regra `localiza-design-system` aparece na lista de regras do projeto.
3. Abra o chat em modo **Agent**, cole o conteúdo de `prompt-comprador-de-pecas-agentico.md` e envie.
4. Na primeira etapa, o agente copia `design-system/localiza/` para `apps/web/src/design-system/localiza/` e importa os CSS no `main.tsx`.

## Usar o design system em outro projeto

Copie `design-system/localiza/` e `.cursor/rules/localiza-design-system.mdc` para o outro projeto e ajuste os caminhos da regra (`globs` e a pasta de destino).

## Observações

- Os ícones SVG e o logo do design system não puderam ser exportados. A regra orienta usar ícones Lucide no mesmo estilo.
- A fonte Inter (e a Aleo) carrega do Google Fonts, pelo `@import` no topo de `components.css`. Sem internet, cai para Arial.
