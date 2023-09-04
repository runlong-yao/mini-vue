import { createDep } from "./dep";
import { ReactiveEffect } from "./effect";
import { trackRefValue, triggerRefValue } from "./ref";

//有哪些api会产生effect:apiWatch,computed
//有哪些api记录effect:computed,ref,trigger
//effect在有入参为回调方法的时候会被创建，目的是在依赖的值被改变时，能够触发执行方法
//effect可以理解为响应对象的桥梁，响应值会有一个dep量，存储依赖的effect(effect可以理解为回调函数)
//effect也会记录值对应的dep量，用于effect释放的清理
//ComputedRefImpl因为涉及到计算方法，所以需要申请effect
//trigger,triggerEffects,triggerRefVal，triggerRefVal给到拥有.value的响应值进行处罚,trigger给到reactive的值
export class ComputedRefImpl {
  //存入Set<Effect>
  public dep: any;
  //ComputedRef对应的effect
  public effect: ReactiveEffect;

  private _dirty: boolean;
  private _value;

  constructor(getter) {
    this._dirty = true;
    this.dep = createDep();
    //队列作用是执行run或者schedule,在这儿明显是scheduler
    this.effect = new ReactiveEffect(getter, () => {
      // scheduler
      // 只要触发了这个函数说明响应式对象的值发生改变了
      // 那么就解锁，后续在调用 get 的时候就会重新执行，所以会得到最新的值
      if (this._dirty) return;

      this._dirty = true;
      triggerRefValue(this);
    });
  }

  get value() {
    //记录依赖的effect
    trackRefValue(this);
    // 锁上，只可以调用一次
    // 当数据改变的时候才会解锁
    // 这里就是缓存实现的核心
    // 解锁是在 scheduler 里面做的
    if (this._dirty) {
      this._dirty = false;
      // 这里执行 run 的话，就是执行用户传入的 fn

      this._value = this.effect.run();
    }

    return this._value;
  }
}

export function computed(getter) {
  return new ComputedRefImpl(getter);
}
