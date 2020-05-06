---
title: 用electron与vue构建应用--应用结构
date: 2017-06-13 11:06:51
categories: 工作笔记
tags: [vue,webpack,electron,入门]
---

electron越来越流行,  github也用起来写了个client, 之前写过用md做presentation的东西, 现在考虑结合一下试试做个md工具再加上博客发布功能等应用.

<!--more-->

electron应用的优点:

+ 一份代码发布到三个平台
+ 作为web开发不用兼容低版本和浏览器内核差异

之前跟着electron官网的[例子](https://github.com/electron-userland/electron-builder)和[electron-packer](https://github.com/electron-userland/electron-packager)运行有过失败的经验, 这次看着另外个[项目](https://github.com/egoist/eme)来尝试. 前半部分介绍一下各个功能需要的依赖和运行方式.

## common的vue和es6构建

作为vue的项目, 在`dependencies`中添加`vue`和`vuex`, `devDependencies`中依赖`webpack`及一系列相关的loader.

在拉取[eme](https://github.com/electron-userland/electron-builder)代码的时候频频报错, 在webpack和各种loader的时代已经无法坚持使用npm了, [yarn](https://yarnpkg.com)其实只是作为npm的一个封装吧, 实际也是拉了npm的代码仓库. 命令也很简单.

| npm             | yarn               |
| :-------------- | ------------------ |
| npm i           | yarn               |
| npm i -S <name> | yarn add <name>    |
| npm i -D <name> | yarn add -D <name> |

## electron应用启动

electron有一个主进程, 需要在`package.json`的`main`字段中声明主进程. [十几行代码](https://github.com/fjonas/yohane-client/blob/empty/app/main.js)就可以启动electron应用了. 具体electron的api简介会在下一章讨论.

## 开发环境

开发环境在`package.json`中不需要配置, electron开发者在全局安装即可本地运行.

```bash
npm i -g electron
```

electron运行的时候<code>commond + r</code>就可以刷新, 配合webpack的—watch参数即可.

## build与发布

在`devDependencies`添加`electron-prebuilt`

官方推荐了两个发布类, 因为在文章开头提到的失败, 这次选用了[electron-builder](https://github.com/electron-userland/electron-builder)来构建, 操作非常简单.

1. 在`package.json`中配置`build`字段
2. 在`package.json`的`scripts`字段中配置命令`build`
3. 在`package.json`中添加字段`postinstall`值为`install-app-deps`
4. 在项目下建`build`文件夹存放windows和mac的icon, 和mac安装时的背景.

我是这么写的:

```json
{
  "scripts": {
    "postinstall": "install-app-deps",
    "dist": "npm run mac && npm run linux && npm run win",
    "mac": "build --mac",
    "linux": "build --linux deb tar.xz",
    "win": "build --win --ia32",
    "dev": "webpack --config webpack/webpack.config.js --progress --watch & electron app"
  },
    "build": {
    "appId": "com.yo-cwj.yohane-client",
    "mac": {
      "category": "public.app-category.utilities"
    },
    "win": {
      "target": [
        "squirrel"
      ]
    }
  }
}
```

## 脚手架工具

到这里, 一个[空的应用架子](https://github.com/fjonas/yohane-client/tree/empty)已经完成60%并可以运行了. 搞笑的是在文档里看到了[starter](https://github.com/SimulatedGREG/electron-vue). 觉得都白做了.