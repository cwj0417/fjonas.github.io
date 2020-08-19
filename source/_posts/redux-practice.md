---
title: redux实践思考
date: 2020-08-16 14:38:27
categories: 工作笔记
tags: [react,redux]
---
在工作中持续使用react, redux. 并且对相关生态走马观花, 发现之前对redux的定位不太准确.

<!--more-->

## 一些令人不适的地方

众所周知, 在有了第一个项目以后, 之后的项目基本是`cv模式`. 然后在此之上修修补补, 也不会对祖传代码提出质疑, 毕竟p7p8都没说啥. 但总也有些小地方让人觉得有些疑问的.

### 关于action types

 关于action type, 是我一直不太满意的. 其原因有二:

1. 每次新增一个reducer, 就需要在1个地方定义type, 2个地方引入type. 这样就要**定位3个文件, 并打开**, 找文件真的是我的噩梦.
2. const要大写, 我滴妈呀, 本来英语就垃圾的我, 看到大写英语根本就不知道是什么意思. 但是type要用大写来表示这是一个type.

这些问题我从来不问p7p8, 我讨厌听到**我已经知道, 但是并不能说服我**的一本正经理由. 这些"有的没的"的问题, 我偶尔会和关系很好的同事随口提起, 得到的结果和我经历的差不多: **觉得不爽, 但是感觉是一种规则, 需要遵守.**

(顺带一提无关的东西, 还有一个类似的问题, 为什么一些我觉得不需要redux的地方也用了redux, 我倒得到了我能接受的观念, 这个本文先不提.)

### 关于combineReducers产生的模块

我在上篇分析redux代码的时候已经对`combineReducers`有了比较明确的理解, 于是在实践中思考和证实了:

> ​	dispatch一个action, 所有模块的所有reducer都会调用一遍.

这样就产生了2个不爽的地方:

1. 根本不在页面上的reducer都要去跑一遍. 根据redux的三大原则之一: 一个应用只能有一个store. 所有的reducer必须都注册在一个store下.

   所以假设我在首页触发了一个"设置用户名"的reducer, 这个action会去碰撞所有其他页面(可以是订单/列表/详情/分页等所有reducer)

2. 所有`action type`必须从同一个文件里引入, 不然const来避免type重名导致难以检测的bug就毫无意义.

而我公司现在使用的"实践模式"是: 在"模块文件夹"下有一个自己的状态管理文件夹, 每个模块有自己的actiontype文件. 那也就是说: 这个模式是明显有问题的, 在这种级别的问题下, action type也变得毫无意义, 只有增加工作量和恶心人的用处.

### 思考

我很确定, 以上的"问题", 并不是redux导致的, 而是`combineReducers`导致的, 但这个辅助函数也是redux官方提供的, (曾经有大佬说过, 向官方挑战结果基本是: 体会到自己的渺小) 那么为什么官方的辅助函数会产生这样的问题呢, 是没有考虑多层结构吗? (不, 本来就是为多层结构设计的)

我看了一下`combineReducers`的实现, 发现他实际做的比文档里多了2点:

1.	尝试调用每个reducer, 并判断一些输入结构与预期不符的情况.
2.	用`hasChanged`标志来判断state前后是否变化.

这2点做法我都暂时体会不到意义, 也许这个函数本来就没打算做成"全"的, 而只是一个细胞, 只是我们不该直接把细胞直接用在项目里.

## 与vuex比较一下

之前我一直认为: redux对于react的意义, 是和 vuex对于vue的意义差不多的.

但这是错的.

我们来是比较一下概念. 首先vue和redux都是基于flux的, 所以基本概念是差不多的, 所以比较的行为是合理的.

|       | 数据储存对象 | 改变数据              | 异步操作             | 模块化            |
| ----- | ------------ | --------------------- | -------------------- | ----------------- |
| vuex  | state        | commit 触发 mutation  | dispatch 触发 action | module            |
| redux | state        | dispatch 触发 reducer | ???                  | (combineReducer?) |

我们会发现:

1. redux的action呢? dispatch一个action, 触发的是reducer. 也就是**vuex里没有对应redux里action的概念**, 如果硬说的话, 就是"mutation的type". 或者说是mutation的键.

