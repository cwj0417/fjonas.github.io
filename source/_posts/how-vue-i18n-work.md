---
title: vue-i18n是如何工作的
date: 2017-10-19 17:38:09
categories: 编码与分析
tags: [vue,分析]
---
vue-i18n是vue代码贡献量第二的vue core team的一位日本小哥写的, 虽是第三方插件, 用起来心里也舒服. github里搜了vue i18n, 结果有不少, 有一些很粗糙的, 甚至用jquery的lib都有六七十个star. (阻断吐槽). 厉害的人明显在设计上代码上都高很多档次吧.

<!--more-->

## 故事背景

今天的故事的主角repo是: [vue-i18n](https://github.com/kazupon/vue-i18n)与[iView](https://github.com/iview/iview). 在使用他们的时候报错了, 查看了[issue](https://github.com/kazupon/vue-i18n/issues/222),  在issue中获得到一段代码, 不明真相地解决了问题:

```js
Vue.use(iView, {
	i18n: (key, value) => i18n.vm._t(key, value)
})
```

这可能是我第一次知道`Vue.use`可以传第二个参数, 所以想知道发生了什么.

先说结果: 是因为`iView`做了对`vue-i18n`的集成, 是没有仔细看文档而使用不当导致的问题. 研究期间又看了element ui的代码. 发现`iView`的对`vue-i18n`的集成是抄他们的. (阻断吐槽). 

来说一下看完这篇文章能明白哪些几点:

+ `Vue.use()`做了些什么

+ 上面的代码为什么避免了`iView`和`vue-i18n`集成使用的错误

+ `Vue.mixin()`做了些什么

+ vue-i18n的差值表达式`$t`方法是哪里来的(因为我只用了这个方法)

  下面开始我们的故事.

## Vue.use

(接文章开头的故事), 以前使用`Vue.use()`的场景都是`Vue.use(vuex)`, `Vue.use(router)`等. 那么这次在第二个参数传入了`i18n: (key, value) => i18n.vm._t(key, value)`以后发生了什么事组织了程序报错呢.

首先要明白`Vue.use()`是干什么用的, 接受的各个参数是干嘛的. 开始看vue的代码, 本文看的**Vue的版本为2.5.2**, 贴个代码, 文件位置: `src/core/global-api/use.js`

```js
/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 以下4行: 判断这个插件是否已经被加载, 防止重复加载
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 以下2行: 制造一串参数等待调用, 制造结果为: 把Vue代替接收到的第一个参数
    const args = toArray(arguments, 1)
    args.unshift(this)
    // 以下4行: 兼容两种api, 然后调用插件中的安装方法.
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 把插件记录在内部, 以便下次判断重复加载
    installedPlugins.push(plugin)
    return this
  }
}
```

代码的语法解释已经写在注释中, 现在来直白的解释一下, 假设插件名字为`Cwj`:

```js
// 使用的时候
Vue.use(Cwj)
// 内部实际执行
Cwj.install(Vue)
// 另一种api, 不推荐, 因为正规的lib中都有install方法
Cwj(Vue)

// 有参数的使用:
Vue.use(Cwj, {
    foo: () => bar
})
// 内部实际执行
Cwj.install(Vue, {
    foo: () => bar
})
```

**总结**: `Vue.use()`的行为: 执行插件的`install()`方法, 第一个参数为Vue, 剩余的参数为`Vue.use()`接受的第二个及以后的参数.

另外, 大部分ui组件的install方法大部分都在执行`Vue.component()`, 哈哈.

## 分析避免集成发生错误的原理

知道了`Vue.use()`干了什么, 那么我们要到`iView`的代码里去找`install()`方法了. 我这里看的**iView的版本为2.5.0-beta.1**, 在`src/index.js`中找到了install方法:

```js
const install = function(Vue, opts = {}) {
    locale.use(opts.locale);
    locale.i18n(opts.i18n);

    Object.keys(iview).forEach(key => {
        Vue.component(key, iview[key]);
    });

    Vue.prototype.$Loading = LoadingBar;
    Vue.prototype.$Message = Message;
    Vue.prototype.$Modal = Modal;
    Vue.prototype.$Notice = Notice;
    Vue.prototype.$Spin = Spin;
};
```

很明是第二行和第三行进行了第二个参数的操作, 那么看一下`src/locale/index.js`, 

```js
export const use = function(l) {
    lang = l || lang;
};

export const i18n = function(fn) {
    i18nHandler = fn || i18nHandler;
};
```

哇, 原来如此, 如果传了`i18n`方法, 就会在iView组件里调用传入的方法, 而不是预定义的i18n处理方法, 怪不到不按照文档的规定来也不会报错了.

## Vue.mixin

那么我们传入的方法是`(key, value) => i18n.vm._t(key, value)`, 这里的`i18n.vm._t`是哪里来的, 看一下在我的项目中[出现问题的文件](https://github.com/fjonas/lock-on/blob/master/src/renderer/main.js)是如何加载他们的:

```js
Vue.use(VueI18n)

const i18n = new VueI18n({
    locale: 'cn',
    messages
})

Vue.use(iView, {
    i18n: (key, value) => i18n.vm._t(key, value)
})

new Vue({
    components: {App},
    router,
    store,
    i18n,
    template: '<App/>'
}).$mount('#app')
```

原来如此, 这个`i18n`正是被传入Vue跟组件的`VueI18n`的实例, 实例里带着了语言包的信息, 以此推断翻译的时候也是调用了`i18n.vm._t`方法, 那么就忍不住要看一下`vue-i18n`的代码了, 我查看的**vue-i18n的版本为7.3.1**, 看一下`src/install.js`:

```js
import { warn } from './util'
import extend from './extend'
import mixin from './mixin'
import component from './component'
import { bind, update } from './directive'

export let Vue

export function install (_Vue) {
  Vue = _Vue
  // 下面都是做一些必要的判断, 不是我们要看的运行机制
  const version = (Vue.version && Number(Vue.version.split('.')[0])) || -1
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && install.installed) {
    warn('already installed.')
    return
  }
  install.installed = true

  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && version < 2) {
    warn(`vue-i18n (${install.version}) need to use Vue 2.0 or later (Vue: ${Vue.version}).`)
    return
  }
  // 这里开始业务逻辑, 下面把_i18n赋给Vue.$i18n
  Object.defineProperty(Vue.prototype, '$i18n', {
    get () { return this._i18n }
  })
  // 下面4句是加载核心
  extend(Vue)
  Vue.mixin(mixin)
  Vue.directive('t', { bind, update })
  Vue.component(component.name, component)
  // 下面是配置merge策略
  // use object-based merge strategy
  const strats = Vue.config.optionMergeStrategies
  strats.i18n = strats.methods
}
```

同样地, 解释也都写在注释中了, 那么4句install的核心里我的mixin方法不熟悉, 接下来我们来了解一下`Vue.mixin()`方法做了些什么:

```js
/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
```

字面意思就merge配置, options也就是`new Vue()`的时候传入的参数, 所以在mixin里传入的会被所有Vue的子组件作为options. (这个逻辑没有看代码, 看的是[文档](https://vuejs.org/v2/guide/mixins.html#Global-Mixin)).

## $t是如何运作的

进行了加载以后, 只需要在dom的插值表达中调用就可以翻译, 类似: `$t('hello')`, 那么`$t`方法是如何被加载到所有Vue的子组件中的呢. 我们需要重新开始理一下.

之前的章节对于一些加载的方法有了了解, 那么现在从`vue-i18n`安装的时候开始分析, 以查出`$t`是如何进行翻译为目的来跟着`vue-i18n`的源码兜一圈.

### 加载

先看vue-i18n是如何被加载进来的.

```js
Vue.use(VueI18n)

const i18n = new VueI18n({
    locale: 'cn',
    messages
})

new Vue({
    components: {App},
    router,
    store,
    i18n,
    template: '<App/>'
}).$mount('#app')
```

这里分成两块:

+ `Vue.use(VueI18n)`, 上面说过, 这里是执行了install方法
+ `new Vue({ i18n: new VueI18n(options)})`, 这里是把一个`vue-i18n`的实例设为了我们跟组件的options, 我们需要分析这个实例有些什么东西, 并在什么地方什么时候调用了他.

### install

上文已经提到过, install里的核心四个方法:

```js
Object.defineProperty(Vue.prototype, '$i18n', {
  get () { return this._i18n }
})
extend(Vue)
Vue.mixin(mixin)
Vue.directive('t', { bind, update })
Vue.component(component.name, component)
```

directive与component分别是注册指令和注册组件, 这里先不展开, 我们的目标是分析`$t`.

来看extend.js中关于`$t`的代码: (文件中其他代码没有贴出来)

```js
/* @flow */

export default function extend (Vue: any): void {
  Vue.prototype.$t = function (key: Path, ...values: any): TranslateResult {
    const i18n = this.$i18n
    return i18n._t(key, i18n.locale, i18n._getMessages(), this, ...values)
  }
}
```

原来如此, 我们调用的`$t('hello')`的来源是`Vue.$t`, 并且调用了`Vue.$i18n._t`方法. 对比文章开头的`i18n.vm._t`, i18n是`VueI18n`的实例, 被注册到Vue的options的`i18n`这个字段里, 调用了同样的`_t()`方法, 那么现在浮现的问题是:

+ `i18n.vm._t`是如何被加载成为`Vue.$i18n._t`的
+ _t方法是写在哪里被加载进Vue的

带着问题, 我们继续看mixin.js. 在mixin.js里只有两个方法, 是beforeCreate和beforeDestroy, 我大致看了下beforeCreate, 作用是建立当前component的Vue._i18n变量, 这个变量就是Vue.$i18n的getter的指向, 为什么要写getter原因也出来了, 因为i18n-loader允许在单文件里写本地语言包, 所以要merge一下, 产生本地的语言环境. 

那么在mixin中是如何获取初始语言包的呢, 源码里: `const options: any = this.$options`, 也就是取了Vue.$options, 那么下一章来讲一讲Vue实例构建的时候是如何把vue-i18n实例加载进入Vue实例的.

### Vue实例构造过程中加载的VueI18n实例

切取一段来自`src/core/instance/init.js`的代码:

```js
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}
```

(粗糙地一看), 就是Vue吧参数判断了一下然后塞进了自己的`.$options`属性. 也就是`Vue.$options.i18n` 现在是一个VueI18n实例.

准备看一下VueI18n的构造吧. 代码有600行, 初始化的时候还是执行了

```js
const silent = Vue.config.silent
Vue.config.silent = true
this._vm = new Vue({ data })
Vue.config.silent = silent
```

好像vuex也是这么写的, _t方法就写在这个文件里, 但是如何加载的还得看vue源码, 只能下回分解了.