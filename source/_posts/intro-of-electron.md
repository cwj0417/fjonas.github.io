---
title: electron介绍
date: 2016-12-20 14:59:55
categories: 试水
tags: 介绍
---
[electron](http://electron.atom.io/)是个可以通过html, css, js 技术制作桌面应用的项目. 于是读了一下guide了解了大概的流程.

<!--more-->

## 流程

### 建立项目

新建个npm项目, 依赖`electron`就可以了.

### 开发

在`package.json`中的main字段指定主进程文件.

+ 主进程: 打开应用就存在的进程.
+ 渲染进程: 打开每个窗口存在的进程.

在主流程中指定打开什么窗口, 以及各种业务流程.

### 运行

`electron . `

### 发布

可以用第三方库以`electron-package`举例. 安装好以后运行一个桌面应用就产生了.

## 工具

+ devtron/spectron/webdriver 开发/测试工具

+ electron-builder, electron-packager 第三方打包工具

+ chrome 拓展: Chrome DevTools Extension

+ 调试参数: 在5858端口起web容器 electron --debug=5858 your/app

  其他调试工具: electron-inspector(node库), VSCode(IDE). 

## 桌面集成环境

+ 桌面通知 (HTML5)  for linux, mac, windows
+ 最近打开的文档 for mac, windows
+ 自定义Dock菜单 for mac
+ 用户任务 for windows
+ 工具栏预览 for windows 
+ Unity launcher 快捷方式 for linux
+ 工具栏进度条 for windows, mac, unity
+ 图表布局 for windows
+ flash框架 for windows
+ 窗口右键菜单 for mac
+ 拖动文件事件
+ 在线/离线 事件检测