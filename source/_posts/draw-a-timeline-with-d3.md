---
title: 用d3来画一个时间线
date: 2017-07-13 11:37:04
categories: 工作笔记
tags: [d3,svg,入门]
---
数据可视化不再是简单的表格, 现在慢慢地接触了解到许多数据可视化的js库, d3, processing.js, three.js, highcharts, echarts等.

本文将用基于svg的时间线例子使用d3, 先介绍api随后介绍实例中api的应用.

<!--more-->

## D3

[d3](https://github.com/d3/d3)是一个粒度很细的的lib, 比起echart算是工具类的lib. 之后的例子会有感性认识.

d3的[api](https://github.com/d3/d3/blob/master/API.md)在4.0版本被划分成多个子模块了. 这些子模块其实功能各异, 下面例子要画的时间线使用了操作dom的模块, 数学计算的模块, 选区的模块, 各个模块的性质都是不同的.

d3官方有一个[作品展](https://github.com/d3/d3/wiki/Gallery)有的需要购买, 可以看到效果和代码, 用作出作品或者学习.

按照惯例, 我开了一个[repo](https://github.com/fjonas/d3-v4-learning)来放一些学的时候的demo. 下面开始来看看一部分画时间线用到的模块.

### d3-selection

#### select

[d3-selection](https://github.com/d3/d3-selection)是一个操作dom的模块. 选择器有2个方法, `d3.select()`与`d3.selectAll()`, 结果类似于`document.querySelector`和`document.querySelectorAll`, 选择器也相同, d3的selector返回的是一个`selection`, `selection`也拥有`selection.select()`和`selection.selectAll()`方法, 区别是在当前selection查找.

`d3.select()`也可以把普通dom转化为d3`selection`.

#### modifying

d3`selection`有一些修改节点属性的方法: `.attr()`, `.style()`, `.text()`, `.html()`, `.append()`, `.insert()`… 直到这里, d3-select 还是浓重的jquery味道,

还有一些`.on`处理事件, 用法也是不看文档就能猜到的.

#### data joining

这个特性就比较有意思, 是data driven的特性. 流程是: 选择dom => 绑定数据 => 渲染子dom. 渲染子dom的时候每个dom都带着了绑定了的数据.

一开始对三个东西比较疑惑: `.enter()`的意义其实是"获取被装载过data的空selection", 而不是"进入"这个动作.

而`.exit()`的意义是"获取已经没有数据并正被渲染的dom", 而不是"退出"这个动作. 另外`.merge()`也不是想象力的merge. 

官方推荐了一个[博客](https://bost.ocks.org/mike/join/)和一个[示例](https://bl.ocks.org/mbostock/3808218). 我们来看一下每次渲染的代码:

```js
 var text = g.selectAll("text")
    .data(data);
 // 选择现存的dom, 并绑定数据
 // 如果没有旧的dom, 选择器将返回带有数据的空的selection, 注意带有数据的selection就有enter和exit方法

  // 如果存在旧dom, 更新class属性
  text.attr("class", "update");

  text.enter().append("text") // 获得需要插入的dom, 在这些dom上新增text节点
      .attr("class", "enter")
      .attr("x", function(d, i) { return i * 32; })
      .attr("dy", ".35em")
    .merge(text) // 更新数据
      .text(function(d) { return d; });

 text.exit().remove(); // 获取到已经没有数据的dom, 并移除
```

### d3-scale

[d3-scale](https://github.com/d3/d3-scale)是一个计算刻度比例的计算库. 数据中的年份/距离/颜色需要映射到实际屏幕尺寸.

scale有许多类型. 线性, 幂, 对数等scale类型. 在示例中我用了线性scale, 应该也是最常用, 最简单的scale.

#### linear scale

线性scale顾名思义, 把数据进行线性映射, 画一个`y = kx + b`的直线来映射数据与实际尺寸的关系.

#### 创建scale

每个scale都需要被创建, 我们以linear为例.

```js
const scale = d3.scaleLinear()
    .domain([10, 130])
    .range([0, 960])
```

其中`.domain()`接受数据的范围, `.range()`接受实际尺寸的范围. `.range()`还接受颜色, 可以把颜色与数据对应来把数据显示成对应关系的颜色.

#### 使用scale

刚才的代码我们获取了`scale` . 直接调用`scale()`传入数据值, 返回对应的实际尺寸值.

而如果通过[brush](#d3-brush)获得了当前屏幕的尺寸, 需要知道对应了什么数据. 可以调用`scale.invert()`来获得反函数的值.

```js
scale.invert(80); // 20
scale.invert(320); // 50
```

### d3-brush

[brush](https://github.com/d3/d3-brush)是用来在d3的selection中创建选区, 配合scale的`.invert()`方法来获取选中的数据并作处理.

下面来说一些概念.

#### 创建brush

创建brush有3个方法, 对应着3种brush, 分别为`d3.brush()`, `d3.brushX()`, `d3.brushY()`. 

#### brush的方法

+ **move**: 设置brush的选区. 拖动brush即可改变选区, 而move方法可以通过代码改变brush的选区.
+ **extent**: 设置brush的选区范围.
+ **filter**: 设置哪些地方是不可以新建选区的.
+ **handleSize**: 设置brush尺寸
+ **on**: 监听时间, 分别有`start`, `brush`, `end`三个事件, 一般只用`brush`, 在brush互相调用的时候需要使用别的事件来防止无限循环.
+ **brushSelection**: 获取selection的值. 这个是用在brush事件回调里, 有个参数是node, 调用这个方法就可以获得brush状态, 并用[scale](#d3-scale).invert来获取圈选的对应的数据.

#### 装载brush

在需要装载brush的`selection`上调用`.call()`方法来装载brush.

## SVG

svg是一个用xml定义的矢量图形. svg有各种标签, 各种标签有各种style. 来介绍一下时间线用到的svg标签.

### line

line是画一条线. 俗话说得好, 两点确定一线.

**属性**

- x1 属性在 x 轴定义线条的开始
- y1 属性在 y 轴定义线条的开始
- x2 属性在 x 轴定义线条的结束
- y2 属性在 y 轴定义线条的结束

### rect

画一个正方形. 属性比想象的多一点点.

**属性**

- rect 元素的 width 和 height 属性可定义矩形的高度和宽度
- style 属性用来定义 CSS 属性
- x 属性定义矩形的左侧位置（例如，x="0" 定义矩形到浏览器窗口左侧的距离是 0px）
- y 属性定义矩形的顶端位置（例如，y="0" 定义矩形到浏览器窗口顶端的距离是 0px）
- rx 和 ry 属性可使矩形产生圆角。

### path

随意画线.

类似于canvas的lineTo moveTo画线.

path接受一个attribute`d`, 有以下语法:

- M = moveto
- L = lineto
- H = horizontal lineto
- V = vertical lineto
- C = curveto
- S = smooth curveto
- Q = quadratic Belzier curve
- T = smooth quadratic Belzier curveto
- A = elliptical Arc
- Z = closepath

例子:

```svg
<path d="M153 334
C153 334 151 334 151 334
C151 339 153 344 156 344
C164 344 171 339 171 334
C171 322 164 314 156 314
C142 314 131 322 131 334
C131 350 142 364 156 364
C175 364 191 350 191 334
C191 311 175 294 156 294
C131 294 111 311 111 334
C111 361 131 384 156 384
C186 384 211 361 211 334
C211 300 186 274 156 274"
style="fill:white;stroke:red;stroke-width:2"/>
```

### svg通用样式

+ stroke: 描边颜色
+ stroke-width: 描边粗细
+ fill: 填充颜色
+ stroke-opacity: 描边透明度
+ fill-opacity: 填充透明度
+ opacity: 整个元素透明度

## 实战

结合以上知识写了一个[demo](https://github.com/fjonas/d3-v4-learning/tree/master/timeline-2017-7-5). 在实现需求的过程中遇到了一些问题, 来总结一下是如何解决的. 以下问题的代码均在[demo](https://github.com/fjonas/d3-v4-learning/tree/master/timeline-2017-7-5)中.

**brush需求**: brush要求不能改变选区, 只能拖动选区. 使用另一个brush来改变选区的宽度, 高度固定.

### 问题一: 如何获得brush的选区数据

使用`.on`方法, 在回调函数中获取第三个参数(回调函数的参数分别为`target`, `type`, `selection`), 使用`d3.brushSelection`来把获得的`selection`转化为一个表示范围的数组.

### 问题二: 如何使两个brush联动

先写好2个brush, 分别在2个brush的`.on`方法中使用`brush.move()`方法, 配合在问题一中获取到的数据来计算另外一个brush需要`.move`到哪儿.

如此写会出现死循环的问题, 所以需要设置一个状态变量, 并在各自brush`.on('start')`和`.on('end')`上监听并改变状态变量, 在`.on('brush')`种判断当前状态来决定是否执行另一个brush的`.move()`方法.

### 问题三: 如何禁用brush的改变选区

要使得一个brush不能改变选区, 只有拖动选区功能, 来分析选区是如何改变的, brush改变选区有两个方式: 直接点击选区的边框来拖拽更改选区, 或是直接在brush的载体上用鼠标划出一个选区. 针对这两个行为要做两个行为:

brush其实包含了8个边框, 分别为四条边和四个角. 每个边框都是一个dom, 只需要把对应的dom去掉, 就可以禁用对应的操作了.

```js
brushG.select(".handle--n").remove()
brushG.select(".handle--e").remove()
brushG.select(".handle--s").remove()
brushG.select(".handle--w").remove()
brushG.select(".handle--nw").remove()
brushG.select(".handle--ne").remove()
brushG.select(".handle--se").remove()
brushG.select(".handle--sw").remove()
```

第二个问题, 需要使用brush的filter功能. filter的回调函数返回falsely的值就会阻止鼠标的点击事件. 我们可以根据`event`来判断鼠标点在哪里, 若不是在现存的选区中就return false. 

```js
.call(brush.filter(function () {
        return event.target !== brushG._groups[0][0].firstElementChild
    }))
```

注意的是`event`变量在linter中会报错, 可以使用 `// eslint-disable-line`来防止linter报错.

### 问题四: 导航brush的拖动块偏外导致初始化显示不全

brush的样式是所有的边框都向外3px, 如果想把边框往里, 可以使用css的`transform: translate`来改变位置.

---

参考: 

[例子](http://bl.ocks.org/rengel-de/5603464)

[例子](http://www.simile-widgets.org/timeline/)

[例子](http://bl.ocks.org/bunkat/1962173)