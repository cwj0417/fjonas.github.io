---
title: 前端知识整理
date: 2021-02-24 18:18:22
categories: 工作笔记
tags: [javascript,immer,vue,webpack,http,react]
---
前端知识整理一波, 会则复习不会则补.

<!--more-->

## 总则

这里打算整理狭义上的前端内容: 基于html, css, js的前端. 而在这三者间有交叉的技术和生态和衍生, 还有靠近的服务端相关的知识.

+ **html**指在浏览器上运行的页面. 所以知识点包含浏览器的相关行为:

  + http相关, 请求的类型, 缓存, 跨域.
  + 浏览器渲染html相关: 加载顺序, 绘制/重绘机制.
  + dom, bom相关: 浏览器提供的api, event loop和渲染的关系.

+ **css**的知识我认为分2块, 第一是对css系统的认识, 不同的块流, 文本流, 布局等. 第二是零碎的情况的知识. 至于前沿的css语法我认为不属于基础也不那么重要. 预编译的css算是个类似语法, 预编译的过程其实属于工程化.

+ **类html,css**第一个想到的是小程序. 是一系列其实不是html和css但模拟语法让干前端的人能做的事.

+ 涉及到node服务端的常用点有开发时服务器, ssr, 前后端分离解决跨域的转发服务器.

+ 语言**javascript**. 虽然ts是js的超集, 但我还是把它归类为js. 语言的范畴是数据类型, 作用域/闭包, 原型链, 数据结构, 算法等. 不包含bom, dom相关的api和特性.

+ **工程化**包含webpack, babel, 到部署运维. 

  + ts, jsx, es+, vue文件都是不能直接在浏览器上抛的, 就必须用到编译器.
  + 代码的压缩, 复用代码的组织必须用打包工具. 开发的时候也需要用开发工具而不像以前保存刷新. 
  + 部署运维更偏向于每个公司内部的部落规则, 但也有一些微前端框架. 

  以上各个工具化现在主流的webpack, rollup, vite的使用和区别. 还有零散和过时的工具grant, gulp, parcel, snowpack, yoemen(vscode在用)啥的. 工具的区别是基于不同的打包目标, js不同模块引入方式(amd, cmd, umd, esm).

+ 框架我只用过vue2和react. 框架的了解分2个方向, api和源码. 其实在效用上两者重要程度说不清高地, 但现在一般的标准是: api是默认全懂, 源码才可聊.

  当然也只有读了源码才知道框架的原理. 源码阅读也分2个方向, 主流程和细节. 我建议先流程后细节的. 而最佳方式是带问题读.

+ **优化**, 无论是html, 首屏, webpack速度, 框架, 数据结构. 本质都是使行为更合理, 减少浪费. 所以优化本身不能作为一个知识点, 而是一个话题. 想优化就要去理解和深入各个知识点本身.

