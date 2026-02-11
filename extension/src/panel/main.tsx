import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/components/App";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("wit-panel-root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
