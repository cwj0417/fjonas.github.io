---
title: 通过vue ssr简单实现来理解代码限制
categories: 工作笔记
date: 2024-06-18 00:25:43
tags: [ssr,vue,nuxt]
---
vue srr 项目的编码是有一些限制的. 这里通过简单了解实现过程来理解这些限制.

<!--more-->

## 原因

ssr 编码限制零零碎碎有非常多, 但这些限制的源头非常容易找, 以源头出发就很容易理解和记忆这些限制.

ssr 项目比 scr 项目多做的事情是**服务端读取应用( app )并生成第一屏的html字符串返回给浏览器**.

这个特点可以拆分为3个大方向:

+ 目标是字符串产生的问题: 因为服务端渲染的目标是"快照" 的字符串, 所以会有没有 js 环境, 没有 bom 环境导致的问题.
+ 同构产生的问题: 因为服务器需要读取应用( app )代码. 那么我们写的代码就要考虑在 node 环境中运行的问题.
+ 副作用代码产生的问题: 如果应用( app )代码有副作用, 本期望应该在浏览器发生的, 发生在服务端就会产生非预期的行为.

解决方案也有2个方向: 

+ 在需要的时候判断环境写不同的代码: 判断构建时带上的环境变量, 利用 ssr 不会调用的生命周期函数.
+ 框架内部或者是 ssr 框架写一些通用场景的解决方案. (指 vue 和 nuxt )

## 快照产生的问题

因为服务器读取应用( app )的目的是**产生字符串**, 所以:

+ 和挂载相关的生命周期函数( onMounted 和 onUnmounted )在服务器上执行的时候是获取不到 dom 的. 并且在语义上也没有挂载动作, 只会做字符串拼接. 所以 ssr 场景不会调用这2个生命周期.
+ 也因为是字符串, 所以没有 js 环境, 就没有 effect, 所以配合 effect 的响应式 api ( reactive, ref 等)也是没意义的, 在 ssr 场景, 都不会调用这些 api 以节省性能开销.

## 同构产生的问题

因为我们写页面, 主要是浏览器思维, 所以主要要注意的是 bom 环境的 api. ( window, document )

+ 对于 请求类的, 可以使用 axios , ofetch ( nuxt 用的) 来兼容 server / client 端.
+ 对于只有 bom 有的 api, 比如 localstorage, 可以写在 onMounted / onUnmounted 生命周期, 上一节已经提过, 这2个生命周期不会在服务端执行.

对于同构产生的问题, 有个更简单的解决方案, 就是通过构建定义的变量( 如 vite 是 import.meta.ssr )来判断.

另外对于 html 的标准 server 和 bom 端有点区别, div 不能作为 p 的子节点.

## 副作用代码产生的问题

一些本来是浏览器设计的副作用, 在服务器上运行就会产生问题.

这个问题比较难猜, 这里就说一下文档里提到的.

+ 设置setInterval的时候, 可以在 onMounted, 和 onUnmounted 中设置. 如果在 setup 中设置, 就会导致服务器内存溢出了.
+ 在应用( app )通过多处引入 reactive 变量来实现共享 state 的. 在服务端就变为同一个变量, 产生了跨请求变量污染. 解决方案是每个应用引入单例的变量.

## 数据获取是怎么实现的

数据可以在服务端获取, 但 reactive 是没有的, 那么代码如何写呢?

问了朋友, 原来是要用到 next / nuxt 提供的方法.

我看了nuxt的`useAsyncData`, 我们来看一下他的实现流程.

我们先来看用法, 来自官网:

```js
<script setup>
const page = ref(1)
const { data: posts } = await useAsyncData(
  'posts',
  () => $fetch('https://fakeApi.com/posts', {
    params: {
      page: page.value
    }
  }), {
    watch: [page]
  }
)
</script>
```

写法很容易理解, 是写在 setup 中的. 

效果是在服务端取好数据, 直接返回给浏览器, 并且浏览器不需要重新请求.

这样还有个优点, 可以对用户隐藏一些接口.

现在我们来看一下`useAsyncData`的流程, **目标是了解服务端和客户端分别做了什么, 并且是如何通信的**.

我们关注`useAsyncData`返回了什么: 获取到的数据( data ), 刷新方法( refresh ) 和一些状态.

找到了代码, 200多行, 比较简单, 分为以下步骤:

1. 尝试获取缓存. 

   服务端从`nuxtApp.static`获取, 浏览器从`nuxtApp.payload`获取.

