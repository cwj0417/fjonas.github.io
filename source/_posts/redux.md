---
title: redux学习笔记
date: 2020-05-26 17:53:02
categories: 工作笔记
tags: [redux]
---
因为redux特别简单, 所以学习一下.

记得用了vue半年的时候学了下vuex, 现在用了react半年, 同样学一下redux.

<!--more-->

相比之下, redux比vuex简单多了. redux与react没有强关联, vuex在内部调用了vm; redux的api没有namespace概念.

## 基本信息

首先, redux的作用是: 在内存中管理一组数据, 并使web应用的各处可以获取/修改.

基于这个核心作用, 设计还增加一些额外的目的, 比如api简便, 拓展性好(本身拓展性和应用拓展性), 容易debug等.

redux只有3个核心概念: 

+ store: 储存数据的对象.
+ reducer: 描述如何改变store.
+ action: 描述调用哪个reducer.

redux还有一个特点: **no magic**. 没有元编程, 没在对象上挂一些小东西. 因此redux也非常简单, 便于学习.

**除去订阅功能, redux所有功能的代码只有35行.** 这里就用一整篇文章来讲讲这35行代码.

阅读redux代码能学到2点: ts语法, 闭包的应用(或者叫函数式编程?).

换个说法是, 对ts和函数式编程很熟悉的可以秒懂redux所有东西.

## 核心API

```js
const createStore = (reducer, initState) => {
  let state = initState
  const getState = () => state
  const dispatch = action => state = reducer(state, action)
  return {
    getState,
    dispatch,
  }
}
```

1. 调用createStore, 获得了一个有2个方法的对象.
2. 一个内部变量state储存在内存里没有被释放.
3. 2个方法, 分别是用来获取和改变state.

写到这里, 我们已经可以使用redux了. 当然需要一些对reducer的理解, 如果理解可以跳过.

> reducer是描述state如何变化的**纯函数.** (就是每个输入都对应唯一的输出, 数学中的函数)
>
> reducer接受2个参数: 当前state, 和约定描述如何变更state的对象: action.
>
> reducer的输出: 下一个state.

这里写一个最简单的计数器. (action在redux中也有规范, 必须有type键)

```js
const initState = {count: 0}
const reducer = (state, action) => {
  switch (action.type) {
    case 'increase':
      return {
        ...state,
        count: state.count + (action.payload || 1)
      }
      break
    default:
      return state
  }
}
const store = createStore(reducer, initState)

store.getState() // {count: 0}
store.dispatch({type: 'increase', payload: 1})
store.getState() // {count: 1}
```

## 可有可无的3个helperAPI

接下来介绍3个只是为了使用方便的api. 甚至可以作为简单的3分钟内可以答出的面试题.

### 改造action

每次`store.dispatch({type: 'increase', payload: 1})`感觉不合适, 我们期望可以`store.dispatch(increase(1))`这样调用:

```js
const increase = num => ({type: 'increase', payload: num})
```

这里的increase叫做`actionCreator`, 因为执行结果是一个action.

在实际项目里, 这样的actionCreator还会有好多, 比如:

```js
const decrease = num => ({type: 'decrease', payload: num})
```

每次都要调用store.dispatch, 还有好多个方法, 好像也很麻烦.

不如把他们再包装一层, 把dispatch包进去, 并把方法挂到一个对象上, 我们期望调用方法是:

```js
const actions = bindActionCreators({increase, decrease}, store.dispatch)
actions.increase(1) // => store.dispatch(increase(1))
actions.decrease(2)
```

如果有兴趣可以自己写一下这个`bindActionCreators`方法.

### 改造reducer

vuex有module的概念, redux的分模块的方法是: 把根模块的每个键作为子模块名字, 值作为子模块. 我们把state改造下, 计数器变成一个模块, 再造个新模块叫status记录一个布尔值.

```js
const initState = {
  count: {
    value: 0,
  },
  status: {
    value: true,
  },
}
const count = (state, action) => {
  switch (action.type) {
    case 'increase':
      return {
        value: state.value + (action.payload || 1)
      }
      break
    case 'decrease':
      return {
        value: state.value - (action.payload || 1)
      }
      break
    default:
      return state
  }
}
const status = (state, action) => {
  switch (action.type) {
    case 'switch':
      return {
        value: !state.value,
      }
    default:
      return state
  }
}
const reducer = (state, action) => ({
  count: count(state.count, action),
  status: status(state.status, action),
})
```

很巧妙地, 在调用reducer的时候, reducer没有直接处理, 而是**把对应的state交给对应的子模块处理, 并把处理结果赋值给对应子模块的在根state的键.** 子reducer是一个可以脱离树而独立存在的reducer, 真是妙啊.

