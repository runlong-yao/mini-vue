import { createApp } from "../../dist/mini-vue.esm-bundler.js";
import App from "./App.js";

const rootContainer = document.querySelector("#root");
createApp(App).mount(rootContainer);

//createApp main.js
//createApp runtime-dom.ts
//ensureRenderer runtime-dom.ts
//createRenderer renderer.ts ()
//createApp createApp.ts  (工厂方法，用于生产createApp方法，createApp用于记录组件和渲染节点)

