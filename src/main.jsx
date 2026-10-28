import "./bootstrap.js";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/gutterbones.css";

const rootEl = document.getElementById("root-gutterbones");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
