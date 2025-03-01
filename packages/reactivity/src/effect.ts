import { createDep } from "./dep";
import { extend } from "@mini-vue/shared";

//调用run方法的时候切换activeEffect
//当前激活的ReactiveEffect
let activeEffect = void 0;
let shouldTrack = false;

//调用路径：createGetter->track->targetMap
//结构: WeakMap<T,D>
//T 是target
//D 是depsMap;D = new Map<E,V>()
//E 是属性键值
//V 是Set; V = new Set<F>
//F 是ReactiveEffect
//记录某个对象的键值，被哪些Effect依赖
//目的是为了方便查询：响应键值被哪些Effect依赖
//可以用于触发更新,比如：const User = {age:1};User.age=2修改时 -> 触发依赖于User.age这个路径的Effect更新
//reactive的被依赖存储在targetMap中
//ref的被依赖存储在ReplImp的dep
const targetMap = new WeakMap();

// ReactiveEffect管理回调触发
//
export class ReactiveEffect {
  active = true;
  //Array<Set<ReactiveEffect>>
  //记录的是所有track的deps
  //用于清除deps对effect的依赖
  //因为reactiveEffect是可以在运行时被销毁的
  deps = [];
  public onStop?: () => void;

  //scheduler的核心代码一般是() => effect.run()
  constructor(public fn, public scheduler?) {
    console.log("创建 ReactiveEffect 对象");
  }

  run() {
    console.log("run");
    // 运行 run 的时候，可以控制 要不要执行后续收集依赖的一步
    // 目前来看的话，只要执行了 fn 那么就默认执行了收集依赖
    // 这里就需要控制了

    // 是不是收集依赖的变量

    // 执行 fn  但是不收集依赖
    if (!this.active) {
      return this.fn();
    }

    // 执行 fn  收集依赖
    // 可以开始收集依赖了
    shouldTrack = true;

    // 执行的时候给全局的 activeEffect 赋值
    // 利用全局属性来获取当前的 effect
    activeEffect = this as any;
    // 执行用户传入的 fn
    console.log("执行用户传入的 fn");
    const result = this.fn();
    // 重置
    shouldTrack = false;
    activeEffect = undefined;

    return result;
  }

  stop() {
    if (this.active) {
      // 如果第一次执行 stop 后 active 就 false 了
      // 这是为了防止重复的调用，执行 stop 逻辑
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}

//DEP
//EFFECT

function cleanupEffect(effect) {
  // 找到所有依赖这个 effect 的响应式对象
  // 从这些响应式对象里面把 effect 给删除掉
  effect.deps.forEach((dep) => {
    dep.delete(effect);
  });

  effect.deps.length = 0;
}

export function effect(fn, options = {}) {
  const _effect = new ReactiveEffect(fn);

  // 把用户传过来的值合并到 _effect 对象上去
  // 缺点就是不是显式的，看代码的时候并不知道有什么值
  extend(_effect, options);
  _effect.run();

  // 把 _effect.run 这个方法返回
  // 让用户可以自行选择调用的时机（调用 fn）
  const runner: any = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner;
}

export function stop(runner) {
  runner.effect.stop();
}

//疑问：为啥传个type进来，type没啥用
export function track(target, type, key) {
  if (!isTracking()) {
    return;
  }
  //targetMap的结构是 Map<目标对象,Map<键值,Set<Dep>>>
  //按照对象的键值进行存储
  console.log(`触发 track -> target: ${target} type:${type} key:${key}`);

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    // 初始化 depsMap 的逻辑
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  let dep = depsMap.get(key);

  if (!dep) {
    //Set
    dep = createDep();

    depsMap.set(key, dep);
  }

  trackEffects(dep);
}

//设置targetMap
//ReactiveEffect记录的依赖集
//dep类型：Set<ReactiveEffect>
export function trackEffects(dep) {
  // 用 dep 来存放所有的 effect

  // TODO
  // 这里是一个优化点
  // 先看看这个依赖是不是已经收集了，
  // 已经收集的话，那么就不需要在收集一次了
  // 可能会影响 code path change 的情况
  // 需要每次都 cleanupEffect
  // shouldTrack = !dep.has(activeEffect!);
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    //effect是ReactiveEffect
    //effect.dep 是Array
    //effect.dep[0]是Set
    (activeEffect as any).deps.push(dep);
  }
}

export function trigger(target, type, key) {
  // 1. 先收集所有的 dep 放到 deps 里面，
  // 后面会统一处理
  let deps: Array<any> = [];
  // dep

  const depsMap = targetMap.get(target);

  if (!depsMap) return;

  // 暂时只实现了 GET 类型
  // get 类型只需要取出来就可以
  //这是Set类型
  const dep = depsMap.get(key);

  // 最后收集到 deps 内
  deps.push(dep);

  //所有dep中元素的数组版本，你可以理解为它就是dep
  const effects: Array<any> = [];
  deps.forEach((dep) => {
    // 这里解构 dep 得到的是 dep 内部存储的 effect
    effects.push(...dep);
  });
  // 这里的目的是只有一个 dep ，这个dep 里面包含所有的 effect
  // 这里的目前应该是为了 triggerEffects 这个函数的复用
  triggerEffects(createDep(effects));
}

export function isTracking() {
  return shouldTrack && activeEffect !== undefined;
}

//触发effect(scheduler和run)
//dep是Set类型
//triggerEffects实质是执行run或者scheduler
export function triggerEffects(dep) {
  // 执行收集到的所有的 effect 的 run 方法
  for (const effect of dep) {
    if (effect.scheduler) {
      // scheduler 可以让用户自己选择调用的时机
      // 这样就可以灵活的控制调用了
      // 在 runtime-core 中，就是使用了 scheduler 实现了在 next ticker 中调用的逻辑
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}
