/**
 * Largura do painel do chat, ajustada arrastando o divisor. Guardada no localStorage;
 * null = largura padrão do CSS (40%). Duplo clique no divisor volta ao padrão.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const CHAVE_STORAGE = "copiloto-compras:largura-chat";
const MINIMO = 360;
/** Espaço mínimo que sobra para a Tela de Compras. */
const MINIMO_TELA = 480;
const PASSO_TECLADO = 24;

function limitar(largura: number) {
  return Math.round(Math.min(Math.max(largura, MINIMO), Math.max(window.innerWidth - MINIMO_TELA, MINIMO)));
}

function ler(): number | null {
  try {
    const salvo = Number(localStorage.getItem(CHAVE_STORAGE));
    return salvo > 0 ? limitar(salvo) : null;
  } catch {
    return null;
  }
}

export function useLarguraChat() {
  const [largura, setLargura] = useState<number | null>(ler);
  const painelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      if (largura === null) localStorage.removeItem(CHAVE_STORAGE);
      else localStorage.setItem(CHAVE_STORAGE, String(largura));
    } catch {
      // sem localStorage (aba privada): segue só em memória
    }
  }, [largura]);

  // Janela encolheu: o chat não pode engolir a Tela de Compras.
  useEffect(() => {
    const aoRedimensionar = () => setLargura((l) => (l === null ? l : limitar(l)));
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  const larguraAtual = () => largura ?? painelRef.current?.getBoundingClientRect().width ?? MINIMO;

  const divisorProps = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      const painel = painelRef.current;
      if (!painel || e.button !== 0) return;
      e.preventDefault();
      const direita = painel.getBoundingClientRect().right;
      const alvo = e.currentTarget;
      alvo.setPointerCapture(e.pointerId);
      document.body.classList.add("redimensionando");
      const mover = (ev: globalThis.PointerEvent) => setLargura(limitar(direita - ev.clientX));
      const soltar = () => {
        alvo.removeEventListener("pointermove", mover);
        alvo.removeEventListener("pointerup", soltar);
        alvo.removeEventListener("pointercancel", soltar);
        document.body.classList.remove("redimensionando");
      };
      alvo.addEventListener("pointermove", mover);
      alvo.addEventListener("pointerup", soltar);
      alvo.addEventListener("pointercancel", soltar);
    },
    onDoubleClick: () => setLargura(null),
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const delta = e.key === "ArrowLeft" ? PASSO_TECLADO : e.key === "ArrowRight" ? -PASSO_TECLADO : 0;
      if (!delta) return;
      e.preventDefault();
      setLargura(limitar(larguraAtual() + delta));
    },
  };

  return { largura, painelRef, divisorProps, minimo: MINIMO };
}