2. 如果在服务端运行, 通过vue的`onServerPrefetch`生命周期来执行 `refresh`.

3. 如果是浏览器端, 如果有缓存, 则直接使用缓存, 如果没有, 就通过vue的`onMounted`生命周期来执行`refresh`.

4. `refresh`方法的内容主要是调用获取数据的函数, 并在返回的时候设置缓存. (设置`nuxtApp.payload`, `nuxtApp.static`是通过插件赋值的)

我们了解了服务端和浏览器是通过`payload`放到vue实例上通信的, 但具体的做法没理解, 相关代码文件都有`payload`.

简单地从服务器范围的内容来看, 服务器是生成了一份`payload`文件, 在 html 中引入的.

## 简单说明vue的ssr过程

这里的内容来自于hcy的书, 并简化了很多.

### 服务端渲染过程

应用( app )的最外层是一个组件, vue 通过调用组件中描述的各个生命周期, 并获得 vnode, 最后递归渲染 vnode.

```js
function renderComponent (vnode) {
  let { data, setup, beforeCreate, created } = vnode.type; // vnode.type就是我们编写.vue文件的组件描述
  
  beforeCreate && beforeCreate()
  
  const state = data() // 客户端渲染会调用 reactive(data()), 响应式在服务端没有意义, 节省开销
  
  const instance = { // 创建 vue 实例
    state,
    isMounted: false
  }
  
  const render = setup(instance) // 执行 setup, 获得 render 函数
  
  const subTree = render.call()
  
  created && created() // 生命周期里没有 mounted 和 unmounted
  
  renderVNode(subTree) // 尝试把 vnode 渲染成字符串
}
```

`renderVNode`的内容是, 如果 vnode 是个组件, 就递归调用`renderComponent`, 如果是其他的节点, 就可以输出字符串了.

### 客户端注水过程

客户端获取到的 html 是的干净的, 他离动态页面还差哪些内容? 一是元素的事件需要绑定, 二是建立 render effect, 也就是mountComponent. ( 其实就是上面`renderComponent`函数的浏览器端原型)

hydrate方法接受2个参数: vnode 和 container.  和 csr 的 render 区别也就是 container 是已经有内容的.

```js
function hydrate(vnode, container) {
  hydrateNode(container.firstChild, vnode)
}
function hydrateNode(node, vnode) {
  vnode.el = node; // 重要, 因为 dom 已经存在了, 只需要绑定关系. 在 mount 的阶段可以识别已经有 el 而跳过服务端做过的事.
  
  if (typeof vnode.type === 'object') {
    mountComponent(vnode, container, null)
  } else {
    hydreateElement(node, vnode)
  }
  return node.nextSibling
}
```

mountComponent的代码比较多, 而且属于前置知识点, 主要思路是和上一章节`renderComponent`一样的. (并且多了 mounted / unmounted 生命周期函数, 和 render effect 和相关的 reactivity 函数的包裹)

这里还是简单写一下改变的部分:

```js
function mountComponent(vnode, container, anchor) {
  // 与上部分 renderComponent 相似
  const state = reactive(data()) // reactive 的数据在 render effect中才有效, 也属于前置知识
  // 省略部分代码
  instance.update = effect(() => {
    const subTree = render.call()
    if (!instance.isMounted) {
      beforeMounted && beforeMounted()
      if (vnode.el) { // 判断有 el 属性, 其实这个分支是 ssr 的 hydrating 分支了.
        hydreateNode(vnode.el, subTree)
      } else {
        // 这里正常浏览器流程, 走首次 mount, 或者是之后的 patch
      }
    }
  })
}
```

上面是 render effect 的建立过程, 最后还有一个函数`hydreateElement`, 用来绑定元素事件.

```js
function hydreateElement(el, vnode) {
  if (vnode.props) {
    for (const key in vnode.props) {
      if (/^on/.test(key)) {
        patchProps(el, key, null, vnode.props[key]) // 绑定元素事件
      }
    }
  }
  if (Array.isArray(vnode.children)) {
    let nextNode = el.firstChild
    const len = vnode.children.length
    for (let i = 0; i < len; i++) { // 循环注水所有子节点, nextNode 会指向下一个, 是因为在 hydrateNode 函数返回了 nextSibling
      nextNode = hydrateNode(nextNode, vnode.children[i])
    }
  }
}
```

## next

看了一些 nuxt 代码, 对 nuxt 也提起了兴趣, 下次分析下 nuxt 的主要流程.
