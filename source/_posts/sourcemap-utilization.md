---
title: sourcemap的使用
categories: 工作笔记
date: 2022-11-25 18:20:16
tags:
---
上个月老板介绍了sourcemap的几个使用. 我现在才回头看了看, 也做下总结.

soucemap好像是12年上线的, 我的感觉是一直知道是什么, 但又没一点深入过.

<!--more-->

## sourcemap是什么

代码从源码编译完已经面目全非, 出bug的时候就基本不能debug了.

sourcemap是编译源码和浏览器约定的一种格式.

效果是编译后的代码加载了sourcemap就可以像看源码一样debug.

### soucemap的形式

默认情况下, 一份源码经过编译会产生一份sourcemap文件, 编译后的源码最后一行会有sourcemap的url信息, 这样浏览器在debug模式下就会去加载soucemap.

另外sourcemap也可以直接在行内.

sourcemap的内容是一个json. 有几个字段: `version`, `file`, `sourceRoot`, `sources`, `names`, `mappings`. 

并且会用VLQ(Variable Length Quantity)把sourcemap的内容处理成base64来缩小体积.

其具体的对应关系我暂不打算深入, 浏览器能识别就行了.

### 什么时候要打sourcemap

只要有编译过程, 源码和构建后代码有区别的, 都可以用soucemap: flow, ts, jsx, es, css预处理等. (这里说得非常不严谨, 但情况实在太多). 其实上线代码都必须minify和uglify, 所以sourcemap的问题在工程化里基本是全覆盖的.

那什么时候要打soucemap也比较明确了, 分为dev时和build时.

dev的时候直接关闭minify, uglify, es. 这个情况下不需要打sourcemap.

但dev flow, ts, jsx的时候需要开sourcemap来debug.

build的时候为了build速度考虑是不打soucemap的. (或者有的是为了不让用户轻松看到源码)

但在供开发者使用的lib里, 为了提升组件使用者体验可以打出sourcemap.

## 关于debug源码

说到了应用, 第一个是debug源码. 指第三方库的源码, 比如antd和react.

主要思路就是自己下载源码, 然后修改一些打包配置, 自己打包, 把sourcemap文件粘贴到node_modules里.

但具体的操作其实需要相当深的工程化基础, 至少看懂目标库打包流程的一半吧.

这里简单说说antd和react的流程.

antd的esm是gulp打的大家不熟悉, 所以选择了webpack打的umd流程, 所以在自己代码里要把import('antd') 改成 require('antd'), 或者直接import对应目录的umd包.

antd的webpack已经打出了sourcemap, 但devtool的参数有问题, 要设成带module的, 才能最终指向源码, 而不指向webpack的打包结果. 因为antd源码是从tsx打成js再打es, antd自带的sourcemap只是从es5指到js的.

react是rollup打的, 在打包脚本里修改一系列参数, 自己打完包再把结果复制到node_modules里, 这个我没试.

另外, 如果项目语言和第三方库语言是同一种(比如tsx), 还可以通过直接复制源码到node_modules里来debug.

但还要做额外2件事: 修改打包脚本, 让打包规则走进node_modules里的这个包, 自己项目要安装第三方项目的所有依赖.

## 关于debug线上代码

在自己本地打好sourcemap的包以后, 在浏览器的source里找到对应的文件, 右击可以加载本地的sourcemap. 进一步还可以用override功能和抓包软件代理来进行本地代码调试线上.

## 参考

[https://developer.chrome.com/blog/sourcemaps/](https://developer.chrome.com/blog/sourcemaps/)

[https://survivejs.com/webpack/building/source-maps/](https://survivejs.com/webpack/building/source-maps/)

[https://webpack.js.org/configuration/devtool/](https://webpack.js.org/configuration/devtool/)

[https://juejin.cn/post/7158430758070140942](https://juejin.cn/post/7158430758070140942)
