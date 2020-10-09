---
title: 浅析immer
date: 2020-09-16 01:00:10
categories: 工作笔记
tags: [immer]
---
immer是对js对象immutable的一种解决方案, 从rtk接触到的. 因为api非常简单, 所以来看一下是如何实现的.

因为对object内存分配, immutablejs都没深入看, 所以无从比较.

<!--more-->

## 背景和目标

首先immer是一个看起来很帅的lib, 先硬解释一下为什么要使用他:

+ immutable的必要性是增加程序的可控性, 避免出现debug难度高的bug.
+ 从api的设计和性能来说, 都比较优秀.

api的设计来说: 比较容易继承到别的lib里(指redux, [狗头]), 并且非常优雅, 进行一些封装(指rtk)后可以无感使用.

从性能来说: 在对象层次比较深的时候, 是比深拷贝和`JSON.parse(JSON.stringify(xxx))`性能好的, 越复杂越好.

从兼容性来说: 一个lib是会比`JSON`兼容性好的, 现在我看的版本7.0beta是已经支持map, set的.

于是来说一下这次`浅析`的目标: 模拟部分(核心)功能, 目标是:

```js
const origin = {propA: 1, propB: { propC: 'deep' }}
const target = produce(origin, draft => {
  draft.propB.propC = 'mutated'
})
```

实现一个produce传2个参数, 实现plain object, 给一个比较深的属性赋值, 的immutable对象的产生.

## 准备思路

### 原理

immer产生immutable对象的原理是**递归浅拷贝**.

proxy只能算一个工具, 而这个工具达成了另一个特性, **懒处理**: 只对被touch的属性进行处理, 未被影响属性不会创建新的内存区.

immutable性能比较好的原因就在这里, 深拷贝与`JSON`处理都会在内存区里产生一个和原对象一样大的占用, immer只在原对象被touch的属性才创建新的内存区.

### 思路

大方向看: 

1. immer创建一个draft对象, 来供recipe函数操作.
2. recipe函数执行完成后, immer再对被recipe操作过的draft对象进行整理, 产生返回值.

创建draft的思路是: 

 1. 创建一个对象作为proxy的源, 把原对象放入, 并产生一些列辅助属性.

 2. 对draft的set拦截: 如果有set操作就产生一个浅拷贝, 对浅拷贝结果进行修改, 并保存在copy属性里.

 3. 对draft的get拦截: 如果有get操作, 就说明打算mutate更深一层进行set, 就产生一个递归draft放到copy的对应key里并返回.

    题外话: immer做了如果是一个不可以创建proxy的值(约等于基本类型)就直接返回, 所以: 打印draft的一个值会得到对应的值, 而打印一个draftable的值会得到draft.

	4.	拦截其他的一些操作, 使draft有合理的行为. 核心还是get和set.

## 编写一produce

### api结构

produce函数有2个入参和一个返回值. `produce: <T = any>(originObj: T, recipe: (draft: T) => any) => T`

+ originObj: 第一个入参, immutable的目标对象.
+ recipe: 第二个入参, 是函数, 唯一参数是目标对象的副本draft, 对副本draft进行任何改变会决定produce的返回值.
+ 返回值: immutable对象. 经过draft改变以后的结果值.

所以我们的produce是这样的:

```js
const produce = (originObj, recipe) => {
    const proxy = createProxy(originObj);
    recipe(proxy);
    return readresult(proxy);
}
```

分为3部: 根据originObj产生draft, 用recipe处理draft, 分析draft取出期望的返回值.

### 产生一个proxy

proxy有2个点, target和handler. handler的关键在于getter和setter.

#### 构造target

因为元数据必须被保存, 又需要一份浅拷贝, 所以把这2个放在`base`和`copy`属性里. (immer里把这个target叫做state).

在初始化的时候, base赋值为originObj, copy暂时不赋值, 如果没有被touch, 连浅拷贝都不需要, 在finalize的时候直接取base就行了, 提高性能.

#### setter

因为setter的目标已经是被包装过的, 所以setter要把新的key, value. 设置到copy属性上.

当然, 如果copy不存在, 就要浅拷贝base, 生成一份copy.

#### getter

暂不考虑需要读取值的场景, 因为recipe函数的功能是mutate draft.

所以触发getter的原因, 是想触发更深级别的setter, 所以必须保证这个getter拿到的是一个proxy, getter是递归入口.

