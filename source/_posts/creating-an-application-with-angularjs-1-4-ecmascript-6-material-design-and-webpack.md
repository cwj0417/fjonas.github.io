---
title: 使用angular1.4, es2015, webpack, angular-material来搭建一个app 
date: 2016-08-09 17:45:04
categories: 试水
tags: [翻译,webpack,angular 1.x]

---
介绍了如何用webpack构建ng1+es6应用， 原文：[Creating an application with AngularJS 1.4, ECMAScript 6, Material Design and Webpack](http://julienrenaux.fr/2015/05/05/creating-an-application-with-angularjs-1-4-ecmascript-6-material-design-and-webpack/)
<!--more-->

### 来学一下如何用ng1.4, es6， material design和webpack来做一个应用吧！

angular1.4发布了。（现在1.x的最后版本是**1.5.8**， 1.5.9好像僵死在了beta)。

现在要介绍一个新的路由：一个由Pascal Percht开发的类似于angular-translate的转换系统， 加强了webpack， 没有‘劫持’的Browserify支持(CommonJS)(Browserify就是在web应用里可以像node一样require lib的一个lib)。 你可以像这样直接import angular：

```js
import 'angular/angular.js';
```

而不是这样：

```js
require('expose?angular!exports?window.angular!angular/angular.js');
```

---

### DEMO

[这是demo地址](https://github.com/shprink/angular1.4-ES6-material-webpack-boilerplate)

---
## 基本配置

### 依赖(package.json)

这个教程里我们会使用`AngularJS`,`Angular Material`,`UI router`（一个还没能可以上生产的路由）（其实现在早可以上了， 这文章在一年前， 作者眼光真是厉害）和`icon library`。

```js
"dependencies": {
    "angular": "~1.4.0",
    "angular-animate": "~1.4.0",
    "angular-aria": "~1.4.0",
    "angular-material": "^0.10.1",
    "angular-ui-router": "^0.2.14",
    "font-awesome": "^4.3.0"
}
```

---

### Webpack

如果你想知道webpack是干嘛的， 我建议你看我的上篇博客。

我们要让webpack的加载器去编译es6并处理css和html文件。

```js
"devDependencies": {
    "babel-loader": "^5.0.0",
    "css-loader": "^0.12.0",
    "file-loader": "^0.8.1",
    "html-loader": "^0.3.0",
    "html-webpack-plugin": "^1.3.0",
    "style-loader": "^0.12.1"
}
```

`webpack.config.js`也是不能再简单了：

```js
module.exports = {
    entry: './lib/index.js',
    output: {
        path: './www',
        filename: 'bundle-[hash:6].js'
    },
    module: {
        loaders: [{
            test: /\.html$/,
            loader: 'file?name=templates/[name]-[hash:6].html'
        }, {
            test: /\.css$/,
            loader: "style!css"
        }, {
            test: /\.js$/,
            exclude: /(node_modules)/,
            loader: "ng-annotate?add=true!babel"
        }, {
            test: [/fontawesome-webfont\.svg/, /fontawesome-webfont\.eot/],
            loader: 'file?name=fonts/[name].[ext]'
        }]
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: './lib/index.html'
        })
    ]
};
```

---

### 入口文件(lib/index.js)

下面这个入口文件集合了我们应用的所有基本依赖的库：Angular, Material Design, 路由和icon。 我们用`import`这个es6的引入CommonJS模块的语法， 注入了`angularMaterial`和`angularUIRouter`作为模块依赖并输出默认模块。（你可以在单个文件输出多个模块， 如果没指定import那么获取到的就是默认模块。）

```js
// Import angular
import 'angular/angular.js';
// Material design css
import 'angular-material/angular-material.css';
// Icons
import 'font-awesome/css/font-awesome.css';
// Materail Design lib
import angularMaterial from 'angular-material';
// Router
import angularUIRouter from 'angular-ui-router';
 
// Create our demo module
let demoModule = angular.module('demo', [
    angularMaterial,
    angularUIRouter
])
 
export default demoModule;
```

---

### index.html

index.html要做2件事。 一个是启动应用（就是`ng-app="demo"`）， 另外是引入js文件。（`src="{\%=o.htmlWebpackPlugin.assets[chunk]\%}"`）。

```html
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">
    </head>
    <body ng-strict-di ng-app="demo">
        {% for (var chunk in o.htmlWebpackPlugin.assets) { %}
        <script src="{%=o.htmlWebpackPlugin.assets[chunk]%}"></script>
        {% } %}
    </body>
</html>
```
你现在应该已经让你的`demo`模块运行了。 为确信他已经运行让我们在入口文件添加一个打log的代码吧：
```js
demoModule.run(($log) => {
    $log.info('demo running');
})
```
然后看一下控制台！

---

## 继续

### 创建你自己的模块

你的应用已经运行了， 我们来用es6创建一个home模块吧！
```js
// Create a new module
let homeModule = angular.module('demo.home', []);
// Named export is needed to inject modules directly as Angular dependencies
export default homeModule = homeModule.name
```

和别的模块一样地注入：

```js
import home from './home/home.module.js';
 
// Create our demo module
let demoModule = angular.module('demo', [
    angularMaterial,
    angularUIRouter,
    home
])
```
我们建立一个controller`./home/controller`来让我们新的模块引入：

```js
export default function($scope) {
    'ngInject';
}
```
`ngInject`是`ng-annotate`的注释， 让angular可以进入严格模式， 预知详情可以复制以下链接**http://julienrenaux.fr/2015/01/18/angularjs-1-x-open-source-projects-to-follow-in-2015/#Ng-Annotate**

我们可以这样引入方法：
```js
let homeModule = angular.module('demo.home', []);
 
import HomeController from './home.controller';
 
homeModule.controller('HomeController', HomeController);
 
export default homeModule = homeModule.name
```

---

### DEMO地址

[demo](https://github.com/shprink/angular1.4-ES6-material-webpack-boilerplate)
