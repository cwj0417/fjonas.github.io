---
title: 三分钟精通webpack
date: 2016-08-09 14:33:13
categories: 编码与分析
tags: [javascript,webpack,翻译,入门]
---
带有实例的webpack介绍, 原文: [Introduction to Webpack with practical examples](http://julienrenaux.fr/2015/03/30/introduction-to-webpack-with-practical-examples/)
<!--more-->

**webpack是一个模块化打包工具, 可以根据依赖处理模块来生成静态资源. 我们准备借鉴真实场景的应用作为例子来学习.**

---

webpack正快速占领自动化构建市场. 我用了几个月, 在大部分需求上已经可以代替`Grunt`和`gulp`了.

## Webpack 加载器

加载器是可以在编译中注入的代码片段, 加载器会在编译结束时被调用.

> webpack只能处理原生js, 而加载器用来把其他资源转化为js. 这样做的话每个资源都形成了一个模块.

[我是一个例子的链接](https://github.com/shprink/webpack-examples)

## 准备

你的电脑上需要装好[node](https://nodejs.org)

## 安装

```sh
npm install webpack --save-dev
```
现在新建个文件`webpack.config.js`然后输入这些: 
```js
var webpack = require('webpack'),
    path = require('path');
 
module.exports = {
    debug: true,
    entry: {
        main: './index.js'
    },
    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name].js'
    },
    module: {
        loaders: []
    }
};
```
上面配置的意思大概是: 把入口文件设为`index.js`, 文件编译后会输出到`dist`这个目录里. （作者笔误拼错单词了:p）

## 编译

你已经写好入口文件的话就可以用以下命令编译了.(我理解就是在主入口文件里require,import)
```sh
## Debug mode
webpack
 
## Production mode (minified version)
webpack -p
```

## ES2015编译

ES2015引进了一些我们马上就可以使用的新特性（箭头函数, 类, 生成器, 模块等）.为了使用ES2015我推荐使用[Babel](https://babeljs.io/)

装一下babel: 
```sh
npm install babel-loader --save-dev
```
在webpack配置里增加加载器: 
```js
loaders: [{
  test: /\.es6.js$/,
  loader: "babel-loader"
}]
```
你现在可以用ES2015写代码了, 需要根据配置里的正则引入, 当前的配置引入方式是`require('./src/index.es6.js');

### 编译结果
作者用ES2015的生成器写了一个斐波那契数列的输出, 然后用webpack加babel编译成了es5. 顺便说一下, 好处很明显, 代码量变少了, 类型明确了, 在编译的层面上进行了jshint.
#### 编译前
```js
// Generators
var fibonacci = {
    [Symbol.iterator]: function*() {
        var pre = 0,
            cur = 1;
        for (;;) {
            var temp = pre;
            pre = cur;
            cur += temp;
            yield cur;
        }
    }
}
 
module.exports = fibonacci;
```
#### 编译后
```js
"use strict";
 
var fibonacci = function() {
    var a = {};
    a[Symbol.iterator] = regeneratorRuntime.mark(function b() {
        var a, c, d;
        return regeneratorRuntime.wrap(function e(b) {
            while (1) switch (b.prev = b.next) {
              case 0:
                a = 0, c = 1;
 
              case 1:
                d = a;
                a = c;
                c += d;
                b.next = 6;
                return c;
 
              case 6:
                b.next = 1;
                break;
 
              case 8:
              case "end":
                return b.stop();
            }
        }, b, this);
    });
    return a;
}();
 
module.exports = fibonacci;
```

---

这里有一段coffescript的编译介绍, 我不想看了, 本文头有原文链接.
作者用的lib叫`cofffee-loader`, 所有用法和es6是一样的.

---

## 引入css文件

装一下: 
```sh
npm install css-loader --save-dev
```
在webpack配置里增加一个加载器规则: 
`css-loader`会建立一个`style`标签在程序运行的时候注入页面. 还会在生产环境的时候自动压缩文件.生产环境是`-p`.e.g.`webpack -p`
```js
loaders: [{
  test: /\.css$/,
  loader: "css-loader"
}]
```
老规矩, 你要引入css的话就要符合正则: `require('./src/index.css')`

---

## 给css自动加前缀

装装装: 
```sh
npm install autoprefixer-loader --save-dev
```
我们很烦在各个浏览器上一些样式的写法是不同的.IE要加`-ms-`的前缀, 火狐是`-moz-`, chrome、opera、safari是`-webkit-`. 这个lib让您安心使用标准css, 不需要考虑浏览器语法兼容了.
```js
loaders: [{
  test: /\.css$/,
  loader: "css-loader!autoprefixer-loader"
}]
```
引入方式还是一样（我倒建议这里的规则要写特殊点, 毕竟前缀只是少数）

### 编译结果
#### 编译前
```css
body {
    display: flex; 
}
```
#### 编译后
```css
body {
    display: -webkit-box;      /* OLD - iOS 6-, Safari 3.1-6 */
    display: -ms-flexbox;      /* TWEENER - IE 10 */
    display: -webkit-flex;     /* NEW - Chrome */
    display: flex;             /* NEW, Spec - Opera 12.1, Firefox 20+ */
}
```
---

## 编译SASS

sass让你可以写css的时候可以用变量, 嵌套, 混合, 继承等. 用sass会很方便.

安装: 
```sh
npm install css-loader sass-loader --save-dev
```
webpack配置如下: 
（吐槽: 终于有不一样的了）
现在我们要同时使用2个加载器了！第一个加载器`sass-loader`（从右向左看）会把ssass编译成css然后交给css处理, 就是之前说的创建`style`标签之类的.
```js
loaders: [{
  test: /\.scss$/,
  loader: "css-loader!sass-loader"
}]
```
加载方式: `require('./src/index.scss');`

### 编译结果
#### 编译前
```sass
$font-stack:    Helvetica, sans-serif;
$primary-color: #333;
 
body {
  font: 100% $font-stack;
  color: $primary-color;
}
```
#### 编译后
```css
body {
  font: 100% Helvetica, sans-serif;
  color: #333;
}
```

---

这里有段less的,使用的lib是`less-loader`, 用法和sass一样的.

---

## 移动文件

我们可以移动任何文件, lib名字叫`file-loader`.

安装: 
```sh
npm install file-loader --save-dev
```
来看看如何配置吧: 

例子里我们尝试把一个图片从他的目录里移动到指定的目录并命名成这种规范: `img-[hash].[ext]`.
```js
loaders: [{
  test: /\.(png|jpg|gif)$/,
  loader: "file-loader?name=img/img-[hash:6].[ext]"
}]
```
你可以这样引入任何图片: `require('./src/image_big.jpg');`

### 编译结果
`./src/img.jpg`被复制并重命名为`dist/img/img-a4bd04.jpg`

---

## 编码文件(encode files)

有时候你不想通过http来拿资源. 比如: 当你可以直接拿到encode过的资源的时候, 选择去http拿一个很小的图片还有什么意义呢？这个lib正是做了这个事情. 你需要做的只是决定什么编码的文件给多少限制（如果超过限制你会得到路径）.

安装: 
```sh
npm install url-loader --save-dev
```

配置如下: 

如果图片小于5k我们就拿他base64encoded, 不然就路径.
```js
loaders: [{
  test: /\.(png|jpg|gif)$/,
  loader: "url-loader?limit=5000&name=img/img-[hash:6].[ext]"
}]
```

### 编译结果
#### 编译前
```js
var imgBig = '<img src="' + require("./src/image_big.jpg") + '" />';
var imgSmall = '<img src="' + require("./src/image_small.png") + '" />';
```
#### 编译后
```js
var imgBig = '<img src="img/img-a4bd04.jpg" />';
var imgSmall = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA" />';
``` 

---

## 引入HTML文件（require HTML files)

`html-loader`可以把任何文件转成模块, 也可以引入任何图片.
安装: 
```sh
npm install html-loader --save-dev
```
配置: 
```js
loaders: [{
  test: /\.html$/,
  loader: "html-loader"
}]
```
你可以这样引入任何html文件: `require('./src/index.html');`所有图片会被转成流（就是前面的encode files）.

### 编译结果
#### 编译前
```html
<html>
    <head>
        <title></title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width">
    </head>
    <body>
        <img src="./image_small.png">
    </body>
</html>
```
#### 编译后
```js
module.exports = '<html>\n    
   <head>
      \n        
      <title></title>
      \n        
      <meta charset="UTF-8">
      \n        
      <meta name="viewport" content="width=device-width">
      \n    
   </head>
   \n    
   <body><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA"></body>
   \n
</html>';
```

---

## 暴露任何模块（Expose any module)

`expose-loader`可以让你把任何模块绑定到全局作用域上.
安装: 
```sh
npm install expose-loader --save-dev
```
配置: 
例子中我们要把`lodash`在全局作用域中暴露为`_`.

```js
loaders: [{
  test: require.resolve("lodash"),
  loader: 'expose?_'
}]
```
现在当我们引入lodash`require('lodash');`会把他暴露给全局. 这个模块在你使用一些流行模块时是必须的.

