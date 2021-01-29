---
title: react不常用功能补漏
date: 2021-01-04 20:55:33
categories: 工作笔记
tags: [react]
---
前一阵过了一遍react文档, 记录看到的几个不太常用api.

<!--more-->

## pure component与should component update

### PureComponent

PureComponent其实就对应着pure function. (是我这次才恍然大悟的)

也就是初中第一次学到函数的概念: y = f(x), 一个x永远对应一个y.

这里PureComponent的输入是state和props, 输出是dom. 只要相同的state和props永远对应相同的dom, 就可以设置为PureComponent.

### shouldComponentUpdate

PureComponent在进一层的实现上是shouldComponentUpdate(scu)的封装, 在scu的时候对上次的state和props作了浅比较. 如果浅比较结果相同会阻止即将进行的渲染.

[文档里的图表](https://projects.wojtekmaj.pl/react-lifecycle-methods-diagram/)很清晰地说明, props和state的变化会触发scu, 如果scu返回false就不走render了.

文档看到这里, 我问了同事, 是不是大多数组件都可以改成PureComponent. 同事扔给了我一个链接, 那个链接我没有记, 自己写了个[类似的demo](https://github.com/cwj0417/react-side-effect-test/blob/main/src/stateCounter.jsx#L17). 这个demo把Component改成PureComponent就会出现bug.

## mutate state与pure component

因为demo中的setState是这样写的:

```js
this.setState(state => {
  state.counter += 1;
  return state;
})
```

react的state是要求immutable的. 比较初级的程序员经常会犯的这个错误.

但被问到mutate state有何不可, 我一般说有2个问题, 第一不可测试. 第二导致的奇怪bug很难debug.

这里就发现了个mutate state导致的bug.

因为直接改动了原state的属性, 在scu的时候, 新state和原state中变化的那个值是指向同一个地址的, 就导致了scu误判返回了false阻止render.

还是得写成immutable的形式来避免这个bug:

```js
this.setState(state => {
  return {
    counter: state.counter + 1
  }
})
```

## react-redux的connect与mutate state

而我们大多项目是用redux的, 碰巧redux也是immutable的设计. 于是写了个[demo](https://github.com/cwj0417/react-side-effect-test/blob/main/src/counter.jsx)来试一下`react-redux`的`connect()`方法有没有做类似的优化.

于是又巧了. `connect()`内部也用了浅比较来优化. 于是产生了和上一节一样的问题, 解决方案也相同, 就不赘述了.

再挖了一下`connect()`, 发现第四个参数可以传参数的, 在[demo的第57行](https://github.com/cwj0417/react-side-effect-test/blob/main/src/counter.jsx#L57)这个属性设置为`===`就可以在mutate state的情况下得到期望的结果了. (默认值是浅比较)

## get derrived state from props与受控组件

当组件实现了getDerrivedStateFromProps, state和props就有了一层绑定关系. 在不判断条件的情况下, 一个普通的组件就会从非受控组件变成受控组件.

在对受控/非受控组件概念不请的时候, 就会在这里写不合适的代码, 而造成非期望的bug和不可测试.

在我不理解受控/非受控组件前, 在看到一些ui库的表单组件和表格组件的selected相关api会觉得反人性设计.

(具体案例不提了太基础了)

## render props

render props的定义是: 调用props的函数作为render返回的一部分.

所以render props的使用方会感觉: 使一个prop返回jsx元素, render props的构造组件会感受: render的返回值中包含了props的调用.

render props其实不一定要叫render, 也可以是其他的. 于是想到了一个奇妙的元素: children. children可以直接写在标签中, 就想到了之前使用的`AutoSizer`原来是用了render props.

## react的特点(与vue比较)

react三大抽组件方式, rp, hoc, hooks, 让人感觉最明显的是: react的组件就是一个函数(vue使用组件还需要注册, 很明显能感受到). react能更灵活的运用js的特性, rp, hoc, hooks其实都不是react特性, 而是js特性.

另外, **react的使用者要自己做优化, 或者说是遵循一定规范.** 不然会导致预期外的bug和性能损耗, 而vue帮用户做了优化. (但自动优化本身是耗性能的)

这里说一点经验中总结的规范, **要把不同更新频率的页面部分分成不同的组件, 并用scu阻断渲染树.** 这个在用redux connect的时候也要注意, 不要用点点点引入页面不相关的数据.

原因是: react的render方法只能整体执行. (vue的render方法只是生成ast, 下一步还会patch. 而react???). 下面举一个具体例子:

组件A 包含 组件B, 组件C. B, C分别依赖A的state.

当setState改变C依赖的state时, B也会被重新渲染.

所以方法是: 用pureComponent把B包起来, 这也是为什么ui组件库会尽量用pureComponent.

## 插件互用

react跨组件的状态管理有redux, mobx, hox, recoil等. 而如果只是传递一个事件, 其实并不需要状态管理.

拿redux说, 其实dispatch就是直接操作reducer的. 而redux和react有关系的地方就是connect, 要通过redux传递事件只能去改变状态, 再监听props. 这显得非常不合理.

所以用Vue的event bus就可以, event bus就是一个闭包, 把组件存在闭包里, 在触发事件的时候调用就行了. 当然也自己写个30行的event bus.

反过来也是的, vue也可以用redux. 之前在小程序里用的时候对vue和react的理解还比较局限. 希望以后对js和框架的理解能更深刻.