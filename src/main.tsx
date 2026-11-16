import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
// Self-hosted Inter (Latin subset): regular, medium and semibold are the only weights the UI uses.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "./index.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("[Resource Vision] Application root element not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
