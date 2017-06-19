---
title: es6 in depth 类
date: 2016-09-10 17:28:02
categories: 胡乱编码
tags: [ES2015,es6-in-depth,翻译]
---
今天我们来讲一下一个老问题的语法: javascript中的object构造器创建.

## 问题

说一下我们想创建一个典型的面向对象设计的例子:  圆的类. 假设我们在为一个简单的canvas lib 写一个圆的类. 我们可能想直到如何做下列的事:

+ 画一个给定的圆到给定的canvas上.
+ 追踪画过的圆的总数.
+ 追踪画过的圆的半径, 并强制值不变.
+ 计算所画圆的面积

现在的js语言告诉我们, 我们先得写一个函数的构造器, 然后加上任何我们想这个函数自有的属性, 然后用一个object替换这个属性的`prototype`, 这个`prototype`object包含了我们创建的实例以后的属性. 即使一个很简单的例子, 我们也要花很多时间去写这些模板: 

```js
function Circle(radius) {
    this.radius = radius;
    Circle.circlesMade++;
}

Circle.draw = function draw(circle, canvas) { /* Canvas drawing code */ }

Object.defineProperty(Circle, "circlesMade", {
    get: function() {
        return !this._count ? 0 : this._count;
    },

    set: function(val) {
        this._count = val;
    }
});

Circle.prototype = {
    area: function area() {
        return Math.pow(this.radius, 2) * Math.PI;
    }
};

Object.defineProperty(Circle.prototype, "radius", {
    get: function() {
        return this._radius;
    },

    set: function(radius) {
        if (!Number.isInteger(radius))
            throw new Error("Circle radius must be an integer.");
        this._radius = radius;
    }
});
```

这些代码又复杂, 又难看懂. 现在需要一个不繁琐, 容易看懂的方法来工作, 让我们可以简单地给类添加属性. 如果以上的太复杂了, 不用担心, 下面的文章会接受简单的方法来做这些.

## 定义方法的语法

第一步, es6提供了一些定义object方法的新语法. 当我添加`area`方法的时候, 我觉得这比写`radius`的getter/setter方法麻烦多了. 因为js去除了面向对象的途径, 大家变得对设计更简单的方法来改变object有了兴趣. 现在有了一个给object添加方法的捷径了. 正如我们不需要`Object.defineProperty`而可以`obj.prop = method`来添加一个方法一样. 我们只需要按照以下步骤:

1. 在object上写一个普通的方法属性.
2. 在object上写一个generator方法属性.
3. 在object上写一个普通的getter/setter方法属性.
4. 以上任何步骤用`[]`语法来包裹属性名字. 我们把这个叫做*计算后的属性名*.

这些以前都做不到. 新的语法加了以后我们可以写成以下的样子:

```js
var obj = {
    // 现在添加方法不需要function关键字了
    method(args) { ... },

    // 如果声明一个generator只需要在属性名前加*号
    *genMethod(args) { ... },

    // Accessors can now go inline, with the help of |get| and |set|. You can
    // getter/setter不存在generator方法

    // 注意getter是不接受参数的
    get propName() { ... },

    // setter接受1个参数
    set propName(arg) { ... },

    // []语法在任何地方都可以用, 包括上面4个, 以及symbol, generator, getter/setter等等.
    [functionThatReturnsPropertyName()] (args) { ... }
};
```

用了新语法重写刚才的代码:

```js
function Circle(radius) {
    this.radius = radius;
    Circle.circlesMade++;
}

Circle.draw = function draw(circle, canvas) { /* Canvas drawing code */ }

Object.defineProperty(Circle, "circlesMade", {
    get: function() {
        return !this._count ? 0 : this._count;
    },

    set: function(val) {
        this._count = val;
    }
});

Circle.prototype = {
    area() {
        return Math.pow(this.radius, 2) * Math.PI;
    },

    get radius() {
        return this._radius;
    },
    set radius(radius) {
        if (!Number.isInteger(radius))
            throw new Error("Circle radius must be an integer.");
        this._radius = radius;
    }
};
```

准确地说, 上面的代码和第一版并不一样. 这么写的方法可以被编辑和遍历, 但getter/setter就不可以了. 但在实际中不那么会注意到这个区别.

好, 其实还可以简洁, 来看看下面.

## Class定义语法

现在来讲一下class的语法.

`constructor`方法为class的构造器, `static`为静态方法, 相当与以前的`prototype`.

我们的代码变成了如下:

```js
class Circle {
    constructor(radius) {
        this.radius = radius;
        Circle.circlesMade++;
    };

    static draw(circle, canvas) {
        // Canvas drawing code
    };

    static get circlesMade() {
        return !this._count ? 0 : this._count;
    };
    static set circlesMade(val) {
        this._count = val;
    };

    area() {
        return Math.pow(this.radius, 2) * Math.PI;
    };

    get radius() {
        return this._radius;
    };
    set radius(radius) {
        if (!Number.isInteger(radius))
            throw new Error("Circle radius must be an integer.");
        this._radius = radius;
    };
}
```

哇哦! 又简洁又容易看, 嘿嘿, 接下来我们看几个点:

+ **分号在哪里?** — 为了让class看起来更像class, 所以把分号变成语法中可有可无的. 
+ **如果我不想有构造器, 但还是想在object上放方法?** — 可以的. `constructor`完全是个可选的方法. 如果你没有写, 那就等于你写了``constructor() {}``.
+ **`constructor`可以是一个generator吗?** — 不可以. 尝试使用getter/setter与generator来定义构造器会抛出`TypeError`.
+ **我可以用[计算后的属性名]来定义`constructor`吗?** — 不可以. 如果你尝试这么做, 那么constructor会变成class的一个方法, 而不是构造器- -
+ **如果我改变了`Circle`的值会发生什么, 会导致实例的行为错误吗?** — 不会! 和方法表达式一样, 类会有一个内部的环境. 
+ **如果我给class的一个方法赋值一个普通的字面量object, class会出错吗?** — 不会. es6允许这种写法, 除了你企图在class中再创建一个作用域.
+ **如果我企图遍历class或者其他什么呢** — 我们只可以去遍历新增的方法, 换句话说, class原有的方法只可编辑, 不可遍历.
+ **等等, 那么变量内部变量呢? 比如`static`变量有没有?** — 被你发现了, es6暂时还没有这些东西, 以后的版本会跟进.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)