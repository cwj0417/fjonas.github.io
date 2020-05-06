---
title: electron实战vocabook(一)
date: 2017-09-03 10:15:12
categories: 工作笔记
tags: [electron,应用]
---
零基础使用electron编写记录/复习单词的软件[vocabook](https://github.com/fjonas/lock-on). 记录了第一次开发electron遇到的问题与如何组合使用api来实现通常的需求.

这个项目是使用了[electron-vue](https://github.com/SimulatedGREG/electron-vue)作为模板的.

<!--more-->

*这个系列把问题作为标题, 实现过程作为内容*

## 如何控制每个窗口的控制条与标题栏

electron默认的窗口是显示在正中, 带有标题栏, 可以拖动大小的窗口. 然而在各个不同场景, 我们需要不同的窗口, 接下来说一下不同形态的窗口的配置.

创建窗口使用了main process中的`BrowserWindow`对象, 在[文档](https://electron.atom.io/docs/api/browser-window/)和[无边框窗口的文档](https://electron.atom.io/docs/api/frameless-window/#alternatives-on-macos)里介绍了这个部分提到的所有配置和更多的配置.

### 主窗口

主窗口的需求是不要标题栏, 这样可以自定义ui, 不让标题栏影响界面, 配置为`titleBarStyle: 'hidden'`. 如此产生了一个问题, 没有标题栏不能拖动. 结局方案是在dom上加上`-webkit-app-region: drag;-webkit-user-select: none;`的css就可以使dom变得可以拖动窗口. 另外主窗口的设计是有最小宽度和最小高度. 那么就是用`minHeight`和`minWidth`来设置.

### 配置窗口

这个项目会有"配置"的功能, 那么配置的窗口一般是写死大小, 不能拖动的. 也不能最大化和最小化.

```js
{
  titleBarStyle: 'customButtonsOnHover',
  resizable: false,
  minimizable: false,
  maximizable: false
}
```

### 迷你面板

迷你面板是主界面的第二形态, 期望的行为是置顶窗口, 并自定义窗口控制(红绿灯). 那么配置为:

```js
{
  alwaysOnTop: true,
  frame: false
}
```

其中`alwaysOnTop`是置顶窗口, 迷你面板会覆盖其他所有程序, `frame`是去除窗口控制按钮(最大化/最小化/关闭)

### 优雅显示窗口

因为页面加载需要时间, 而打开窗口以后还在加载页面会使体验变差, 可以把初始窗口配置的`show`字段设为`false`, 并监听加载事件操作窗口:

```js
mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
```

## http请求跨域

在这个项目中使用了axios作为http库, 但因为跨域问题研究了一天, 解决方法很简单. 和chrome插件类似, 配置窗口的安全策略.

```js
webPreferences: {
  webSecurity: false
}
```

## 配置窗口的显示

为配置窗口新增了一个一级路由, 但是在build环境下和dev环境下url不同, dev为http协议, build为file协议, baseurl的写法:

```js
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`
```

## 配置窗口与主窗口的数据

配置窗口是一个独立的页面, 与主窗口是分离的, 那么如何在配置窗口切换了设置以后让主窗口感应到成了一个问题.

这里用到了: 

+ ipc传递事件
+ vuex插件
+ main process `webContents`获取所有窗口

流程:

1. 通过vuex插件来像main process发送事件, 并在vuex插件中监听消息, 直接commit来改变vuex的state
2. 在main process中监听事件, 因为事件参数只能获得来源窗口, 所以需要调用`webContents.getAllWebContents()`来获取所有窗口, 向别的窗口发送设置变化的事件.

具体代码:

vuex plugin:

```js
const {ipcRenderer} = require('electron')

export default store => {
  store.subscribe((mutation, state) => {
    if (mutation.type === 'ipc/theme') {
      ipcRenderer.send('themeChange', state.config.theme)
    }
  })
  ipcRenderer.on('broadcastTheme', (event, arg) => {
    store.commit('config/setTheme', arg)
  })
}
```

main process:

```js
ipcMain.on('themeChange', (event, arg) => {
  webContents.getAllWebContents().forEach(v => {
    v.send('broadcastTheme', arg)
  })
})
```

## 如何切换主窗口与迷你面板

切换窗口也是通过了ipc事件来做的, 需要在主进程保存当前打开的窗口的变量, 来决定关闭了窗口之后再次激活应用打开的是主窗口还是迷你面板.

## 如何存储数据

我用了[nedb](https://github.com/louischatriot/nedb)来储存数据, 使用main process的api`app`, `app.getPath('userData')`可以获取用户存储数据的路径来连接数据库.

### nedb介绍

nedb是个模仿mongoodb查询方式的node数据库, 在electron项目里把实例创建在文件上就行了, 介绍一些概念:

+ collection 对应 数据库的表, 一个collection为一个实例(一个文件)
+ document 对应 数据库的列

