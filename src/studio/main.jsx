import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import StudioApp from "./StudioApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StudioApp />
  </React.StrictMode>
);
