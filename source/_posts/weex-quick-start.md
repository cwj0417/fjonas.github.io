---
title: weex开发尝试
date: 2018-01-01 12:49:28
categories: 工作笔记
tags: [weex,入门]
---
经过尝试cordova, 发现一些不舒服的地方, 与预期又有比较大程度地违背了预期, 所以这次尝试使用weex.

<!--more-->

## 与cordova的区别

前一阵用过一次cordova来把web编译成app, 但是在进行http请求的时候因为是file协议, 所以无法发出http请求, 必须使用cordova插件, 而我们的目的是尽量复用web端的代码, 做到三端同构, 如果必须重写http问题还不大, 可是我们http里还包含拦截器等业务逻辑, 那么就有点难搞了.

另外一个区别是weex的性能和体验更接近原生, 这个之后会介绍. 那么就开始weex的开发环境试水.

## 总体流程

先来说一下上次体验的[cordova](/2017/11/09/use-cordova-distrubuting-a-web-to-an-app/)的流程:

1. 把vue的代码(项目源码)build成dist到cordova项目的www目录下
2. 运行cordova build [平台]来把www下的文件build到platform/[平台]下
3. 用XCode IDE打开platform/[平台]下的workspace文件
4. 运行到虚拟机或真机上

那么weex是如何的呢. 把1和2合并了, 其实不是合并, 是直接把vue语法的文件编译成平台相关的原生文件了. 所以可以把weex叫做vue native.

而之前cordova的做法其实是把整个项目都作为webview. 这样性能上是无法和weex比的.

我们知道vue使用了virtual dom, 实际已经把逻辑(数据/js/业务)和渲染分开了, 只要劫持vdom的render方法就能不把vdom渲染到dom上, 相应的, web里的bom也不存在, 相关的api也是不存在的, html便签也就不存在了. 后面的章节会来讲一下weex和vue的区别.

## 项目的开发/发布流程

### 依赖

首先和[cordova](/2017/11/09/use-cordova-distrubuting-a-web-to-an-app/)一样, 需要XCode IDE, cocoapod, node, npm等非常基础的东西. 然后要安装weex-toolkit和weexpack.

```bash
npm i -g weex-toolkit weexpack
```

### 初始化项目

```bash
weexpack create projectName
```

### 添加平台

(和corodova一样), 切到项目文件夹里

```bash
weexpack create platform ios
```

### 编译到平台

代码在src目录中(vue代码噢).

```bash
weex build ios // 编译
weex run ios // 运行
// (二选一)
```

如果只进行了编译, 打开XCode IDE, 打开`platform/ios/xxx.workspace`, 就可以在虚拟机/真机上运行了. (参考[cordova教程](/2017/11/09/use-cordova-distrubuting-a-web-to-an-app/))

### 开发

之前一直以为开发`npm run serve`, 导致一直与实际不一致. 其实是`weex src/index.vue`, 然后在手机上安装`weex playground`, 保证手机电脑在同一局域网, 可以在手机上看效果.

## weex语法

其实看似是vue语法, 其实完全不是web应用了. 

+ 没有html标签, 只有一些内置标签. (其实是ios组件)
+ 只支持部分css, 默认flex布局.

还有一些内置的js方法. 总的来说, 其实是模拟vue语法的一个新的语法. 所以同样的也会遇到各种问题.

## 细节

开发中会碰到一些与web开发不同的东西.

### text标签

因为没有html标签, weex中封装的div或a也不能有inner字, 是不显示的, 要加上text标签.

### icon/字体

weex(官方)推荐阿里的矢量图标库. [iconfont](iconfont.cn)来加载icon.

把喜欢的icon加入购物车或者自己上传icon, 然后添加到自己的project(如果没有就创建). 然后查看`view the link`获得cdn地址, 我们选择ttf的地址来加载. 代码如下:

```js
 let modal = weex.requireModule('modal')
```

并在`beforeCreate()`钩子里调用:

```js
let domModule = weex.requireModule('dom');
      domModule.addRule('fontFace', {
        'fontFamily': "iconfont",
        'src': "url('http://at.alicdn.com/t/xxxxx.ttf')"
      });
```

之后在你的节点使用`font-family: iconfont`就可以啦~ 例子:

```html
<text style="font-family: iconfont;">&#xe602;</text>
```

### 页面大小

研究了一阵后, weex非常温柔, 我们只要把页面宽度设为750px. weex会帮我们适应设备噢~ 然后是css的阉割导致只能使用px不能使用rem啦.

## 以后

之后当然还会碰到许多问题.

+ statusbar如何改变.
+ 如何解决请求/跨域问题.
+ 如何发布到安卓.
+ 如何发包.
+ 如何储存.(类似electron获取本地文件地址以及对应api)