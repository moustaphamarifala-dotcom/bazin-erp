import "./storage.js";
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import BazinApp from "./BazinApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BazinApp />
  </React.StrictMode>
);
