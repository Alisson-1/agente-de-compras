import type { StatusPedido, Urgencia } from "@copiloto/shared";

export { formatarBRL, totalCotacao } from "@copiloto/shared";

export const um = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const ROTULO_URGENCIA: Record<Urgencia, string> = {
  urgente: "Urgente: carro parado",
  normal: "Normal",
  rotina: "Rotina",
};

/** Tom visual do status (sempre acompanhado da palavra). */
export function tomDoStatus(status: StatusPedido): "info" | "success" | "warning" | "critical" | "neutro" {
  switch (status) {
    case "comprado":
      return "success";
    case "aguardando aprovação do gestor":
      return "warning";
    case "cancelado":
      return "critical";
    case "em cotação":
      return "info";
    default:
      return "neutro";
  }
}
