# IconButton

Botão só com ícone — navegação de carrossel, fechar, favoritar; sempre com `label` (vira `aria-label` e `title`).

**O consumidor fornece:** `label`, o ícone como `children` (SVG com `stroke="currentColor"`), `onClick`; opcionais `variant` (`outlined` | `filled`), `size` (`sm` 40 · `md` 48 · `lg` 56 — tokens `icon-button-*`) e `shape` (`circle` | `square`).

- `outlined` reproduz o botão de carrossel do site: fundo branco, borda 1px `secondary-default`, ícone `tertiary-default`.
- `filled`: fundo `tertiary-default` com ícone lima — o mesmo par do ícone de app no brand book.
- A borda lima é decorativa; o contraste do controle vem do ícone `tertiary-default` (7,8:1).