2. redux本身没有任何对应vuex的action的东西.
3. combineReducer只是用了js特性, 但勉强能和vuex的module比较.

### redux的异步操作

redux似乎没有提供异步操作的概念, 那么如果**希望不在业务层写接口url, 只有依靠外部lib了.**

那么市面上用得最多的lib就是redux-thunk和redux-saga了.

所以上面表格中的`???`可以写成: `dispatch触发thunk`或者`dispatch触发saga`.

那么让人不爽的东西又来了: `dispatch`? 又可以触发reducer, 又可以触发thunk和saga?

是的, 没错, 因为他们都是利用了redux的middleware机制来"改写"dispatch行为, 具体的去看上篇文章.

**thunk和saga的本质其实都是: 中断dispatch操作, 写自己的业务逻辑, 然后在合适的时机dispatch触发真正的reducer.** 这也可以解释: 为什么logger和thunk不同顺序加载, 看到的log信息是不同的. 因为thunk中间件**中断**了dispatch操作.

换句话说: **thunk/saga不单独写成方法供业务调用的原因只是: 他们需要从中间件中获取dispatch方法而已. **

redux的这个middleware机制, 让一开始`cv`写代码的redux新人, 会写出"在thunk里只dispatch一个action"的代码, 事实上这样的代码是不需要走thunk的, 直接return一个action, 而不是function.

### redux与vuex定位区别的总结

| redux                                                        | vuex                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| 一个js写的数据结构库, 任何ui框架都可以使用, 虽然是为react打造的, vue和小程序等也有实践案例 | 一个vue专属的数据管理库                                     |
| 在react中使用需要用react-redux库来集成                       | 内部实现直接利用vue实例的特性, 在一些地方还显式调用vue的api |
| 只负责 mutate state, 其他功能要通过middleware让社区实现      | state, mutation, action, module全包                         |
| 灵活, 可有不同实践                                           | 可操作性少, 实践单一                                        |

redux和vuex是典型的同质对立的库, 一个追求灵活和更大的可能性, 一个给用户更舒服顺畅的体验.

我们在实际使用中确实体会到了这样的感受: vuex使用顺畅, redux感觉需要些很多代码来初始化, 并且有很多不同的实践.

## 总结

经过了以上对redux的观察, 总结一下对react观念的更新:

### redux是一个纯js, 提供一种数据流模式的库.

优点是: 可以充分利用各种js特性来产生不同的实践, 第三方开源作者应该感到巨大的兴奋.

缺点是: 在项目中, 必须结合自己项目情况, 选择一种实践, 如果不思考实践方式, 就会导致"要写很多业务无关的代码"的问题.

### redux实践操作方式有3个方面

1. reducer, action的组织, 编写辅助函数.

   这个实践要根据项目目录结构, 来把所有项目的reducer和action组合到一起. (因为redux原则是1个根store)

   在这个实践中可以解决"action type是否需要", "action type是否可能重复导致难查的bug"问题.

2. 改变store的增强器.

   这个类型的改变是通过middleware进行的, 原因也很简单: 要获取dispatch来最终改变store.

   比如异步操作, 事务, immutable原则等就是在这里操作的.

3. 和ui框架的数据关联.

   一般的redux实践库里都有个connect方法, 一般是个高阶函数, 来让ui框架和redux进行联动.

之后去思考或者参考别人的实践, 应当也是从这3个方面分别去看.

当然也有把这些都整合起来的实践巨兽, 但本质还是从基本方面入手的.

### 市面上流行的周边

经过一些网上冲浪, 获得了一些周边的名字.

+ redux官方提供的2个库: `react-redux`, `redux-toolkit`.

  `redux-toolkit`是一个很全的lib了. 虽然只有4个方法.

+ 管理业务异步操作的: `redux-thunk`, `redux-saga`.

+ 一整套大保健: `dva`.

其实还找到了许多没名气的小实现, 以及同事推荐阿里新搞的基于hooks, 替代redux的`hox`.

这些库可能都会慢慢看, 一篇博客肯定下不下, 所以提个名字都不展开了.

最后, 还有3个同质的数据操作辅助函数库. `updeep`, `immutable.js`, `immer.js`. 粗看起来, `immer.js`是最强的. 体现方面是api和性能. 调研这些lib也作为todo了.