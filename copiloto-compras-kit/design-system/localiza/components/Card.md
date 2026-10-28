# Card

Superfície ("paper" do LDS) que agrupa um conteúdo: produto, grupo de carro, destino, oferta.

**O consumidor fornece:** `title`, `children` (use `className="lz-card__text"` em parágrafos), opcionais `eyebrow`, `media` + `mediaAlt` (foto), `variant` (`outlined` padrão · `elevated` · `brand`).

- `outlined`: branco, borda 1px `neutral-border-low`, raio `radius-main`, padding `spacing-2`.
- `elevated`: sem borda, `shadow-default`.
- `brand`: fundo `tertiary-default`, título branco e sobretítulo lima — para destaques de produto Localiza.
- Sobretítulo: 12px/600, caixa-alta, letterSpacing 1px, `tertiary-default` (como "CARRO POR ASSINATURA" no site).
- Fotos: pessoas reais, sorrindo, em momentos cotidianos (ver Imagem no brand book).
