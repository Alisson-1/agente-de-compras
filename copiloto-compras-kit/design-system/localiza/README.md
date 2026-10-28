Localiza é a marca de aluguel de carros e mobilidade da Localiza&Co. A identidade gira em torno de duas cores — o **verde profundo** (`tertiary-default`) e o **lima** (`secondary-default`) — de formas feitas de quadrados e quartos de círculo, e de uma linguagem "cotidiana, positiva e acolhedora". Os tokens vêm do LDS (Localiza Design System, variáveis `--lds-*` publicadas no localiza.com); a direção visual e verbal vem do rebranding de 2022.

## Conteúdo e voz

- **Fale com uma pessoa, em "você".** A marca se coloca como "a gente": *"Você escolhe o caminho, a gente faz acontecer."*
- **Coloquial e caloroso, sem gíria forçada.** Contrações do português falado são da marca: *"Pra você chegar lá"*, *"Uma Localiza toda pra você"*.
- **Positivo e concreto.** Fale do que a pessoa ganha: *"As melhores condições para você reservar e aproveitar"*, *"Retire seu carro sem filas"*.
- **Frases curtas, caixa de sentença.** Títulos começam com maiúscula e seguem em minúsculas. A caixa-alta fica só em sobretítulos de 12px (`heading-xxs`), como "CARRO POR ASSINATURA".
- **CTAs são verbos:** "Reservar agora", "Ver ofertas", "Confira todos os grupos".
- **Erros dizem o que fazer:** "Digite um CPF válido.", não "Campo inválido".
- Sem emoji em interface.

## Cor

- O verde é o protagonista. Use `tertiary-default` (#01602a) em header, footer, faixas de destaque e títulos de seção; sobre ele, texto branco (`neutral-text-default-inverse`) ou lima (`secondary-default`, 4,5:1).
- `secondary-default` (#78de1f) é energia e destaque: CTA de ênfase sobre o verde, indicadores ativos, o traço do símbolo, grandes campos de cor em peças de campanha. **Nunca como texto sobre branco** (1,6:1); texto sobre lima é sempre `secondary-contrast-auto` (#01602a).
- `primary-default` (#018444) é o verde de ação do produto: botão principal, seleção, links. Texto `primary-contrast-auto` sobre ele.
- Neutros: página `neutral-background-default`, superfícies `neutral-surface-default`, texto corrido `neutral-text-default`, títulos `neutral-text-high`, apoio `neutral-text-low`, linhas `neutral-border-low`.
- Status (`success`, `info`, `warning`, `critical`) só para feedback, sempre com ícone ou palavra. Fundo `*-emphasis-lower` + texto `*-emphasis-higher`.
- Atenção: o par do LDS `success-contrast-auto` sobre `success-default` mede 2,9:1 — para texto pequeno sobre verde de sucesso, use `success-emphasis-high` com branco.
- `web-text` e `web-green` documentam cores legadas do site; não use em trabalho novo.

## Tipografia

- **Inter** (`sans`) é a fonte de produto do LDS: títulos `heading-*`, texto `body-*`, rótulos `label`. Pesos: 400 texto, 500 rótulos, 600 subtítulos, 700 títulos.
- **Aleo** (`serif`) é a voz editorial: manchetes de campanha e heros (`display-*`), em peso regular, caixa de sentença, entrelinha justa. Uma manchete serifada por tela, no máximo.
- Escala base 16px; tamanhos em rem no código (`display-xl` 4rem … `body-xs` 0.75rem).
- O site legado ainda usa *LocalizaDinDisplay* (proprietária, não incluída); não use em trabalho novo.

## Espaçamento, raio e elevação

- Grade de 8px: `spacing-1` (8) a `spacing-15` (120). Padding de componente `spacing-2`; gap entre cards `spacing-3`; entre seções `spacing-12` no desktop e `spacing-8` no mobile.
- Raio padrão `radius-main` (12px) em botões, campos, cards, alertas e abas; `radius-soft` (16px) em diálogos e containers grandes; `radius-pill` em chips; `radius-sharp` (4px) em checkbox e tooltip.
- Prefira borda (`neutral-border-low`, `border-weak`) a sombra. `shadow-default` para cards elevados e item ativo; `shadow-high` para menus e diálogos.
- Alturas de controle: campos `input-sm/md/lg` (32/40/52), botões e botões de ícone `icon-button-sm/md/lg` (40/48/56).

## Estados

- Hover e pressionado são camadas por cima do preenchimento: `state-hovered` (preto 15%) e `state-pressed` (preto 25%); sobre o verde profundo, `state-hovered-inverse`.
- Foco: contorno sólido de 2px `state-focused`, afastado 2px; sobre o verde profundo use `state-focused-inverse`.
- Desabilitado: `state-disabled` com texto `state-disabled-contrast`.

## Formas e grafismo

- O universo gráfico é feito de **quadrados e quartos de círculo** — os mesmos cantos do símbolo (o "L" arredondado com o traço lima). Combine blocos retos e arcos em verde profundo e lima para compor fundos, molduras de foto e separadores.
- **Linhas de rota**: traços finos lima/branco que cruzam fotos em curvas suaves, sugerindo caminhos.
- **Balões de texto**: caixas brancas de cantos bem arredondados com texto verde sobre fundo lima, para frases de impacto.
- Sem gradientes, sem sombras decorativas.

## Imagem

- Pessoas reais, diversas, sorrindo, em momentos cotidianos (família no carro, abraço, viagem). Luz natural, calor.
- Recortes de foto podem ser emoldurados pelas formas de quarto de círculo.
- Frota sempre limpa, com a marca aplicada em verde e lima.

## Logo

- `assets/Logos/localiza-logo-negative.svg` é a versão negativa (letras brancas, traço lima) — use sobre `tertiary-default` ou foto escura, nunca sobre branco.
- Respeite a área de proteção (no mínimo a altura do "L" em volta) e não recolora, distorça ou aplique efeitos.

## Iconografia

- Ícones de linha arredondada, traço 2px, cantos e terminações arredondados, em três combinações: verde profundo sobre branco, verde profundo sobre lima e lima sobre verde profundo.
- `assets/Icons/` traz os ícones reais do site (local, calendário, relógio, carro, contato). Os de traço vêm em `#01602A`; os sólidos em `#78DE1F`. Como `<img>` não herda cor, escolha a variante pela cor indicada no README do grupo.
- Para ícones que faltarem, use um set de linha arredondada de 2px (estilo Feather/Lucide) — o site já usa Feather em pontos da interface.

## Componentes

`Button`, `IconButton`, `TextField`, `Checkbox`, `Chip`, `Alert`, `Tabs`, `Card`, `Tooltip` e `Accordion` estão em `window.Localiza`. Cada um tem guia em `components/<Nome>/README.md`.
