/**
 * Citações do Manual de Compras (RAG): "§2.2" no texto vira botão que abre o
 * trecho num popover. Também mostra as buscas do turno com os scores.
 */
import { BookOpen, X } from "lucide-react";
import { createContext, Fragment, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChunkRag } from "@copiloto/shared";
import type { SecaoManual } from "../api";

export const ManualContext = createContext<SecaoManual[]>([]);
/** Abre um pedido na Tela de Compras (links "PED-2026-0412" nas respostas). */
export const AbrirPedidoContext = createContext<(pedidoId: string) => void>(() => {});

function LinkPedido({ numero }: { numero: string }) {
  const abrir = useContext(AbrirPedidoContext);
  return (
    <button type="button" className="link-pedido" onClick={() => abrir(numero)} title={`Abrir ${numero}`}>
      {numero}
    </button>
  );
}

export function Citacao({ secao }: { secao: string }) {
  const manual = useContext(ManualContext);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const numero = secao.replace("§", "");
  const trecho = manual.find((s) => s.section === numero);

  // Popover em position: fixed, preso à viewport — não estoura o container do chat.
  useLayoutEffect(() => {
    if (!aberto) {
      setPos(null);
      return;
    }
    const posicionar = () => {
      const botao = botaoRef.current?.getBoundingClientRect();
      const pop = popoverRef.current;
      if (!botao || !pop) return;
      const margem = 8;
      const { width, height } = pop.getBoundingClientRect();
      const left = Math.min(Math.max(botao.left, margem), window.innerWidth - width - margem);
      const abaixo = botao.bottom + 6;
      const top = abaixo + height > window.innerHeight - margem ? Math.max(botao.top - 6 - height, margem) : abaixo;
      setPos({ top, left });
    };
    posicionar();
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", fechar);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", fechar);
    };
  }, [aberto]);

  return (
    <span className="citacao" ref={ref}>
      <button ref={botaoRef} type="button" className="citacao__botao" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <BookOpen size={14} aria-hidden="true" />§{numero}
      </button>
      {aberto ? (
        <span
          ref={popoverRef}
          className="popover"
          role="dialog"
          aria-label={`Manual de Compras §${numero}`}
          style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
        >
          <span className="popover__topo">
            <span className="popover__titulo">
              Manual de Compras §{numero}
              {trecho ? ` · ${trecho.title}` : ""}
            </span>
            <button type="button" className="popover__fechar" aria-label="Fechar" onClick={() => setAberto(false)}>
              <X size={16} aria-hidden="true" />
            </button>
          </span>
          <span className="popover__texto">{trecho ? trecho.text : "Trecho não encontrado no manual."}</span>
          {trecho ? <span className="popover__fonte">Fonte: {trecho.source}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

/** Renderiza texto trocando "§2.2" por citações e "PED-2026-0412" por links clicáveis. */
export function TextoComCitacoes({ texto }: { texto: string }) {
  const partes = texto.split(/(§\d+\.\d+|PED-\d{4}-\d{4})/g);
  return (
    <>
      {partes.map((p, i) =>
        /^§\d+\.\d+$/.test(p) ? (
          <Citacao key={i} secao={p} />
        ) : /^PED-\d{4}-\d{4}$/.test(p) ? (
          <LinkPedido key={i} numero={p} />
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function BuscaRag({ query, chunks }: { query: string; chunks: ChunkRag[] }) {
  return (
    <div className="busca-rag">
      <p className="busca-rag__query">Busca: “{query}”</p>
      <ul>
        {chunks.map((c) => (
          <li key={c.section}>
            <Citacao secao={`§${c.section}`} />
            <span className="busca-rag__score" title="Similaridade">
              score {c.score.toFixed(2)}
            </span>
            <span className="busca-rag__texto">{c.text.slice(0, 110)}…</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
