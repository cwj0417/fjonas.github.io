---
title: 将react项目迁移到hook和ts
date: 2020-06-28 22:05:16
categories: 工作笔记
tags: [react, hook, typescript]
---
手里有一个没有历史包袱的react项目, 就成为了上hook和ts的好机会, 这里总结一下hook和ts最浅的实践.

<!--more-->
首先做一个迁移后总结: hook和ts的初级使用非常简单, 而高级使用可能也没这么难, 总之比之前估计的难度要低很多.

本文做最简单的介绍和使用, 没有写的细节都在[hook](https://reactjs.org/docs/hooks-intro.html)和[ts](https://www.typescriptlang.org/docs/handbook/basic-types.html)的文档里.

## hook

### hook的形式

之前react有2种组件形式, 叫做class components, stateless components.

而现在改名成: class components, function components.

也就是: function components现在可以拥有state了, 就是hook给予的功能, 同时hook也给予了function components**大多数**class components可以实现的功能.

所以hook的基本形式就是基于FC, 增加了一些方法, 来丰富了FC可实现的功能.

### hook的优缺点

官方说的优点是:

1. function比class更容易理解.
2. 含有多个业务逻辑的大组件, 可以从分块整理, class components只能聚在一起.
3. 比hoc, render props的集成方式更友好, 更灵活.

后2条优点的思路是一样的: 都是利用了function的优势, 只要能提供实现一样功能的可能性, 那么FC就会更方便更灵活.

我认为的缺点是:

1. 并不能实现class components的所有功能.
2. 一些行为和class components不一致.
3. react devtools的调试体验不习惯.

### hook迁移经验

把class组件替换成function组件, 第一步就是把class改写成function, class中的this都去掉, class的方法写成内部function. 另外render函数的返回值, 直接作为function组件的返回值即可.

剩下的就是用hook来替代原先的一些功能:

1. `useState`用来替代state. 

   需要说的是, 这里可以根据具体需求来分成任意个state块. 然后在react devtools里看起来是和class的state不同的.

2. `useEffect`用来替代3个生命周期函数. 

   第一个参数function会在初始化执行, 他的返回值函数(如果存在)会在销毁时执行. 第二个参数来判断是否需要在组件更新时执行第一个参数. 

   需要注意的是, 和`useState`一样, 他也可以被分块, 使复杂页面的代码看起来更清晰, 维护更方便.

3. `useContext`, `useRef`也比较常用. 作用是class组件中的context和ref.

4. `useLayoutEffect`的存在是因为`useEffect`和`componentDidMount`执行时间是有差异的, 一些要获取dom的方法需要用这个.

另外, 有个`useReducer`, 这个和redux并不是一回事, react-redux提供了一些hook, 但也不是必用的, 直接用connect就可以了.

### 更多场景

迁移的过程都是用了hook的基本功能, 接下来要尝试的是用hook代替hoc和render props来抽取一些逻辑.

hook比hoc好的地方是, 使用方法是引入和调用, 而不是要嵌套dom.

那么自定义hook可以复用, 就涉及到了作用域问题, hook是如何控制作用域的, 内置的hook是如何编写的, 这个留给下次仔细深入.

## typescript

ts的作用是强制js类型, 是一种编译时工具.

### ts的形式

是现在使用的所有js的超集. 所以在形式上, 之前的js都兼容, 不用改语法, 只是增加一些内容.

在原有js上增加了哪些内容呢? 分为2个部分:

1. 在js变量后规定类型. 

   如: `let n = 1` => `let n: number = 1`.

2. 定义类型.

   基本类型只有那几个, 那如果有一些项目特有的实体, 接口等. 就会自己定义一些, 使用`type`或者`interface`关键字.

   如: 

   ```typescript
   type phoneSeries {
   	series: string
   	version: number
   }
   let iphoneX: phoneSeries = { serires: 'iphone', version: 10 }
   ```

所以ts比js就多了这2部分内容. 其他需要学习的就只是一些类型之间互相关系的概念.

接下来说我在用ts过程中思考过的2个问题.

#### 泛型

在尖括号出现的地方, 有2种可能, 一个是定义泛型, 一个是使用泛型.

使用泛型是一些预定义的泛型接口或者泛型类, 在学习概念的时候没理解这点, 以为所有尖括号都是定义泛型, 于是没理解.

#### type和interface的区别

1. 定义直接的变量, 只能用type. 例如:

   ```typescript
   type age = number
   type add = (base: number, increasement: number): number
   ```

2. 联合类型只能type.

3. implements 只能interface.

### ts的优缺点

几天以来使用ts的感受非常好, 缺点有2个: 需要学习, 需要配置工程化.

但工程化是一次性的, 或者可以用别人的. 就算没学好, 直接都any. 特别需要的地方定义类型就可以了.

所以在我看来上ts是好处远大于缺点的. 接下来说说**实际使用中体会到的优点**.

1. 相比eslint更能分析语法上的错误.

   在迁移ts的过程中, 发现很多ts报错的地方, 确实代码有非常大的问题, 没出bug只是运气好.

   即使不定义类型, ts有许多内置类型, 并有类型推导功能. 在一些操作`localStorage`等有副作用的代码, ts就能判断出没有写滤空.

2. 使用组件时不用看文档了.

   这点在开发上省去了很多时间. 有一个场景: 某个组件库的Api因为版本升级改变了, 于是ts直接报错, 并且按着cmd或者ctrl, 可以直接看到现在有哪些Api.

3. 体验很好的生态.

   上一条优点, 是基于那个组件库是用ts定义了类型的情况. 而当更多的引用都是基于ts的, 开发的时候感觉就会特别开心. (因此完全成为了vscode粉)

### ts的迁移经验

1. 在业务偏重的项目里, 我认为大多数地方用any就可以了. react预制的泛型类也都传any就可以.
2. 在工具类和presentational组件尽量多地使用ts. 组件的react泛型类传入自定义的interface来替代proptypes.
3. 很多lib都有ts使用手册, 有一些类, 了解后使用.