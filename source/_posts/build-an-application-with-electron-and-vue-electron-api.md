---
title: 用electron与vue构建应用—electron api
date: 2017-06-13 11:07:10
categories: 胡乱编码
tags: [vue,webpack,electron,实验]
---
一个electron应用只需要在全局安装electron, 并在`package.json`中声明main入口就可以启动, 那么如何从一个空的应用出现页面, 菜单等界面并调用各种web接口/node接口/os接口呢. 这里是[官方api例子](https://github.com/electron/electron-api-demos).

<!--more-->

## 应用进程

electron应用的进程分为`Main Process`(主进程)和`Renderer Process`(渲染进程), 主进程是整个应用的进程, 控制窗口的建立消除/应用菜单/后台行为等, 渲染进程其实就是网页进程(窗口进程), 控制界面的行为和与主进程的交互. 写到这里感觉与之前的[使用vue编写chrome拓展](/2016/11/07/how-to-build-an-chrome-extension/)的应用结构几乎一样, 只是api和发布平台不同.

## Electron API 分类/使用 介绍

[文档](https://electron.atom.io/docs/)的中间那列API Reference, 被分为了主进程api, 渲染进程api和共享api.

使用api的方法:

```js
const {apiName1, apiName2} = require("electron")
```

在介绍API前, 先用[官方quick start](https://github.com/electron/electron-quick-start)的例子(作用是打开一个窗口并加载html页面)来对api的使用有感性认识.

在入口`main.js`中, 引用了两个api: `app` 和 `BrowserWindow`.

`app`指的是主进程应用, 例子中监听了`ready`事件并执行`createWindow`:

```js
app.on('ready', createWindow)
```

在`createWindow`中, 调用了`BrowserWindow`来创建window对象, 并加载html到窗口中:

```js
// Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
```

如此, 在当前目录下运行`electron . `就可以看到自己编写的`index.html`页面了.

## API走马观花

经过了刚才的例子, 对api的调用场景有了概念, 来看一看常用的api能干些啥.

### `app`与`BrowserWindow`

`app`是用来控制整个应用的事件, 分为event和methods.

event包含应用的各个事件, 如创建窗口/关闭窗口/打开文件/获得焦点/退出等. 

methods包含应用的退出/激活/显示隐藏/设置图表/获得应用的当前状态.

`BrowserWindow`的使用方法是`new BrowserWindow(options) `. 根据不同的参数会得到不同性质的窗口, 窗口实例也有监听event和自己的methods, events都是对窗口的操作(点击/拖动/全屏)和关闭, methods有显示隐藏/关闭等等, 和app相似.

来说几个创建对象的参数:

+ `parent`: 子窗口会随着父窗口一起被拖动. 猜想使用场景是应用的settings.
+ `modal`: 顾名思义, 子窗口在父窗口中. 我们在需要modal的时候可以不用html模拟了.

### `Menu`与`MenuItems`

这对api是用来创建应用菜单的. 菜单产生如下:

+ `MenuItem`是menu class, new `MenuItem`或`Menu.buildFromTemplate()`使用是产生menu对象的方法.

+ `MenuItem`是一个数组, `label`是菜单名, `click`方法是点击以后执行的方法. 还有一些别的选项, 另外`submenu`是递归子菜单的选项, 不同的是可以不接受manu对象, 可以直接传option, electron会自动parse成menu对象.

+ `MenuItem`还提供了个快捷选项`role`, electron有一些内置的菜单, 比如只要`role: "copy"` electron就会产生一个复制菜单, 并有我们期待中的一切效果.

+ 把产生的Menu使用`Menu.setApplicationMenu`设成菜单就可以, 官方文档的写法(用了`Menu.buildFromTemplate`来产生menu):

  ```js
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  ```

最后, 要注意的是, 如果系统是mac, 那么要unshift一个menu, 因为mac的第一个菜单是应用标题.

### `shell`

这是一个公用api, 作用是系统(桌面)集成. (有一个段子是总把shell翻译成"壳", 那么这里的shell可能真的是"壳"的意思了)

方法介绍:

+ `shell.showItemInFolder(fullPath)` 在文件夹中显示
+ `shell.openItem(fullPath)` 用系统默认打开文件
+ `shell.openExternal(url[, options, callback])` 打开网页
+ `shell.moveItemToTrash(fullPath)` 扔进回收站
+ `shell.beep()` 让系统叫一下
+ (windows) `shell.writeShortcutLink(shortcutPath[, operation], options)` 创建快捷方式
+ (windows)`shell.readShortcutLink(shortcutPath)` 读取快捷方式

### dialog

操作文件与各种其他弹窗, 是主程序api, 如果需要在渲染进程中调用, 可以:

```js
const {dialog} = require('electron').remote
console.log(dialog)
```

+ `dialog.showOpenDialog([browserWindow, ]options[, callback])` 选择文件. 选项可以调整目标文件的范围, 在callback中获得选择的文件, 如果不指定callback, 选择的文件将作为函数的返回值.

+ `dialog.showSaveDialog([browserWindow, ]options[, callback])` 同上, 只是按钮变成保存. 实际操作都得自己做.

+ `dialog.showMessageBox([browserWindow, ]options[, callback])` 弹出框, 选项中只有`message`是required的. 

  callback的内容有两个字段, `response` 如果设置了多个按钮, 被点击的按钮的索引, `checkboxChecked` 如果设置了`checkboxLabel` 这里是checkbox的值, 默认是false. (经尝试`checkboxLabel`在mac上没有显示出来). 如果没有设置callback, 那么`response`将会作为函数的返回值.

+ `dialog.showErrorBox(title, content)` 这是错误提示, 只有两个简单的参数.

### `ipcMain`与`ipcRenderer`

这两个是主进程与渲染进程通信的方式. 

+ 发送事件没有callback, `sendSync()`方法可以获取监听端的`event.returnValue`值.
+ 监听端可以使用`evnet.sender.send()`或另外一个api`webContents.send`来向渲染进程发, 但没有`sendSync()`方法. `webContents.send`在下回分解.

## 告一段落

如此构造文件结构, 调用api, 已经可以把自己的web应用增加系统集成并发布到mac, windows, linux平台了, 剩下的标准流程的配置, 测试就和web开发一样了.