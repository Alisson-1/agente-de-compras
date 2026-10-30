/**
 * Foto de perfil do Cláudio no topo do chat. Basta salvar a imagem em
 * apps/web/public/claudio.png; sem ela, mostra o ícone do robô.
 */
import { Bot } from "lucide-react";
import { useState } from "react";

export function AvatarClaudio() {
  const [semFoto, setSemFoto] = useState(false);
  return (
    <span className="avatar-claudio">
      {semFoto ? (
        <Bot size={26} aria-hidden="true" />
      ) : (
        <img src="/claudio.png" alt="" onError={() => setSemFoto(true)} />
      )}
    </span>
  );
}