另外, 在finalize的时候必须获得真正值, 于是约定了一个symbol, 只要尝试获取这个symbol, 就把state返回给他.

createProxy整体是这样的:

```js
const keyForState = Symbol('key-for-state');
const createProxy = (value: any) => {
    const state: state = {
        base: value,
        copy: null,
    }
    const handler = {
        set (state: state, prop: string, v: any) {
            state.copy = state.copy ?? {...state.base};
            state.copy[prop] = v;
            return true;
        },
        get (state: state, prop: string | symbol) {
            if (prop === keyForState) return state;
            state.copy = state.copy ?? {...state.base};
            return (state.copy[prop] = createProxy(value));
        }
    }
    const proxy = new Proxy(state, handler);
    
    return proxy;
}
```

(immer中用了`Proxy.revocable`来产生proxy, 这个简单的demo无处安放revoke handler, 就简单地`new Proxy`了.)

### 整理返回值

生成draft以后, 会把draft作为参数, 让recipe函数调用. `recipe(proxy)`

被recipe处理以后的draft对象, 已经根据recipe被触发了对应的getter setter, draft对象的数据结构有以下特点:

+ draft的target是一个被包装过的对象, 目前有base和copy属性. (immer中为了性能和case有更多属性)
+ 原数据储存在base中, 引用方式是引用地址的.
+ 经过修改的值存在copy中, 引用方式是浅拷贝. 
+ 如果copy对象更深层次的值被改变, copy对象的值会是一个(递归的)proxy.

**所以我们要做的事也很简单**, 根据上面整理的draft的特点, 来获取期望的immutable数据:

1. 使用symbol读取draft对象. (如果不用symbol只能走getter, 无限获取proxy对象)

2. 读取draft对象的copy属性.

3. 遍历copy对象的键值, 如果值非draft, 则直接取, 如果值为draft, 则递归取.

   ("非draft"是递归出口, 判断draft的办法是判断是否有symbol属性)

```js
const readresult = (draft: any) => {
    const state = draft[keyForState];
    for (let key in state.copy) {
        if (isDraft(state.copy[key])) {
            const result = readresult(state.copy[key]);
            state.copy[key] = result;
        }
    }
    return state.copy;
}
```

到了这里, [所有"简化的produce"代码](https://github.com/cwj0417/produce/blob/master/produce.ts)已经全部贴出了, 直接执行就可以获取到immutable对象了.

## 总结

### 原理

其实immer实现immutable的基础原理是和深拷贝一样的: 浅拷贝.

特殊点是: 利用了proxy来实现懒处理, 没有被touch的对象不会创建新的浅拷贝, 依旧使用原对象的内存地址, 节省内存, 提高性能.

并且produce的api设计, 更容易的嵌入到其他lib里整合. (虽然在我看来是proxy的语法特性导致只能这么写)

### 感想

1. 虽然immer是个非常简单的库, 但是在阅读源码的时候还是百度了immer源码解析, 发现很多解析都停留在语法级别. 即: 逐行分析语法, 最后直接说结论, 其实作者自己也不知道发生了什么, 只是码字累了草草收尾. 停留在了"看得懂字, 看不懂意思"的级别.

   我之前看vue源码的时候也是如此, 之后有2件事让我重新思考了学习方式:

   第一, 工作的时候看见很多不太好的代码, 都是因为没先思考, 直接ifelse导致的; 第二, 在学习redux的时候看到了一句话"不去写一遍就不会理解他".

   所以现在都会尝试去实现一个最基本的功能. 其实lib作者开始也是如此的, 再根据各种边边角角来调整构架插入功能的.

2. 从可用到完整lib的差距非常大.

   一个可用的功能的lib只要40行, 而功能完整, 考虑各种用户输入, 边缘case, 可拓展性的代码量和需要花的时间都.

   其实在日常工作中也是一样, 领导和qa看任务是否完成, 和代码质量真的好, 的距离, 和需要花的功夫, 是差很多的.

## 尝试: 写一个自动产生不存在属性的proxy

之前尝试写一个方法, 可以让我们在写一些代码的时候不白屏. 如: `target.key1.key2.value = 'test'`, 如果尝试读取undefined的属性, 浏览器就会白屏.

然后尝试失败了, 现在学到了immer, 就可以尝试用这个模式来实现啦.