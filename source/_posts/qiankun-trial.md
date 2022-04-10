---
title: 乾坤初尝试
categories: 工作笔记
date: 2022-01-23 15:29:27
tags: [webpack]
---
因为工作原因必须了解一下[乾坤](https://qiankun.umijs.org/), 总结一下乾坤使用级别的入门. 

<!--more-->

## 简介

乾坤是: 把多个应用结合成一个大应用. 这样可以单独开发, 动态部署.

作者说多数场景在"后台系统". 确实, 我工作的公司是做2b系统的, 并且每个老用户都是有收入的, 在不断的迭代中, 前端框架, 仓库形式, 开发方式都有很大的改变. 乾坤可以说是很适合了.

(乾坤是基于什么开发的, 为什么不用iframe, 等等和使用无关的零碎信息都在乾坤文档中)

## 结构

乾坤的具体工作形式是: 一个主应用(大多情况是一个后台系统的菜单), 加载多个微应用(每个菜单对应的应用), 并且微应用是不需要关注前端框架的.

大致流程是: 主应用通过路由, 或是应用中主动调用乾坤api来加载子应用. 主应用读取子应用配置的url, 或者js/css来加载子应用.

下面是主/子应用的介绍.

### 主应用

乾坤对主应用同样是没要求的. 我选择用vite起了一个原生应用, 只要在main.js贴上几行代码就行了:

```js
import { registerMicroApps, start } from 'qiankun';

registerMicroApps([
  {
    name: 'microapp',
    entry: '//localhost:3001',
    container: '#app',
    activeRule: '/',
  },
]);
// start qiankun
start();
```

是的, 就这几行.

当然在真实应用中会比较复杂, 至少涵盖一个菜单系统, 可能还有用户系统等, 然后用乾坤api主动加载子应用.

### 子应用

子应用依然是框架无关, 但暂时不支持vite, 因为加载方式和依赖webpack特有配置. 并必须满足几个条件. 其中几个条件其实是能不考虑技术细节猜到的.

另外要提到的是, **文档中所说的方法并不是唯一的, 甚至是应该根据自己具体项目来定的.** 我们现有脚手架暴露了webpackchain, 那么直接在webpackchain可以设置很多东西.

### cors

原因: 主应用和微应用在dev时大多是跨域的, 因为port是不同的.

方法: 在起dev-server的时候加入允许跨域的响应头. 

### __webpack_public_path__

原因: 微应用的资源如果不设置public-path会访问到主应用的host, 导致资源404.

方法: 在应用中判断是否在乾坤主应用中, 如果是, 把webpack_public_path设置为乾坤放到全局的publich-path.

关于public_path: webpack_public_path经过打包后是`webpack.p`变量. 这个变量会在引入相对资源的时候被追加在前面. 比如引用图片, 引用chunk file等. 默认值是从webpack配置的outpub.public_path取的, 也能接受在业务代码里修改这个值.

### 生命周期

原因: 主应用要知道如何加载, 销毁子应用.

方法: 把加载应用流程写到方法里. 然后写一个销毁方法, 写到销毁方法里. 这里是与通常spa不同的, 因为通常spa不需要销毁应用.

### umd输出

原因: 乾坤主应用加载js的方式, 需要把outpub.library改成指定的名字和umd模式.

方法: 修改webpack配置.

### history路由

原因: 乾坤主应用本身是要通过路由来判断子应用的, 避免冲突.

方法: 判断作为乾坤子应用时使用history路由, 并且设置好base.

### 关闭hmr

原因: hmr会建立websocket链接, 可能webpack还没给二开配置所以会404导致报错.

caveat: 如果加载了社区版的fast-refresh插件, 关闭了hmr是会报错的. 并且要同时关闭react-refresh/babel插件, 他们都是强依赖, 少了互相就会白屏. 这就想到了umi设计的精妙之处.

如果通过webpack-chain关闭还需要注意首字母小写. 这个还是通过log了config对象看到的.

并且webpack-chain的api移除babel插件好像不好操作, umi里没使用webpack-chain来操作, 因为公司脚手架没那么厉害, 所以只能硬干了一串长代码, 还是解决了问题. 

```js
config.module.rules.store.get('js').uses.store.get('babel').store.get('options').plugins = config.module.rules.store.get('js').uses.store.get('babel').store.get('options').plugins.filter(item => !item[0] || item[0] !== 'react-refresh/babel');
```

当然也可以通过新写一个plugin来给react-refresh/bable调用的函数写一个空函数. (react-refresh相关知识后续补充)

## 我们why乾坤

我们公司之前一直使用js-entry的方式从菜单加载应用. 很显然把所有资源只加载到一个js和css中会产生问题.

code spliting和file-loader不打成base64的大资源等"除了主js会引入其他资源"的应用都是不可行的.