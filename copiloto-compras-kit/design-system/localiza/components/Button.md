# Button

Ação principal ou secundária de uma tela; o rótulo é um verbo curto no infinitivo ou imperativo ("Reservar agora", "Ver ofertas").

**O consumidor fornece:** `children` (rótulo), `onClick` ou `href`, e opcionalmente `variant`, `size` (`sm` 40px · `md` 48px · `lg` 56px), `icon` (URL de um asset) e `block`.

- `primary` — fundo `primary-default`, texto `primary-contrast-auto`. Uma por bloco.
- `secondary` — o lima `secondary-default` com texto `secondary-contrast-auto`; CTA de ênfase, sobretudo sobre o verde profundo (busca de reserva, banners).
- `outline` — contorno e texto `tertiary-default`; é o "Confira todos os grupos" do site.
- `ghost` — só texto `tertiary-default`, para ações terciárias.
- `inverse` — contorno branco sobre `tertiary-default`.

Raio `radius-main` (12px), rótulo Inter 500 16px. Hover/pressionado aplicam `state-hovered` / `state-pressed` por cima do preenchimento; foco é contorno de 2px `state-focused` afastado 2px. Desabilitado usa `state-disabled` + `state-disabled-contrast`.

**Não:** lima como texto sobre branco; dois `primary` lado a lado; rótulos em caixa-alta no padrão novo (a caixa-alta é legado do site).
