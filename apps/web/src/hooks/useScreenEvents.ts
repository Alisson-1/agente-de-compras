/**
 * Eventos da tela para o agente proativo. Para não fazer ruído, cada tipo de
 * evento gera no máximo uma reação por pedido. Com o "Agente proativo"
 * desligado, nada é enviado.
 */
import { useCallback, useRef } from "react";
import type { EventoTela } from "@copiloto/shared";

export function useScreenEvents(proativo: boolean, enviar: (e: { evento: EventoTela }) => void) {
  const disparados = useRef(new Set<string>());

  const disparar = useCallback(
    (evento: EventoTela) => {
      if (!proativo) return;
      const chave = `${evento.tipo}:${evento.pedidoId}`;
      if (disparados.current.has(chave)) return;
      disparados.current.add(chave);
      enviar({ evento });
    },
    [proativo, enviar],
  );

  const reiniciar = useCallback(() => disparados.current.clear(), []);

  return { disparar, reiniciar };
}
