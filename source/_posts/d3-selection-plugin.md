---
title: 编写d3-selection插件
date: 2017-07-29 14:00:02
categories: 工作笔记
tags: [d3,应用]
---
在使用d3中遇到问题: 在渲染中, 根据数据渲染自定义节点, 那么如何进行优雅的操作呢.

<!--more-->

##  目标

先来抛出问题. 需求需要根据数组中元素的某个字段来画出配置中的图标, 如:

```json
[{
  name: "created"
  iconId: 1
}, {
  name: "workflow",
  iconId: 2
}]
```

其中每个iconId对应了一个配置的好的svg, 那么如何把这些数据注入并画出对应配置的svg.

在d3-selection文档提到了扩充方法的办法以及如何嵌套joining data. 以这两个示例为入口扩展如何实现需求.

## 文档中的例子

### d3.selection()

通过`d3.select()`得到的都是`d3.selection()`对象, 所以类似`.attr()`, `.style()`, `.append()`的方法都是挂载在`d3.selection()`上的. 所以拓展`d3.selection()`的prototype就可以进行d3的拓展. 

```js
d3.selection.prototype.checked = function(value) {
  return arguments.length < 1
      ? this.property("checked")
      : this.property("checked", !!value);
};
```

这样对selection的`.checked()`做出了拓展, 就可以直接在链式操作中使用啦.

```js
d3.selectAll("input[type=checkbox]").checked(true);
```

### 嵌套joining data

文档中有个例子, 一个二维数组对应一个表格, 需要把第一次已经join data的selection赋值给一个中间变量, 再继续join data. 第二次调用`.data()`方法需要传入function参数.

```js
var matrix = [
  [11975,  5871, 8916, 2868],
  [ 1951, 10048, 2060, 6171],
  [ 8010, 16145, 8090, 8045],
  [ 1013,   990,  940, 6907]
];

var tr = d3.select("body")
  .append("table")
  .selectAll("tr")
  .data(matrix)
  .enter().append("tr");

var td = tr.selectAll("td")
  .data(function(d) { return d; })
  .enter().append("td")
    .text(function(d) { return d; });
```

这里感到奇怪的是tr其实是一个multi-selection了, 对他进行join data以后的td又是什么样的selection呢, 我们在后面深入了解.

## 深入

### selection结构

打印了selection, 每个selection结构为:

+ 属性: `_groups`; 结构: 数组; 内容: 数组(内容 dom节点)
+ 属性: `_parents`; 结构: 数组; 内容: dom节点

那么接下来看一下在各个情况下selection的内容是什么.

#### `d3.select()` 和`d3.selectAll()`的返回值

在页面上有2个类名为`.test`的div. 分别选择:

`d3.select(".test")`:

```json
{
  _groups: [
    [
      div.test // dom node
    ]
  ],
  _parents: [
    html // dom node
  ]
}
```

`d3.selectAll(".test")`

```json
{
  _groups: [
    [
      [
        // node list
        [
          div.test, // dom node
          div.test  // dom node
        ]
      ]
    ]
  ],
  _parents: [
    html // dom node
  ]
}
```

这里看出, 无论选取到多少dom, `selection._groups`的长度还是为1, 只是数组第一个元素变成了node list.

#### 嵌套joining data 的selection 结构

我们以[之前提到的例子](#嵌套joining\ data)来看. 这两个变量的结构分别为:

tr

```json
{
  _groups: [
    [
      tr,
      tr,
      tr,
      tr
    ]
  ],
  _parents: [
    table
  ]
}
```

td

```json
{
  _groups: [
    [td, td, td, td],
    [td, td, td, td],
    [td, td, td, td],
    [td, td, td, td]
  ],
  _parents: [
    tr, tr, tr, tr
  ]
}
```

开始我不负责的分析:

1. ```js
   var tr = d3.select("body")
     .append("table")
     .selectAll("tr")
   ```

   直到这里, 当前selection还是table.

2. **`.data(matrix)`**

   此时table的dom里被加上了`.__data__`属性, 值为matrix.

3. **`.enter()`**

   因为table的`.__data__`的值第一层有4个元素. 所以被留了4个空位

4. **`.append("tr")`**

   在空位上创建tr元素, 并返回了新的selection(因为`.append`方法返回的新的selection). 并把parent设为table.

5. ```js
   var td = tr.selectAll("td")
     .data(function(d) { return d; })
     .enter().append("td")
   ```

   因为tr._groups[0]是个数组(而不是dom list), 所以执行了`.data`以后`._groups`扩展到了4个元素的数组, 并进行了和上一步一样的行为.

#### `.each()`, `.call()`

`.attr()`, `.style()`这样的方法可以对每个进行操作, 那么他们是如何对上面这样的selection进行操作的呢.

在[attr的源码](https://github.com/d3/d3-selection/blob/master/src/selection/attr.js#L53)中可以看到selection还有一个`.each`方法. 顺着看到了[文档](https://github.com/d3/d3-selection#selection_each), 如下:

`.each`接受参数`function(datum, index, nodes)`, 还有一个重要的角色是`this`, 

`.each`遍历的是当前selection的_.groups[0]的元素, 所以`this`每个遍历到的元素构成的selection.

还看到了[`.call`](https://github.com/d3/d3-selection#selection_call)方法, 作用是调用对传入的第一个参数为selection的函数做处理的快捷方式.

## 应用: 完成需求

于是写了一个满足需求的[插件](https://github.com/fjonas/d3-v4-learning/blob/master/selection-plugin-2017-7-29/plugin.js).

```js
import * as d3 from "d3-selection"

import config from "./svgPath"

d3.selection.prototype.createIcon = function (fn, style = {}) {
    this.each(function (...params) {
        let id = typeof fn === "function" ? fn(...params) : "0"
        let svg = d3.select(this)
        for (let [key, value] of Object.entries(style)) {
            svg.attr(key, value)
        }
        svg.call(drawIcon, config[id].path)
    })
    return this
}

function drawIcon (svg, paths) {
    svg.attr("viewBox", "0 0 128 128")
    let g = svg.append("g")
        .attr("transform", "translate(0, 128) scale(0.1, -0.1)")
    for (let each of paths) {
        g.append("path")
            .attr("d", each)
    }
}
```

+ `d3.selection.prototype.createIcon = ...`: 在selection的prototype上写可以直接调用
+ `this.each()`, `return this`: 因为需求是每个图标不同, 所以需要分别获取到每个子元素所绑定的``__data__``, 调用`.each`方法, 并在最后`return this` 返回当前selection以便于继续链式操作.
+ `let id = typeof fn === "function" ? fn(...params) : "0"`: d3的selection的所有动态参数都接受3个: datum, index, nodes. 所以看都不看直接z在每个子selection上调用插件的第一个参数, 如果传的不是方法就写个默认值(其实应该使用fn, 避免再判断是否存在配置)
+ `svg.call(drawIcon, config[id].path)`: drawIcon方法是把第二个参数的配置画到第一个参数的selection上, 调用了selection的快捷方法`.call`.

