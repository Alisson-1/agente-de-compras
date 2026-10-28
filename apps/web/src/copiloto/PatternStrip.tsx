/**
 * Faixa dos 9 padrões, sempre visível. Estados de cada chip:
 * cinza (não usado) · aceso e pulsando (em uso agora) · verde com ✓ (já usado)
 * · "aguardando você" (só HITL, com proposta ou escolha pendente).
 */
import { Check, Hand } from "lucide-react";
import type { PatternId } from "@copiloto/shared";
import { PADROES } from "@copiloto/shared";
import { Chip } from "../design-system/localiza/components";
import type { EstatisticasPadroes } from "../hooks/useAgentStream";

type Props = { stats: EstatisticasPadroes; aguardandoVoce: boolean };

export function PatternStrip({ stats, aguardandoVoce }: Props) {
  const ativos = new Set<PatternId>(stats.ativos.map((a) => a.pattern));
  return (
    <ul className="faixa" aria-label="Padrões de design agêntico">
      {PADROES.map((p) => {
        const usos = stats.usos[p.id] ?? 0;
        const estado =
          p.id === "hitl" && aguardandoVoce && !ativos.has(p.id)
            ? "aguardando"
            : ativos.has(p.id)
              ? "em-uso"
              : usos > 0
                ? "usado"
                : "nao-usado";
        const rotuloEstado = {
          aguardando: "aguardando você",
          "em-uso": "em uso agora",
          usado: "já usado",
          "nao-usado": "ainda não usado",
        }[estado];
        return (
          <li key={p.id}>
            <Chip
              selected={estado === "usado"}
              className={`chip-padrao chip-padrao--${estado}`}
              title={`${p.descricao} (${rotuloEstado}; ${usos} uso${usos === 1 ? "" : "s"})`}
            >
              {estado === "usado" ? <Check size={14} aria-hidden="true" /> : null}
              {estado === "aguardando" ? <Hand size={14} aria-hidden="true" /> : null}
              {p.nome}
              <span className="chip-padrao__contador" aria-label={`${usos} usos`}>
                {usos}
              </span>
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}
