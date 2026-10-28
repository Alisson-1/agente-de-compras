/** Chips de sugestão que mudam conforme o contexto da tela e da conversa. */
import type { PedidoDeCompra } from "@copiloto/shared";
import { Chip } from "../design-system/localiza/components";

type Props = {
  pedido: PedidoDeCompra | null;
  temRecomendacao: boolean;
  ofereceuReavaliar: boolean;
  desabilitado: boolean;
  aoEscolher: (texto: string) => void;
};

export function sugestoes({ pedido, temRecomendacao, ofereceuReavaliar }: Omit<Props, "aoEscolher" | "desabilitado">): string[] {
  if (!pedido) return ["Qual pedido devo priorizar?", "O que diz o manual sobre peça paralela?", "Qual é a alçada do comprador?"];
  if (["comprado", "aguardando aprovação do gestor"].includes(pedido.status)) {
    return ["Resuma este pedido", "Qual pedido devo priorizar?", "O que diz o manual sobre alçada e gestor?"];
  }
  const lista = [
    "Resuma este pedido",
    "Qual cotação você recomenda?",
    "Por que não a mais barata?",
    "O que diz o manual sobre peça paralela?",
    "Emita a compra",
  ];
  if (ofereceuReavaliar) lista.unshift("Reavaliar a recomendação");
  if (!temRecomendacao) return lista.filter((s) => s !== "Por que não a mais barata?").concat("Por que não a mais barata?");
  return lista;
}

export function SuggestionChips(p: Props) {
  return (
    <div className="sugestoes" role="group" aria-label="Sugestões de pergunta">
      {sugestoes(p).map((s) => (
        <Chip key={s} disabled={p.desabilitado} onClick={() => p.aoEscolher(s)}>
          {s}
        </Chip>
      ))}
    </div>
  );
}
