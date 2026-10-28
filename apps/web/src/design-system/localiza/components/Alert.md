# Alert

Mensagem de status em linha, com ícone, título opcional e uma frase.

**O consumidor fornece:** `tone` (`info` | `success` | `warning` | `critical`), `title` opcional e o texto em `children`.

Fundo `<tone>-emphasis-lower`, texto `<tone>-emphasis-higher` (≥ 8,8:1 em todos), raio `radius-main`, padding `spacing-2`. O ícone circular usa `<tone>-default` + `<tone>-contrast-auto`; em `success` usa `success-emphasis-high` com branco porque o par do LDS (`success-contrast-auto` sobre `success-default`) fica em 2,9:1. Status nunca é comunicado só pela cor: sempre ícone + texto. Tom acolhedor e direto, dizendo o que fazer.
