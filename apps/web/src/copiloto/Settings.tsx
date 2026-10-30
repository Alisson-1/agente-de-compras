/** Configurações (engrenagem): provedor, modelo, chave (BYOK), modo simulado, proativo, velocidade. */
import type { Provedor } from "@copiloto/shared";
import { Alert, Button, Checkbox, TextField } from "../design-system/localiza/components";
import { MODELOS_SUGERIDOS, type Configuracoes } from "../hooks/useSettings";

type Props = { config: Configuracoes; atualizar: (c: Partial<Configuracoes>) => void; fechar: () => void };

const PROVEDORES: { id: Provedor; nome: string }[] = [
  { id: "anthropic", nome: "Anthropic" },
  { id: "openai", nome: "OpenAI" },
  { id: "gemini", nome: "Gemini" },
  { id: "chatgpt", nome: "ChatGPT (LLM Gate)" },
];

export function Settings({ config, atualizar, fechar }: Props) {
  return (
    <section className="config" aria-label="Configurações do Cláudio">
      <h3 className="lz-text-heading-sm config__titulo">Configurações</h3>

      <Checkbox
        label="Modo simulado (sem chave e sem internet)"
        checked={config.simulado}
        onChange={(e) => atualizar({ simulado: e.target.checked })}
      />
      <Checkbox
        label="Agente proativo (reage a eventos da tela)"
        checked={config.proativo}
        onChange={(e) => atualizar({ proativo: e.target.checked })}
      />

      <label className="lz-field">
        <span className="lz-field__label">Velocidade da demo: {(config.velocidadeMs / 1000).toLocaleString("pt-BR")} s entre eventos</span>
        <input
          type="range"
          min={0}
          max={3000}
          step={100}
          value={config.velocidadeMs}
          onChange={(e) => atualizar({ velocidadeMs: Number(e.target.value) })}
          className="range"
        />
      </label>

      <fieldset className="config__llm" disabled={config.simulado}>
        <legend className="lz-field__label">LLM real</legend>
        <label className="lz-field">
          <span className="lz-field__label">Provedor</span>
          <select
            className="select"
            value={config.provedor}
            onChange={(e) => {
              const provedor = e.target.value as Provedor;
              atualizar({ provedor, modelo: MODELOS_SUGERIDOS[provedor][0] });
            }}
          >
            {PROVEDORES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <TextField
          size="md"
          label="Modelo"
          list="modelos-sugeridos"
          value={config.modelo}
          onChange={(e) => atualizar({ modelo: e.target.value })}
        />
        <datalist id="modelos-sugeridos">
          {MODELOS_SUGERIDOS[config.provedor].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {config.provedor === "chatgpt" ? (
          <Alert tone="info">
            A chave fica na API (LLM_GATE_API_KEY), no LLM Gate. O navegador não envia chave neste provedor.
          </Alert>
        ) : (
          <TextField
            size="md"
            type="password"
            label="Chave do provedor"
            helper="Fica só neste navegador e vai no header de cada requisição. A API não grava."
            autoComplete="off"
            value={config.chave}
            onChange={(e) => atualizar({ chave: e.target.value })}
          />
        )}
      </fieldset>
      {!config.simulado && config.provedor !== "chatgpt" && !config.chave ? (
        <Alert tone="warning">Informe a chave para usar o LLM real.</Alert>
      ) : null}
      <Button variant="outline" size="sm" onClick={fechar}>
        Fechar configurações
      </Button>
    </section>
  );
}
