---
title: vue组件简单原理
categories: 工作笔记
date: 2022-04-30 16:29:05
tags: [vue,vue源码]
---
简单记录下vue组件的大致思路

<!--more-->

## 什么是组件

组件2大功能, 区分代码块和复用.
从实现上来说是没区别的, 就像是一大段代码要抽象方法一样.
把一段代码抽象一些方法, 和把一个vnode抽象一些组件. 这2件事感觉是一样的.

## 组件在vue里的形式

vue的组件的形式是一个对象, 对象会返回一段vnode.
所以renderer在判断vnode的type是对象的时候, 就会尝试调用mountComponent和patchComponent.
以下是mountComponent的内容:

在组件的编写中, 需要的获取this, 并可以获取state, props, slot, emit等信息.
另外在renderer的时候也需要记录上次组件的vnode, 或者一些拦截.
所以在render组件的时候会新建一个instance.
然后在instance里去获取并用响应式包裹state/props, 给合适的参数来执行render函数/setup函数, 最后获取到组件实例的vnode内容.

## 渲染更新流程

在mountComponent的时候会新建一个render-effect, 在这里执行render函数/setup函数, 进行mount或patch.
所以整个vue的应用是由组件维度形成的嵌套render-efeect, 由于响应式系统已经设计成符合预期的嵌套行为, 所以子effect是不会触发父effect的.

另外这个render-effect是要作为更新用的, 所以加了一个防止重复更新的scheduler, 书里只写了个很简单的.
scheduler把所有更新操作改成微任务, 并放入一个set的进行去重, 并加一个变量isFlushing来防止重复刷新.

那么父组件更新是如何影响子组件的呢?
父组件的diff走到类型为对象, 会进入patchComponent.
patchComponent会对比新老props的每个元素, 如果有变化, 就直接mutate老props.
老的props在mountComponent的时候已经被套上了shallowReadOnly的响应式, 所以直接mutate老props, 就能触发mountComponent时候注册的render-effect了.

## 组件生命周期

option api的组件生命周期, 只要在各个合适的地方调用就行了.
composition api的生命周期, 用了一个全局变量来记录当前实例(这个模式和effect的做法很像).
再在生命周期函数里去设置当前实例的某个生命周期就行了.

## emit与slot

这2个功能没什么让人感觉特别厉害的, 就顺便提一下. (另外有一章说异步组件和函数组件的, 也没啥好说的)
emit就是写一个方法暴露给组件声明参数, 调用的时候会去找父组件的props有没有对应的注册, 有就执行.
slot其实是编译器一起配合的, 使用的时候直接调用对应的数据结构就可以了.

## built-in组件

字面意思可以看出, 内置组件就是个组件.
所以(根据上文)就是个对象, 然后有个setup函数.
内置组件在patch的时候也会因为类型而走到mountComponent/patchComponent.

但我们写不出内置组件, 因为vue在其他对应的地方配合内置组件, 修改了一些行为, 暴露了一些方法.

### keep-alive

keep-alive的组件会有个字段`__isKeepAlive`让其他地方识别他.
在mount和unmount的时候, 判断到是keep-alive组件, 就会调用组件的active和deactive方法, 而不是本来的mount和unmount操作.

所以keep-alive组件要实现active和deactive方法.
原理就是创建一个用不挂到dom上的div.
在active和deactive的时候, 把div里对应的元素移动到真实dom上, 或者从真实dom上移动到div里.
那在active的时候如何寻找被隐藏的dom呢, 用个缓存, node的type作为key. (这个type是个对象, 因为是component)

用什么缓存? 默认lru, 也可以自己重写, 只要符合一定输入输出.

### teleport

teleport和keep-alive的原理很相似, 在mount和unmount的时候判断了是否是teleport组件, 并拦截了操作.

teleport在mount的时候把子元素循环mount到目标节点上, unmount的时候循环unmount.
更新的时候除了循环更新, 如果是目标节点变了, 还要循环把子节点从老目标移动到新目标.

### transition

transition比较简单, 把自己的子元素定义上transition对象, 里面写着不同生命周期的行为, 并把子元素return出去.

而在renderer的各个阶段, mount/unmount的时候, 判断vnode有没有transition对象, 如果有的话调用就行了.

在不同的生命周期中, 做的事就是添加/删除对应的class.
剩下还有个问题, 是transition需要执行时间, 一些class的添加/删除和dom移除动作, 必须等到transition执行完再进行.
在元素进入时, 使用requestAnimationFrame来移除enter-class从而避免enter-class不被添加.
使用监听'transitioned'事件来移除dom, 以保证transition动画执行完毕.