另外[手写代码合集](https://github.com/cwj0417/sxdm)**直接在github上**.

那么接下来就(不太全面地)分模块, 复习一些基础问题. 

## javascript

### 作用域与this

函数的执行有执行栈, 栈底是全局作用域, 执行的时候创建作用域并入栈, 执行完毕出栈.

在创建作用域的时候:

+ 决定this的值: 谁调用this就是谁. (箭头函数找上一层)

+ 决定环境中变量的实际地址. (非全局作用域多一个arguments, 全局的多一些原形函数)

  变量提升的原因是: var被当做变量处理, let和const被当做词法处理.

+ 决定外部引用环境. (作用域栈的下一个, 变量找不到会去这里找) 全局的外部环境是null

### event loop

执行栈是函数执行而来的, event loop是决定函数执行顺序的, 也决定了ui渲染和各个来源函数执行的顺序.

浏览器中除了promise是微任务, 其余全是宏任务, 包用户输入, setTimout, callback.

宏任务有多个队列, 微任务只有一个队列. 表现为无论在执行宏任务还是微任务, 执行完都会检查微任务队列.

所以如果有比较难分辨的情况, 我认为难点在于要理解: **宏任务有多个队列**. 要分清那几个任务是在同一个队列里的. 这里贴一个题目.

```js
setTimeout(function(){
    console.log('定时器开始啦')
});
new Promise(function(resolve){
    console.log('马上执行for循环啦');
    for(var i = 0; i < 10000; i++){
        i == 99 && resolve();
    }
}).then(function(){
    console.log('执行then函数啦')
});
console.log('代码执行结束');
```

### 原型

+ 原型: **\_\_proto\_\_** 属性是个accessor属性, 实际是Object.getPropertyOf和Object.setPropertyOf.

+ 隐式操作: 平时的字面量对象, `.`操作取值, 赋值. 实际都有隐式操作. 取值会往\_\_proto\_\_找, 赋值如果当前变量没就创建. 

  字面量创建的对象有默认\_\_proto\_\_, 并不是空对象. 用es6省略value会创建null为原型的对象.

+ 构造函数: 所有函数都会被挂上prototype属性. 这个属性会在被new的时候作为实例的\_\_proto\_\_. 内容是: {constructor: 自己, **\_\_proto\_\_**: Object.prototype}, 在继承的时候\_\_proto\_\_是父对象的constructor, 构造函数的\_\_proto\_\_也是父对象的构造函数.

+ class的extends/寄生组合式继承: 子类的\_\_proto\_\_的父类, 子类的prototype的\_\_proto\_\_是父类的prototype.

+ 一些基本对象(Object, Array, Function等)的关系可以自己用\_\_proto\_\_和===和instanceof去画关系.

### ts

ts这个标题太大, 而且特性/配置都是跟版本的. 就列一些点.

+ keyof: 对象的结果是键的联合类型, 数组是number|数组方法的联合类型, any是string|number|symbol
+ infer. extends一个泛型接口时需要临时定义的泛型名字.
+ 工具类Partial, Record, Pick, Exclude, ReturnType的实现.
+ interface和type的区别: 语法/implements/联合类型/extends.
+ ts特性: 只检查结构, narrow down, 类型之间有包含关系.

## css

### BFC

BFC是一个布局环境, 有一定的规律, BFC内部可以嵌套另外独立的BFC.

BFC里的盒子按照常规流从上到下排布, 可能出现margin重叠(这个问题可以用嵌套个新BFC解决).

跟元素就是个BFC, 创建独立BFC的条件是float, position, overflow, flex等.

### 盒模型

标准盒子是content-box, IE盒子是border-box. IE盒模型的width多包含了padding和border.

其实设计图的尺寸一般是IE盒模型写起来比较方便.

### z轴顺序

从下到上如下图, 注意的是层叠上下文也是上下文, 也BFC一样有嵌套.

1. background/border
2. z-index负值
3. 块元素
4. 浮动元素
5. 行内元素
6. z-index: 0, auto
7. z-index正值

## webpack

### 主流程

1. 从配置文件和命令行参数读取并merge得到配置.
2. 用loader读取资源, 然后收集依赖关系, 分析成ast.
3. 组装成chunk, 输出.

### loader和plugin

loader用来读取不同文件, 是一个函数, 接受参数为文件字符串, 输出js或能被下个loader读取的格式. (估计是用compose来组合的, 所以是从右到左.)

plugin是通过tapable的发布/订阅系统, 在编译执行的不同步骤会调用不同钩子, 主进程compile, 每个模块的进程compilation. 写法是一个class并含有指定的方法.

自定义loader和plugin的使用还是比较有意思, 比如可以loader给代码加全局catch并发送错误报告给后端.

### tree-shaking和scope-hoisting

在webpack5(可能从4开始)后, production模式是直接开启的, 要求都是纯esm输入.

执行的时间是编译形成ast后, 分析并改变依赖树.

区别: tree-shaking是和"是否被引用到"有关, scope-hoisting是和"代码是否可以简化"有关.

### 和rollup的区别

rollup功能少所以配置少, 适合打纯js.

webpack系统比较复杂, 可以打任何品种的文件(css, 图片, 字体, .vue, 任何), 因为loader.

但是webpack不能打出esm包, 所以打算发到npm上给别人用的尽量rollup打.

### 优化

优化的本质是让事情更合理, 所以一般通过3个点.

+ 把工具(webpack)升级到更高版本, 让专业的人为自己做事.
+ 用各种插件, 也是让专业的人为自己做事. (然后合理的插件会被加入默认配置)
+ 自己代码写好点, 根据自己的需求减少不必要的配置. (这个是可以通过了解webpack来做到的事)

### babel

babel的流程和webpack类似. 读取配置/插件, 代码转ast, 根据配置输出.

## 优化

其实优化包含的方面特别多, 而不是什么优化都去做的, 实际场景中优化其实出于2个场景: 第一有地方明显卡顿要求优化, 第二系统性优化. 但其实核心思路都是: 找出最卡的点. 找出的方式第一步是肉眼, 第二部是调试工具.

优化除了一些工具, 代码写得好也非常重要, 好的lib作者写代码还会考虑到是不是能被tree-shaking和单元测试覆盖. 以下说的是代码之外的一些东西.

### webpack优化

webpack优化包含prod和dev阶段. 

prod阶段目标是减少包体积(tree-shaking和scope-hoisting)和code spliting(为首屏).

dev优化是目标是加快编译流程, 配置hmr.

还有一些根据项目通用的优化, webpack默认配置范围比较大, 而项目一般会narrow一些.

比如配置alias, 项目只有ts文件, 就配上对应的alias. 配置includes/excludes, mainFields.

### 首屏优化

首屏优化有2个角度, 网络级别, 代码级别.

我们先关注代码级别的, 代码级别优化的本质: **先只加载用户一眼看到的东西.**

所以方法有: 用webpack的动态import(框架的router有做), 图片懒加载, 虚拟表格(有不可搜索这个缺点), 先加载skeleton.

动态垫片减少不必要的垫片.

首屏ssr也能提升性能和seo, 但是成本较高, 还要做slb和监控.

## web渲染流程

### "输入url到页面展示"

解析dns => 通过tcp建立http连接 => 发起请求 => 接受数据 => 断开http连接 => 渲染页面

各个点都可以展开很多, 这里整理一下我认为和其他知识对应的深度.

### http

在网络模型中, http协议属于应用层(5或7), 下层的传输层(4)是tcp协议, 网络层(3)是ip协议.

建立连接和断开连接都用tcp进行, 就是传说中的三次握手四次挥手.(断开的过程第三次挥手是服务端发起的).

http1.1默认开启了keep-alive(默认头), 作用是减少建立和断开连接发送的tcp请求. 而是不是支持得看服务器, 协议两端的交互就像打电话的2个人.

### 渲染网页

浏览器渲染网页总体有几步, 但不同浏览器实现其实不同.

1. 把html parse成dom树.
2. 把css parse成样式树.
3. 通过以上2树, 构造呈现树. dom树和呈现树结构并不相同, 有些标签(head, meta, display为none等)不显示, 而有些标签(select, title属性等)会产生多个呈现树.
4. 通过呈现树计算, 布局. 
5. 绘制.

然后在元素发生变化后分为部分渲染. 其实前端理解以后能做的优化就是: 减少渲染次数, 而这个事情框架里都做了.

### 跨域

#### 什么情况会发生跨域

 协议, 端口, host(任意级)只要有一个不同就[跨域](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).

#### 什么请求会发生跨域

+ js发起的请求. (通过XMLHttpRequest和fetch)
+ 字体.
+ WebGL texture.
+ canvas通过drawImage画的image或者video. (会把canvas变成被污染的状态, 不能toDataUri了)
+ css里的`url()`.

#### 如何让跨域请求顺利

设头, 请求端和服务端都要设. 都是Access-Control-开头的.

如果要带上cookie, 加个头withCredentials: true.

#### preflight请求和简单请求

在发起非`简单请求`的跨域请求前, 浏览器会发起preflight请求, method是options, 来确认是否支持即将进行的请求.

`简单请求`的条件比较复杂, 要同时满足: 

+ method是get, post, post之一
+ 只能手动设某几个请求头: Accept, Accept-language, Content-language, Content-type.
+ Content-type只允许几个值: text/plain, multipart/form-data, application/x-www-form-urlencoded.
+ XMLHttpRequest发起的请求不能监听upload事件.
+ 请求中没有ReadableStream.

这些要求正常人是背不出的, 所以只要基础**简单请求是幂等请求**, 非简单请求是会对服务器数据造成改动的.

#### 额外的解决方式

几个通常的非正常解决方案:

+ jsonp. 通过非`会发生跨域的请求方式`(上面提到的)来发起跨域的请求, 比如append script.
+ 前端服务器转发. 这个通常是下属地, 带配置host功能的转发服务器.
+ 网关转发.

### 缓存

缓存就是根据一些头信息, 来决定是否可以用本地缓存数据来替代发起一次新http请求. 浏览器http缓存分2种:

+ 强缓存: 通过expires, cache-control等头, 如命中, 直接用缓存, 状态码200, (from disk cache).
+ 协商缓存: 通过last-modified, e-tag, if-none-match来判断, 请求会发出, 如命中, 服务器不传输内容, 返回状态码304来使用缓存.

### 事件流和事件委托

事件流从document流向目标, 再流向document.

addEventListener最后一个参数可以调整从哪个角度获取事件.

stopProgration和preventDefault能组织捕捉/冒泡.

事件委托指, 要给一系列子元素增加事件, 就给他的父元素增加事件, 然后通过event的字段来判断是哪个子元素.

事件委托的原理是利用事件冒泡, 优点是不用重复注册, 以及子节点变化的情况无须重新注册.

## 安全

### xss

cross-site scripting, 通过给html输入脚本来攻击, 防止的思路是: 要放到html上的输入要小心. 处理方法就是转义. 一般容易攻击的输入有: url, cookie, 输入框. 总之不要相信用户输入.

### csrf

cross-site request forgery, 在被攻击网站登录状态下, 第三方网站向被攻击网站发起请求, 这样会带着身份信息. 通过不接受跨域请求来防范.

## 框架

vue和react后续再看.

