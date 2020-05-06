---
title: vue源码之VNode(二)附带之前的总结
date: 2018-11-08 18:29:10
categories: 工作笔记
tags: [vue,vue源码,分析]
---
因为生活和工作的关系, 已经有半年多没写有意义的博客了, 最近重新开始之前的学习和做一些有"不紧急而重要"的事情.

<!--more-->

先用一小段说下对工作的看法. 看似工作忙于业务毫无成长(也许确实是这样的), 但脱离了业务的技术也是空的, 也许搞一下业务, 搞一下生活, 再搞一下理论, 互作休息, 也是一种文武之道, 人是有周期的.

那么下面正式开始, 先来回顾一下之前看vue源码的内容, 再从之前断掉的地方继续开始.

## 之前的vue源码阅读脉络总结

### 入口

vue把自己称作`progressive js framework`, 这也是vue作者吹自己的一个亮点, 并且确实因为这个特点被weex(来自阿里), mpvue(来自美团点评)充分开发而把vue的使用场景扩大到了更多的地方, 可以说水平越高越体会到了尤老板的远见和对技术的理解. 这里先不花一整个小节谈解决方案的优美了, 这并不是说了就能理解的, 只能体会.

那么vue就有很多入口, 通过`package.json`找到了rollup的配置文件, 发现有很多配置, 那么我们来找一下我们要分析的目标入口.

1. 根据我们使用的项目的webpack的配置(vue的alias), 使用的是`dist/vue.esm.js`, 根据rollup的配置, 最后找到了入口是: **`platforms/web/entry-runtime-with-compiler.js`**.

   而这个文件只是对引入的vue做了处理输出, 引入源是**`platforms/web/runtime/index.js`**, 而这个文件又是引入**`core/index`**, `core/index`中才是真正对vue进行定义的地方. platforms文件夹下的代码是对vue的一些关于平台的方法进行了实现. 可以理解为bom/dom相关的操作都在这里, 不让这些影响js core的纯净.

2. 在`entry-runtime-with-compiler`中, 重写了mount方法, 在mount时**把template处理成render函数**, 如果有render函数就无视template.

3. 在 runtime/index.js 中, 加上平台相关的config, directive, component, 和patch方法, 并**定义了mount方法,** 位置是 core/instance/lifecycle.

### core部分

到了core/index.js, 从instance/index引入了vue的主体, 并挂载暴露给全局的api, 和ssr的变量(这里先不关心ssr). 这里展开就非常多了. 所以看完一个部分的源码, 就会再回到core/index这个入口来进行下个部分的分析(给自己挖好了后面的坑). 我之前看的是源码部分是围绕"数据响应及更新dom"来的, 也简单回顾一下之前的结论. 

1. 在vue初始化的时候会把data, computed等属性加上getter方法, 每次getter的时候都会触发watcher来执行一些动作.
2. 而vue中的template, 或者是.vue文件中的模板都会被(webpack或是vue的compiler)编译成render函数, render函数里就带着一些被observe的变量. 在initLifecyle的时候会注册watch函数, 注册的时候会第一次运行render函数, 运行的时候就把render函数里的observe变量的getter跑了一遍, 所以被observe的对象一有变化就会触发updateComponent.
3. updateComponent最后是调用了patch函数, patch函数第一次会挂载dom, 之后都是diff dom再去改变dom.

已经快到之前看到的部分了, 最后一部分这次重新再走一遍, 回顾到此结束.

## 目的

其实这部分(初始挂载dom/数据变化diff dom)的过程都清楚了, 现在只是去看细节如何实现.

所以我们的目的是: 

+ VNode的结构是怎么样的? 
+ render函数是怎么把template编译成ast的?(无非是正则, 但是还是想去看)
+ patch函数的具体实现.(第一次根据VNode挂载和根据VNode来diff, diff应该复杂许多)

万恶之源在`core/instance/lifecycle.js`:

```js
updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
```

`vm._render()`的作用是: 根据render函数来生成VNode. render函数是根据其他种种编译来的, 之前已经说过了.

`vm._update()`的作用是调用patch, 可以理解为处理一些参数并调用patch.

那么`._render()`的结果作为了patch的参数, 不得不先看`._render()`的细节了.

## `._render()`

看了_render函数, 取了options里的render函数(此时的render函数已经是经过编译的), 并调用. 其他代码都只是做一些容错处理, 我们这次先走主线, _render函数的核心语句是:

```js
vnode = render.call(vm._renderProxy, vm.$createElement)
```

第一个参数就是Vue, 第二个参数就是生成VNode的方法.

因为render方法可以自己写, 所以看如何编译template不是必须的, 看着文档上的render function guide就行了.

文档上render function的参数是: tag, data, children. 我们直接用文档上第一个最简单的例子来分析:

```js
render: function (createElement) {
    return createElement(
      'h' + this.level,   // tag name
      this.$slots.default // array of children
    )
  }
```

注意第二个参数不是data, 而是children. 这个函数的执行以后的渲染结果应该类似于:

```html
<h1>
    title 1
</h1>
```

我们就先来看看`createElement('h1', 'title 1')`返回的VNode是怎么样的吧.

### `.$createElement()`

找到文件`core/vdom/create-element.js`. 除了创建VNode的核心部分, 之前的代码做了一些参数的处理(data是optional参数), 以及滤空滤错处理, 不符合预期的输入就会返回空的VNode或者报warn. 

```js
if (normalizationType === ALWAYS_NORMALIZE) {
  children = normalizeChildren(children)
} else if (normalizationType === SIMPLE_NORMALIZE) {
  children = simpleNormalizeChildren(children)
}
```

然后会根据`normalizationType`对children做处理, 这个值只有template编译成render的时候是`SIMPLE_NORMALIZE`, 自己写render函数的时候是`ALWAYS_NORMALIZE`, 所以我们看后者.

