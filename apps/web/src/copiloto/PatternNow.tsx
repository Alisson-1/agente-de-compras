/** Cartão "Padrão em uso agora": nome do padrão e a frase `why` para a plateia. */
import { Activity } from "lucide-react";
import { PADROES } from "@copiloto/shared";
import type { EstatisticasPadroes } from "../hooks/useAgentStream";

export function PatternNow({ stats, ocupado }: { stats: EstatisticasPadroes; ocupado: boolean }) {
  const atual = stats.ativos.at(-1) ?? (ocupado ? stats.ultimo : null);
  const padrao = atual ? PADROES.find((p) => p.id === atual.pattern) : null;
  return (
    <div className={`agora ${atual ? "agora--ativo" : ""}`} aria-live="polite">
      <Activity size={20} aria-hidden="true" className="agora__icone" />
      {atual && padrao ? (
        <div>
          <p className="agora__rotulo">
            Padrão em uso agora · <strong>{padrao.nome}</strong> <span className="agora__no">nó {atual.node}</span>
          </p>
          <p className="agora__why">{atual.why}</p>
        </div>
      ) : (
        <div>
          <p className="agora__rotulo">Padrão em uso agora</p>
          <p className="agora__why agora__why--ocioso">Nenhum. Faça uma pergunta ou use uma sugestão.</p>
        </div>
      )}
    </div>
  );
}
