// src/index.js

// 1) Import Bootstrap’s compiled CSS (so React-Bootstrap components show up correctly)
import "bootstrap/dist/css/bootstrap.min.css";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 2) Your own custom CSS file (only valid CSS inside that file)
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);