---
title: 从vuex源码分析module与namespaced
date: 2017-05-31 15:18:18
categories: 胡乱编码
tags: [vuex,source-code,vue]
---
使用vue已经有半年有余, 在各种正式非正式项目中用过, 开始专注于业务比较多, 用到现在也遇见不少因为理解不深导致的问题. 有问题就有找原因的勇气, 所以带着问题搞一波.

<!--more-->

## 带着问题看源码

所以来整理了一下使用过程中不注意或者不规范, 或者简化写法的奇技淫巧, 会结合文档的说明和实际的问题来看看源码, 问题:

+ module在vuex里实际的数据结构
+ namespaced在vuex里实际的数据结构
+ mapState, mapActions等helper的正确用法(配合module/namespaced), 或者是否存在更多骚用法
+ mutation中赋值/触发state变化原理

##  源码分析

看的源码版本为vuex2.3.1

我们使用vuex可能是类似:

```js
import Vue from 'vue'
import Vuex from 'vuex'
import plugins from './plugins'
Vue.use(Vuex)
export default new Vuex.Store({
    state: {
        todo: ["todo1", "todo2"]
    },
    mutations: {
        mutationName(state, payload) {
            state.xxx = payload.xxx
        }
    },
    actions: {
        actionName({ commit, dispatch }, payload) {
            commit(mutationName, payload)
        }
    },
    modules: {
        catagories: {
            state: {},
            mutations: {}
        }
    },
    plugins
})
```

使用vuex的方法为使用`Vue.use`来install`vuex`, 并new一个Store实例, 我们来看一下vuex核心对象.

### Store对象分析

[line6](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L6): 本地vue变量, 在install时会被赋值, 之后会通过vue是否为`undefined`来判断是否install

#### Store对象构建

