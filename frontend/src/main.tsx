import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./lib/i18n.tsx";
import "./index.css";

// Initialize theme from localStorage before React renders to prevent flash
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

// Initialize lang attribute
const savedLang = localStorage.getItem("rezsi-lang");
if (savedLang) document.documentElement.lang = savedLang;

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
