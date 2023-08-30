import { createVNode } from "./vnode";

export function createAppAPI(render) {
  //创建app对象，对象拥有一个钩子回调
  //rootComponent是一个组件对象
  return function createApp(rootComponent) {
    const app = {
      _component: rootComponent,
      //rootContainer是一个DOM节点
      mount(rootContainer) {
        console.log("基于根组件创建 vnode");
        const vnode = createVNode(rootComponent);
        console.log("调用 render，基于 vnode 进行开箱");
        render(vnode, rootContainer);
      },
    };

    return app;
  };
}
