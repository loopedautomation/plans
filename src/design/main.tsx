/**
 * The design gallery's entry point.
 *
 * Built by `vite build --mode design` into `site/design`. It is the app's own
 * stylesheet and components with nothing behind them: no repository, no
 * session, no file on disk. Every element on the page is the element the
 * app draws, so the gallery cannot describe a button the app no longer has.
 * See plans/distill-this-design.md.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { Gallery } from "./Gallery";
import { applySettings, loadSettings } from "../settings";
import "../App.css";
import "./gallery.css";

// The gallery's origin has no settings file; these are the app's defaults —
// its paper, its reading face, its measure — which is what a gallery should show.
applySettings(loadSettings());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Gallery />
  </React.StrictMode>,
);
