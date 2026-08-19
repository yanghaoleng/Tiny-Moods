import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/nunito";
import "@fontsource-variable/cormorant-garamond";
import App from "./App";
import {installRandomFavicon} from "./favicon";
import "./styles.css";

installRandomFavicon();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
