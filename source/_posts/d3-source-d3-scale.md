---
title: d3源码之d3-scale
date: 2018-04-23 16:46:10
categories: 编码与分析
tags: [d3,分析]
---
要尝试把之前用d3画的东西放到react-native上, 而rn是没有dom只有svg的lib, 那么就要研究下d3的实现了.

<!--more-->

## 背景&目标

之前用d3做了一个事件时间线, 用到了`d3-scale`, `d3-brush`, `d3-selection`. 那么在rn上无法对dom(其实是svg)进行`拿起来干`式的操作, 那么想在rn上模仿一个类似的时间线就要去了解一下d3的实现了.

所以决定从最简单的`d3-scale`开始, 这个lib算是个数学库, 不涉及dom操作, 在时间线的项目中使用到的api也不多, 那么目标就设为了解这几个api的运行流程.

1. `d3.scaleLinear()`
2. `.domain()`及`.range()`
3. `scale()`及`scale.invert()`

我也[fork](https://github.com/fjonas/d3-scale)了一份代码用来写注释.

## 目录结构

d3应该是从大而全拆成各个小module再互相引用的, 用了rollup, 从rollup.config看到入口是在根目录下的`index.js`, 而具体内容在`src`文件夹下, `index.js`的内容全是`export {xx as xxx} from './src/xx'`. 这个目录结构相当简单, 适用于d3的所有小模块的.

## scaleLinear

我们的目标是`d3.scaleLinear()`. 所以来到`src/linear.js`. [完整版](https://github.com/fjonas/d3-scale/blob/master/src/linear.js)从这里看, 截取export的地方贴一下:

```js
export default function linear() {
  var scale = continuous(deinterpolate, reinterpolate);

  scale.copy = function() { // 给scale添加copy方法
    return copy(scale, linear());
  };

  return linearish(scale); // 给scale添加了些方法并返回scale, 所以核心还是第一句continuous()
}
```

从这个输出结构看出, 输出的是`scale`对象(应该是一个方法). 因为这里是linear, 所以对scale做了处理:`linearish`, 字面意思"线性化", 所以结论是**不同的scale的核心是同一个工厂, 再经过不同的包装重载一些方法来输出不同的scale**.

那么我们要研究的就是: **`continuous(deinterpolate, reinterpolate)`**. 这三个变量何去何从都待我们一个个看过来.

## deinterpolate, reinterpolate

deinterpolate:

来源: countinous的`deinterpolateLinear`.

```js
export function deinterpolateLinear(a, b) {
  return (b -= (a = +a)) // b = b - a, 不知道为什么要花里胡哨
      ? function(x) { return (x - a) / b; } // 当a, b不相等, 返回 x 在 a, b中的比例. 也就是 x - a / b - a
      : constant(b); // 当a, b相等 永远返回  0
}
```

reinterpolate:

来源: 另一个模块: `d3-interpolate`的`interpolateNumber`.

```js
export default function(a, b) {
  return a = +a, b -= a, function(t) {
    return a + b * t; // return a + (b - a) * t
  };
}
```

代码很简单, 注释也写了, d3这个库有个特点就是花里胡哨, 而且各个小模块的花式还不同, 作者应该是在尝试各种招式~ 来总结一下:

这两个函数都接受两个参数, 是实际范围. 这两个函数都是在实际范围和x在范围内的位置做转换. 位置用数字来表示百分比.

deinterpolate返回的函数接收参数x: 实际点, 返回点在范围中的位置, 用0~1来表示.

reinterpolate返回的函数接收参数t: 位置, 返回这个位置对应的点.

后来发现在continuous的代码中有注释:

```js
// deinterpolate(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
// reinterpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding domain value x in [a,b].
```

## continuous

[完整版源码](https://github.com/fjonas/d3-scale/blob/master/src/continuous.js)在这里. 函数是下面这个样子的, 注释也贴上了:

```js
export default function continuous(deinterpolate, reinterpolate) {
  var domain = unit,
      range = unit,
      interpolate = interpolateValue,
      clamp = false,
      piecewise,
      output,
      input;
  /*
    continuous返回值, 返回值调用任何方法的返回值都是这个.
    对piece wise做了处理, 把output和input置空,
    最后返回scale.
   */
  function rescale() {
    piecewise = Math.min(domain.length, range.length) > 2 ? polymap : bimap; // 我们使用的都是length === 2的, 所以是bimap
    output = input = null;
    return scale;
  }

  function scale(x) {
    return (output || (output = piecewise(domain, range, clamp ? deinterpolateClamp(deinterpolate) : deinterpolate, interpolate)))(+x);
    /*
        翻译:
        1. 输出: piecewise(domain, range, deinterpolate, interpolate)(x)
        2. clamp是通过scale.clamp()设置的, 超出范围是否纠正到范围内, 默认false, 如果是true会小小改写deinterpolate方法
        3. 在调用rescale()前都会保存当前输出(不重新计算, 因为结果肯定是一样的). rescale会在调用scale的任何方法时调用.
     */
  }

  scale.invert = function(y) {
    return (input || (input = piecewise(range, domain, deinterpolateLinear, clamp ? reinterpolateClamp(reinterpolate) : reinterpolate)))(+y);
    /*
        和上面scale一样, 调用了piecewise, 传了不同的参数~ 让我们到bimap里去研究吧.
     */
  };

  scale.domain = function(_) {
    return arguments.length ? (domain = map.call(_, number), rescale()) : domain.slice();
    /*
        如果不传参, 返回当前domain, 阻断链式操作
        如果传了, domain = _.map( a => +a), 然后返回rescale(), 也就是一顿操作再返回scale
     */
  };

  scale.range = function(_) {
    return arguments.length ? (range = slice.call(_), rescale()) : range.slice();
    /*
        和domain一样, 可能range不一定要是数字.
     */
  };

  scale.rangeRound = function(_) {
    return range = slice.call(_), interpolate = interpolateRound, rescale();
  };

  scale.clamp = function(_) { // 设置超出范围是否纠正到范围内
    return arguments.length ? (clamp = !!_, rescale()) : clamp;
  };

  scale.interpolate = function(_) { // 这个本来是从d3-interpolate引入的, 修改这个会改变算法
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };

  return rescale();
}
```

归纳:

1. continuous()调用返回值是一个方法.
2. 因为闭包, 所以返回的这个方法里保存了一些属性: domain, range, clamp等.
3. 返回值是`scale()`, 就是我们使用的比例尺.
4. scale()相对的是scale.invert(), 使用的是同一个生成函数.
5. 每次通过方法改变scale的属性(domain, range, clamp等)就会触发rescale().
6. rescale()的作用两个: 根据domain和range的维度来改变scale使用的函数; 重置缓存(因为属性不变输出是不变的所以不触发rescale()再次调用scale()不会重新计算).

另外:

+ 我们使用场景domain和range维度都是2, 所以都用了`bimap`这个方法.
+ 学到一个奇怪的用法: function还可以有自己的键值, 因为` (function () {}) instanceof Object === true`吧.

## pow

看完以后来看了一下scalePow()是如何实现的.

```js
function raise(x, exponent) {
  return x < 0 ? -Math.pow(-x, exponent) : Math.pow(x, exponent);
}

export default function pow() {
  var exponent = 1,
      scale = continuous(deinterpolate, reinterpolate),
      domain = scale.domain;

  function deinterpolate(a, b) {
    return (b = raise(b, exponent) - (a = raise(a, exponent)))
        ? function(x) { return (raise(x, exponent) - a) / b; }
        : constant(b);
  }

  function reinterpolate(a, b) {
    b = raise(b, exponent) - (a = raise(a, exponent));
    return function(t) { return raise(a + b * t, 1 / exponent); };
  }

  scale.exponent = function(_) {
    return arguments.length ? (exponent = +_, domain(domain())) : exponent;
  };

  scale.copy = function() {
    return copy(scale, pow().exponent(exponent));
  };

  return linearish(scale);
}
```

同样的返回值是`continuous(deinterpolate, reinterpolate)`.

只是重写了`deinterpolate`和`reinterpolate`.

## 总结

d3-scale可以说是教科书式的工厂模式, 一个核心方法, 通过重写参数来提供不同api.

scaleLinear()的过程是:

1. scaleLinear()返回值是一个带有内部属性的对象, 表面自己就是可以直接调用的方法.
2. 通过一些方法来设置内部属性. domain和range默认是[0, 1].
3. 核心算法就是加减乘除的比例尺. 通过domain和range和策略来输出结果.