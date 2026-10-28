import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design-system/localiza/tokens.css";
import "./design-system/localiza/components.css";
import "./app.css";
import { App } from "./pages/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
