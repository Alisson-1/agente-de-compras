# TextField

Campo de texto com rótulo acima, ícone opcional e mensagem de ajuda ou erro — a base do formulário de reserva ("Onde você quer retirar o carro?", Data, Hora).

**O consumidor fornece:** `label`, `value`/`onChange` (ou `defaultValue`), `placeholder`; opcionais `icon` (URL de asset: `location.svg`, `calendar.svg`, `time.svg`), `helper`, `error`, `optional`, `size` (`sm` 32 · `md` 40 · `lg` 52, padrão).

- Caixa branca, borda 1px `neutral-border-default`, raio `radius-main`; hover `neutral-border-high`; foco 2px `state-focused`.
- Rótulo Inter 500 16px `neutral-text-high`; placeholder e helper `neutral-text-low`.
- Erro: borda `critical-default` e mensagem `critical-contrast-default` que diz como corrigir ("Digite um CPF válido."), nunca só "Erro".
- O placeholder não substitui o rótulo.