但是, 这个组合reducer的函数明显有可以优化的地方: 每个子模块的构成模式是一样的, state和action每次都要写.

所以我们希望可以写成:

```js
const reducer = combineReducers({count, status})
```

那么`combineReducers`就作为第二个思考题.

### compose

这个helper函数除了redux, 在lodash和ramda里也有用到. 作用是把`a(b(c(...args)))`写成`compose(c, b, a)(...args)`.

```js
const compose = (...funcs) => funcs.reduce((a, b) => (...args) => a(b(...args)))
```

这个方法是为后面的applyMiddleware准备的. 总结如下:

+ 从右到左一次执行方法, 把执行结果, 作为参数传给下个方法.
+ (由上条推出)最后边的方法可以接受多个参数, 而其他方法只能接受一个参数.
+ 在后面的applyMiddleware的设计中, 会正好把调用中间件的顺序正过来.

## middleware

这是最后, 也是最复杂的redux的api.

但目的比较简单: **允许用户改写dispatch方法. ** 并且可以允许多个中间件同时加载.

加上一些阻止非法操作和增加api便利性, 就写成了最终的applyMiddleware方法.

[文档](https://redux.js.org/advanced/middleware#attempt-1-logging-manually)上有一系列推导, 比较精彩, 这里就直接说最后结论.

1. 利用`compose`的特点, 上个函数的**执行结果**作为下个函数的**参数**, 只要给第一个函数传入dispatch, 所有函数的返回值都是(经改写的)dispatch. 最后的直接结果是一个经过所有middleware改写的dispatch, 再把这个dispatch赋值到原来的dispatch.

   因为必须执行一下自己的参数才能完成middleware的使命(只要有不执行, 原来的dispatch就不会执行, 后面会解释), 所以给了这个参数一个很好的名字`next`.

2. redux还希望在中间件里暴露store的dispatch和getState给用户, 所以规定中间件的写法再多加了一层闭包, 把store.dispatch和store.getState传给用户.

下面来看2个常用的middleware, 并尝试用他们来改写store的dispatch方法:

```js
// 如果dispatch一个方法而不是action, 就调用这个方法, 并把一些参数给他使用
const thunk = store => next => action => {
  typeof action === 'function' ? action(store.dispatch, store.getState) : next(action)
}
// 在dispatch的前后打印一些信息
const logger = store => next => action => {
  console.log('dispatching', action)
  next(action)
  console.log('next state', store.getState())
}
```

这里看到好多箭头, 那么第一个箭头是store, 我们先调用一次把store保留到内存里.

```js
const thunkWithStore = thunk(store)
const loggerWithStore = logger(store)
// 此时这两个函数就是: (以下是不是代码, 为了高亮没有注释)
thunkWithStore = next => action => {
  typeof action === 'function' ? action(store.dispatch, store.getState) : next(action)
}
loggerWithStore = next => action => {
  console.log('dispatching', action)
  next(action)
  console.log('next state', store.getState())
}
```

此时的2个方法, 已经把`next`作为参数, 返回的是一个方法, 只要在方法里调用`next`就可以继承上一层, 不需要return(官方文档都return, 我认为没必要, 也造成了迷惑).

那么我们暂时不用compose, 把这些方法串起来, 会更容易理解:

```js
store.dispatch = thunkWithStore(loggerWithStore(store.dispatch))
```

我们把这些变量代入, 看看得到了什么:

```js
store.dispatch = action => {
  typeof action === 'function' ? action(store.dispatch, store.getState) 
  : // 下面这行开始是thunkWithStore的next(action), 因为next方法已经调用, 其实第四行和第八行可以去掉
  (action => {
    console.log('dispatching', action)
    store.dispatch(action) // 这里是loggerWithStore的next(action)
    console.log('next state', store.getState())
  })(action)
}
```

这里我们可以看出以下结论:

+ 只有每个middleware都调用next, 最后一个next就是最初的store.dispatch, 而每个middleware对dispatch的包装也都会依次执行.
+ compose说是从右到左组合方法, 但后组合的方法会被先执行, 所以直觉上, 传入compose的方法会被依次调用.

+ 只要有一个middleware不调用next方法, 原来的dispatch将不会被触发.

  (所以如果thunk里dispatch一个方法, 这次dispatch就断掉了, dispatch一个方法其实是一次假的dispatch, 只是可以做到把异步请求从业务代码里移到actionCreators里而已.)

最难的地方已经结束, 如果已经看懂, 那么下面的推导也非常容易:

```js
// 现在是这样
store.dispatch = thunkWithStore(loggerWithStore(store.dispatch))
// 使用compose以后:
store.dispatch = compose(thunkWithStore, loggerWithStore)(store.dispatch)
```

applyMiddleware的核心部分已经说完, 最后再进行2个小改造就完事了:

+ 先用一个空方法代替真正的dispatch, 防止在middleware构造的过程中调用造成死循环.
+ 因为每个middleware都会造成好几层闭包, 为了避免重复加载, 不让用户自己写`store.dispatch = xxx`, 把apply的动作和createStore绑在一起.

这个改动会使applyMiddleware和createStore产生一些联动, applyMiddleware被传入createStore后, createStore会用applyMiddleware的返回值改写自己, 用改写后的自己重新调用剩余参数. 所以文档里的写法是:

```js
const store = createStore(reducer, initState, applyMiddleware(mdw1, mdw2))
```

我们也可以把它写成:

```js
const store = applyMiddleware(mdw1, mdw2)(reducer, initState)
```

(那好像文档的写法好看很多.)

## 其他

在过程中有个小插曲, 因为自己菜一直没看懂一个基础的东西:

```js
let dispatch = () => console.log('empty function')
let middlewareApi = {
  getState: store.getState,
  dispatch: (...args) => dispatch(...args), // 为什么不是 dispatch: dispatch
}
let chain = middlewares.map(middleware => middleware(middlewareApi))
dispatch = compose(...chain)(store.dispatch)
```

如果改写成`dispatch: dispatch`, 最后一句的重新赋值就会无效.

在询问了大佬后知道了是引用方式不同. 那么怎么区别什么状况下是什么引用方式呢, 我发现了个比较好的办法: console.log.

```js
let log = () => console.log(1) // 定义log方法, 通过不同引用, 之后改写尝试是否被改掉
let quoteValue = {log: log} // 值传递
let quoteAddress = {log: () => log()} // 地址传递

quoteValue.log // () => console.log(1)
quoteAddress.log // () => log()

// 从上面已经看得出, 如果log方法改变, quoteValue.log调用还是老的, 因为老的值已经被传给他了
// 而quoteAddress的行为是调用log, 所以log变成什么样, 他都会调用新的log.

log = () => console.log(2)
quoteValue.log() // 1
quoteAddress.log() // 2
```

最后献上一段完整demo.

```js
// core
const createStore = (reducer, initState, enhancer) => {
  if (enhancer) {
    return enhancer(createStore)(reducer, initState)
  }
  let state = initState
  const getState = () => state
  const dispatch = action => state = reducer(state, action)
  return {
    getState,
    dispatch,
  }
}

// helpers
const bindActionCreators = (actionCreators, dispatch) => Object.keys(actionCreators).reduce((result, key) => {
  result[key] = (...args) => dispatch(actionCreators[key](...args))
  return result
}, {})

const combineReducers = reducers => (state = {}, action) => Object.keys(reducers).reduce((reducer, key) => {
  reducer[key] = reducers[key](state[key], action)
  return reducer
}, {})

const compose = (...funcs) => funcs.reduce((a, b) => (...args) => a(b(...args)))

const applyMiddleware = (...middlewares) => (createStore) => (...args) => {
  let store = createStore(...args)
  let dispatch = () => console.log('empty function')
  let middlewareApi = {
    getState: store.getState,
    dispatch: (...args) => dispatch(...args),
  }
  let chain = middlewares.map(middleware => middleware(middlewareApi))
  dispatch = compose(...chain)(store.dispatch)
  return {
    ...store,
    dispatch,
  }
}

// sample
const initState = {
  count: {
    value: 0,
  },
  status: {
    value: true,
  },
}

const count = (state, action) => {
  switch (action.type) {
    case 'increase':
      return {
        value: state.value + (action.payload || 1)
      }
      break
    case 'decrease':
      return {
        value: state.value - (action.payload || 1)
      }
      break
    default:
      return state
  }
}

const status = (state, action) => {
  switch (action.type) {
    case 'switch':
      return {
        value: !state.value,
      }
    default:
      return state
  }
}

const reducer = combineReducers({ count, status })

// middleware
const thunk = store => next => action => {
  let result = typeof action === 'function' ? action(store.dispatch, store.getState) : next(action)
  return result
}

const logger = store => next => action => {
  console.log('dispatching', action)
  let result = next(action)
  console.log('next state', store.getState())
  return result
}

// action creator
const inc = num => ({
  type: 'increase',
  payload: num,
})

const delayInc = num => dispatch => {
  setTimeout(() => {
    console.log('start dispatch')
    dispatch({type: 'increase', payload: num})
  }, 500)
}

// exec

const store = createStore(reducer, initState, applyMiddleware(logger, thunk))

const actions = bindActionCreators({inc, delayInc}, store.dispatch)

actions.inc(2);

actions.delayInc(5);
```

