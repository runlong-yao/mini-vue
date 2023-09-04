import { ReactiveEffect } from "@mini-vue/reactivity";
import { queuePreFlushCb } from "./scheduler";

// Simple effect.
export function watchEffect(effect) {
  return doWatch(effect);
}

//watch本质是effect
function doWatch(source) {
  //source代表的是回调方法
  //job计划任务的回调
  //scheduler计划任务，延迟到下一个microTask执行json
  //在增加watch的时候，将自动产生effect对象

  //延迟执行的effect调用逻辑
  const job = () => {
    //延迟触发run
    effect.run();
  };

  //延迟计算队列
  const scheduler = () => queuePreFlushCb(job);

  let cleanup;
  //业务端设置cleanup逻辑
  const onCleanup = (fn) => {
    //顺带设置下Effect的Stop回调
    cleanup = effect.onStop = () => {
      fn();
    };
  };
  // 这里是在执行 effect.run 的时候就会调用的
  //包装一下source
  const getter = () => {
    // 业务逻辑有可能没有调用onCleanup，那就不需要做清除
    if (cleanup) {
      cleanup();
    }

    source(onCleanup);
  };

  const effect = new ReactiveEffect(getter, scheduler);

  // 这里执行的就是 getter
  effect.run();

  // 返回值为 StopHandle
  // 只需要调用 stop 即可
  return () => {
    effect.stop();
  };
}
