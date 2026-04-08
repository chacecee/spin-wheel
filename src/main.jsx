import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

window.addEventListener("error", (event) => {
  console.error("Global window error:", event.error || event.message || event);

  const root = document.getElementById("root");
  if (root && !root.innerHTML.trim()) {
    root.innerHTML = `
      <div style="min-height:100vh;background:#0b1020;color:white;padding:24px;font-family:sans-serif;">
        <h1 style="margin-top:0;">Spin the Wheel startup error</h1>
        <p>${String(event.message || event.error?.message || "Unknown startup error")}</p>
        <pre style="white-space:pre-wrap;background:#111827;padding:12px;border-radius:6px;overflow:auto;">${String(event.error?.stack || "")}</pre>
      </div>
    `;
  }
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);

  const root = document.getElementById("root");
  if (root && !root.innerHTML.trim()) {
    root.innerHTML = `
      <div style="min-height:100vh;background:#0b1020;color:white;padding:24px;font-family:sans-serif;">
        <h1 style="margin-top:0;">Spin the Wheel promise error</h1>
        <p>${String(event.reason?.message || event.reason || "Unknown promise rejection")}</p>
        <pre style="white-space:pre-wrap;background:#111827;padding:12px;border-radius:6px;overflow:auto;">${String(event.reason?.stack || "")}</pre>
      </div>
    `;
  }
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Missing root element with id "root"');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);