### `.normalizeChildren()`

代码在core/vdom/helpers/normalize-childrens.js

代码开头就进行了大段业务逻辑的注释, 大概意思是经过编译的render函数是不需要normalize的, 除非有数组嵌套, 所以有嵌套的时候就把数组flatten了(simpleNormalizeChildren), 还有一种情况是手写的render函数, 要进行full-normalize, 因为文档提供的api的快速通道是"如果穿字符串就代表字符串节点"除此之外都必须用createElement创建vnode, 也就是normalize有两个工作: 1. flatten, 2. 把字符串转成text节点.

```js
export function normalizeChildren (children: any): ?Array<VNode> {
  return isPrimitive(children) // 判断children的类型是否string, number, symbol, boolean
    ? [createTextVNode(children)]
    : Array.isArray(children)
      ? normalizeArrayChildren(children)
      : undefined
}
```

如果children直接是字符串, 那就返回一个只含一个text节点vnode的数组. 否则进行`normalizeArrayChildren`.

```js
function normalizeArrayChildren (children: any, nestedIndex?: string): Array<VNode> {
  const res = []
  let i, c, lastIndex, last
  for (i = 0; i < children.length; i++) {
    c = children[i]
    if (isUndef(c) || typeof c === 'boolean') continue
    lastIndex = res.length - 1
    last = res[lastIndex]
    //  nested
    if (Array.isArray(c)) {
      if (c.length > 0) {
        // 这里的效果其实也是flatten
        c = normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`)
        // merge adjacent text nodes
        if (isTextNode(c[0]) && isTextNode(last)) {
          res[lastIndex] = createTextVNode(last.text + (c[0]: any).text)
          c.shift()
        }
        res.push.apply(res, c)
      }
    } else if (isPrimitive(c)) { // 这个分支和simple normalize 一样
      if (isTextNode(last)) {
        // merge adjacent text nodes
        // this is necessary for SSR hydration because text nodes are
        // essentially merged when rendered to HTML strings
        res[lastIndex] = createTextVNode(last.text + c)
      } else if (c !== '') {
        // convert primitive to vnode
        res.push(createTextVNode(c))
      }
    } else {
      if (isTextNode(c) && isTextNode(last)) {
        // merge adjacent text nodes
        res[lastIndex] = createTextVNode(last.text + c.text)
      } else {
        // default key for nested array children (likely generated by v-for)
        if (isTrue(children._isVList) &&
          isDef(c.tag) &&
          isUndef(c.key) &&
          isDef(nestedIndex)) {
          c.key = `__vlist${nestedIndex}_${i}__`
        }
        res.push(c)
      }
    }
  }
  return res
}
```

其实贴代码前已经总结过了: flatten数据结构使之成为一层的vnode的数组. 把render手写的string转成text vnode. 附带了一些把邻近的text节点合并的业务.

结论: 通过了normalize, children已经全部成为`[vnode, vnode, …]`的形式了.

接下来是createElement的核心代码.

### 返回vnode

```js
if (typeof tag === 'string') { // tag是string
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag) // 如果有旧的取旧的, 没得就获得, 用来判断svg或者math
    if (config.isReservedTag(tag)) { // case: 是平台相关的标签(div, span)
      // platform built-in elements
      vnode = new VNode( //
        config.parsePlatformTagName(tag), data, children, // 这个config.parsePlatformTagName的具体内容是: _ => _ 是什么就返回什么.
        undefined, undefined, context
      )
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // resolveAsset: 如果有 options.components[tag], 就返回他, 也就是返回了一个component
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 对这个情况在后面做处理~ 这里先正常返回, 也就是未知标签
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    // 另一种语法: 直接传component options的情况, 用component options 创建子component, 这里的tag是component options
    vnode = createComponent(tag, data, context, children)
  }
```

这里根据tag分为4个情况:

1. tag是标准html标签. (div, span, img等)
2. tag是已经被注册在$options.component中的组件名. (比如'comp', 在实例中有components: {comp: {template: '...'}})
3. tag是未知标签, 又没有被注册过.
4. tag不是字符串, 直接是component的构造函数.

case1和3都进行了相同的操作: `new VNode(tag, data, children, undefined, undefined, context)`. 看了VNode, VNode这个类本身没什么方法, 只是储存着一些数据罢了, 构造方法里也只是把各个参数保存到实例的属性里. (这里也不贴代码使版面混乱了)

case2和4进行了另一个类似的操作: `createComponent(tag, data, context, children)`(在case2的时候多穿了个tagName).

总结: 在render函数的tag为非组件的时候, createElement返回一个VNode.

### `.createComponent()`

首先确定的是: 这个方法最后返回的是一个VNode.

代码比较多, 功能比较杂, 简单地过一下看得懂的, 并确定这个返回的VNode中带了哪些信息.

+ 处理了data里的`v-model`. (众所周知v-model是个语法糖, 根据是否配置来转化为props和emit)
+ 处理了functional组件.
+ `installComponentHooks`. 给组件安装上属于组件的生命周期, 有init, prepatch, insert, destroy. 类似于重载生命周期方法, 因为在写好的方法里调用了options里的生命周期.

最后new一个VNode:

```js
const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )
```

这里比其他地方多的是, 传了`ComponentOptions`, 注释中看到这是ssr相关的.

总结: createComponent也只是返回了一个VNode, 但现在看得太粗, 组件相关的实现应该需要仔细看这里, 现在先跳过.

那么其实render函数主要就是把options里的render函数塞到一个VNode里并返回, 交给patch处理.

## patch

据说vue3.0改写了这部分, 所以想看的欲望减少了.(为懒找了借口)