[line10~14](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L10): 判断vuex是否被正确使用
[line16~26](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L16): 获取options, **`state`可以和vue的component的`data`一样为函数return一个对象, 会在这段代码中被parse**
[line28~36](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L28): [store对象内部变量初始化](#store内部变量初始化)
[line39~46](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L39): 绑定commit和dispatch方法到自身
[line54](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L54): 装载动作
[line58](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L58): 装载响应动作
[line61](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L61): 调用插件

#### store内部变量初始化

```js
this._committing = false
```

是否合法更新state的标识, 对象有方法`_withCommit`是唯一可以改动`_committing`的方法, 只有对象内部使用`_withCommit`更新状态才是合法的, 在`strict`模式下非法更新state会抛出异常.

```js
this._modules = new ModuleCollection(options)
```

modules的cache, 直接把store的参数全部扔给了`ModuleCollection`新建一个modules对象.

点击跳转[ModuleCollection对象](#ModuleCollection对象)来看分析.

```js
this._modulesNamespaceMap = Object.create(null)
```

```js
this._subscribers = []
```

```js
this._watcherVM = new Vue()
```

[其余的变量](#Store对象总结)是新建了空的变量, 之后会在[install模块](#install模块)的时候赋值.

#### 绑定dispatch和commit方法

在[line39~46](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L39), 对dispatch和commit方法进行绑定, 使dispatch方法可以调用在Store对象上注册过的`._actions`

和`._mutations`的方法.

dispatch方法在[line108](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L108), 先兼容了参数的写法, 取到参数, 然后判断Store对象的`_.actions`属性是否注册过, 如果注册过多个, 将会**依次调用**. 也就是如果type重复了也是会调用多次的, 这个地方如果出错debug会非常困难. 暂时没有理解vuex此处设计的意图.

commit方法稍微多一点, 大体思路是一样的, 只是直接执行没有返回值, dispatch会返回执行结果. 另外在[line95](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L95)进行了subscriber的操作, 我们暂且不知道subscriber的作用. 稍后再看.

#### install模块

首先来看参数:

```js
function installModule (store, rootState, path, module, hot)
// 调用
installModule(this, state, [], this._modules.root)
```

[line255](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L255) 根据path获得namespace, 做法是读取path的每个模块, 如果namespaced为true则拼接, 例如path为`['catagories', 'price', 'detail']`, 其中`price`的namespaced为false, 其余为true, 那么获得的namespace为`catagories/detail/`.

[line258~260](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L260) 把namespaced为true的module注册到`_modulesNamespaceMap`.

[line271](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L271)的`makeLocalContext`函数整理了namespace和type的关系. 在之后的三个`module.forEachXxx`中, 都调用了`registerXxx`, 最后的参数都是`makeLocalContext`的返回值.  我们来分析一下`makeLocalContext`的作用:

被注册到全局的mutation/actiongetter实际的type类似于`namespace1/namespace2/type`的形式, 而我们在namespaced为true的module中调用的type只是:`type`. 所以在namespace[true]的action中调用的所有`dispatch`, `commit`, `getter`, `state` 都会被加上  path.join("/") + "/"  的type来调用到正确的方法.

根据注册的type, 我还得到了一个偏门结论: **可以通过设置type为`namespace1/namespace2/type`来调用其他namespace的type**(待测试), 因为他们是这样被注册的.

#### install child module

通过比较, install child module的时候是改了第三第四个参数: `path` => `path.concat(key)`, `module` => `module.getChild(key)`.

主要区别只是在[line264~268](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L264), 与[ModuleCollection的递归注册子module](#递归register子module)行为类似, 递归的path参数流程上只是多了一步把当前loop产生的对象挂到父节点上. 做法也是一样的, 把module名字(path)作为key, 套在父级state上. 也就是结构为:

```js
state: {
  ...currentState,
  moduleName: {
    ...subState
  },
  module2Name: {
    ...anotherSubState
  }
}
```

在之前注册Mutation的时候vuex也是通过这个方法来试mutation获得嵌套过的state作为arguments[0]的.

#### Store对象总结

store对象把传入的options放入了各个变量进行储存, 并提供了commit, dispatch等方法来调用和处理他们:

##### `._modules`

这里存放raw的modules, 未经处理的, 以module名字作为key的方式递归子module.

##### `.state`

这里也是以module名字作为key的方式递归储存传入的state

##### entrys

这里的entry指`._actions`, `._mutations`, `._getters`. 他们的储存方式并没有递归储存key, 而是平级的, 用`/`来分割namespace来分辨type, 并在注册时把当前的entry绑定对应的state(通过`getNestedState`方法).

问题: 如果在不同module注册了相同type的mutation, 会发生什么?

回答: 会依次在自己的state中执行, 不会影响对方state, 但是会造成错误执行. (待测试). 所以应该在大的项目中尽量使用namespaced[true]的方式, 而不是命名的方式.(但是也是可以利用`/`来串namespace的, 所以自己type命名避免`/`)

##### `._modulesNamespaceMap`

根据namespace为key来存放子module

#### 初始化Store VM

这里会新建一个Vue实例并赋值给Store对象的`._vm`属性, 把整个vuex的状态放进去. 并判断严格模式, 如果为严格模式会在非法改变状态的时候抛出异常.

这样整个构建动作已经完成了, 那么这个`._vm`在什么时候用的, 请看下面的章节.

### Store对象的属性&方法

[line64](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L64) state的getter方法, 会获取`._vm`的vue实例的state. 所以我们在vue代码中`this.$store.state.xxx`获取到的东西就是这个vue的实例的数据.

[line68](https://github.com/vuejs/vuex/blob/v2.3.0/src/store.js#L68) 当直接set Store的state时报错, 只能通过设置`._vm`来进行.

剩余的方法的是vuex的进阶用法, 是可以在使用时对vuex状态进行操作的方法, 详见[文档](http://vuex.vuejs.org/en/api.html#vuexstore-instance-methods)

### ModuleCollection对象

我们来看下`ModuleCollection`的构造方法.

#### register根module

调用了`register`方法, 把参数的path设为根目录, runtime设为false.

`register`方法一开始(l30)就判断了除`state`外的属性的值是否为函数, 若不是则抛出异常.

line33 把module参数(还是初始的options, 就是`{state:{...}, mutations:{...}, actions: {...}}`这个)和runtime = false 来构建了`Module`对象(稍后我们看Module对象的构造)

line35 把`ModuleCollection`的root私有变量设为了刚才使用初始options新建的`Module`对象.

line42 如果初始options有modules这个属性, 就开始递归注册modules. 

#### 递归register子module

上面是`register`的第一个参数`path`为空, 也就是root节点的时候的流程, 在最后一部分(line42)根据是否当前注册的module含有modules属性来递归注册, 这部分我们来看一下register的path参数的行为会把数据存成什么结构. 以[概览](#源码分析)部分的例子的参数为例(modules含有一个key为`catagories`)来走一遍代码流程. (开始~)

被作为子module传入`register`方法的参数应该为: `path`(['catagories']), `rawModule`(state: {},mutations: {}), `runtime`(false).

注意到的是, 如果`catagories`有同级module, 被传入的`path`也是一个元素的数组, 也就是path的意思应该类似于从跟到当前module的层级, 对于兄弟节点是无感的.

这里的`runtime`尚未明白用途, 可能是在别处调用的. 注册流程应该runtime都为false.

一路看下来, 也是new了一个`Module`对象, 但是没有走到line35把new出的对象放到`root`变量里, 而是在line37~38去寻找当前module的父节点并把自己作为child, append到父节点上.

这里又脑补了一下数据结构: `path.slice(0, -1)`是获取被pop()一下的path, `path[path.lengt - 1]`是获取当前path的最后一个元素, 也就是当前正在被register的module的key. 所以之前对于path的数据结构判断是正确的.

这里的`appendChild`和`getChild`很明显是`Module`对象的方法了, 我们再继续看`Module`对象的结构.

#### `Module`对象

最后来看`Module`对象的构造~

接受2个参数, 一个`rawModule`, 一个`runtime`, 第一个参数是刚才相对于key为`catagories`的value, 也就是类似`{state: xxx, mutations: xxx, actions: xxx}`的options. 

`Module`的构造函数只是把参数拆分, 放入了自己的私有变量, 其中`state`也接受函数, 并执行函数parse成对象存入私有变量. 其他变量都是原封不动储存的, 所以vuex给他起名为 **raw**Module 吧. 剩下那些方法都是顾名思义的, 语法上也简单, 没什么好看的.

#### 总结

那么这样Store对象的`._modules`属性的数据结构已经很清楚了. 类似于(脑内):

```js
{
  // (ModuleCOllection实例)
  root: {
    // (Module实例)
    _rawModule: {
      state: {...}, mutations: {...}, // ...(全是options直接传入)
    },
    state: {}, // 进行过parse的state, 如果是function会调用并赋值
    _children: {
      catagories: {
        // (Module实例)
      },
      anotherModule: {
        // (Module实例), 递归
      }
    }
  }
}
```

总结一点, 就是这里贮存的数据都是"raw"的.

## helpers

所有的helper都用了两个wrap方法, 先来看下这两个方法的作用.

#### `normalizeNamespace`

因为helper是都接受两种传参方式:`mapState(namespace, map)` / `mapState(map)` , 如果第一个参数为map时这个函数把namespace设为空字符串 , 并且检查namespace的最后一个字符是不是`/`, 如果不是的话加上.

#### `normalizeMap`

我们map的内容也接受两种语法:

```js
[
  "state1",
  "state2"
]
```

或者是

```js
{
  state1: state => state.state1,
  state2: state => state.state2
}
```

这个wrap函数会把两种形式都normalize为含有`key`和`val`属性的数组, 便于统一处理. 也就是上面个两个形式会转化为:

```js
// Array like
[{
  key: "state1",
  val: "state1"
}, {
  key: "state2",
  val: "state2"
}]
// Object like
[{
  key: "state1",
  val: state => state.state1
}, {
  key: "state2",
  val: state => state.state2
}]
```

#### mapState

这里做了2个处理: 

+ 如果namespace不为空, 把state和getter的环境切换到相对于namespace的环境(就是之前的`makeLocalContext`的返回值)
+ 如果val为函数则执行, 否则返回state的val为键的属性. 两者的执行环境皆为处理过namespace的local环境.

#### mapActions

mapAction的val语法只接受字符串的, 所以先把val前借namespace, 变为: `namespace/val`, 这样能符合在Store里注册的entry名. 

然后检查了一下namespace是否被注册过, 也就是防碰撞, 然后把val作为type, 并把剩余参数带着dispatch Store里的action.

---

参考:

+ [美团vuex源码分析](http://tech.meituan.com/vuex-code-analysis.html)