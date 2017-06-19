---
title: 谷歌拓展程序初体验
date: 2016-11-07 20:49:42
categories: 胡乱编码
tags: [chrome extension,vue,webpack,入门]
---
谷歌的拓展其实就是一(几)个网页而已拉, 1分钟就可以很容易弄起来一个谷歌拓展. 所以gogogo.

<!--more-->

## 简单的介绍

### 什么是chrome拓展

所以chrome拓展乃谷歌chrome提供的可在浏览器上做一些小程序的功能. 编写的方式就是普通的前端网页技术. 功能很多很多. 这篇文章也只是讲很少一部分. 可能一些别的浏览器也支持chrome拓展, 我并没有仔细看. 

### 如何加载/打包拓展程序

在浏览器地址栏输入[chrome://extensions/](chrome://extensions/)就可以看到拓展啦. 这里简单说一下4个按钮:

+ 右上角`Developer mode`勾选以后进入了开发者模式
+ 下方`Get more extensions`可以进入商店选择别人写的拓展
+ 正中的位置左边的按钮`Load unpacked extension`是开发的时候加载的按钮
+ 正中的位置右边的按钮`Pack extension`作用是打包完成的拓展.

然后的话如果可以把自己开发的拓展注册在谷歌上. 也不贵.

## 一个可以运行的拓展程序的组成部分

只要`Load unpacked extension`成功就可以算一个拓展了. 一个拓展需要:

+ 一个文件夹, 加载的时候就加载他.
+ 一个`manifest.json`文件.

好了. 

那么`manifest.json`的内容呢, 如下:

```json
{
	"name": "myExt",
	"version": "extVersion",
	"manifest_version": 2
}
```

没错, 只需要3个字段拓展就ok了. `manifest_version`一定是数字2. 其他的为字符串, 内容随意.

## 常用内容介绍

[chrome拓展的文档](https://developer.chrome.com/extensions/getstarted)在这, manifest的字段很多, api更多. 这个章节讲一些常用的api和插件运行方式.

### manifest

+ `description`: 项目描述
+ `icons`: 显示在拓展界面的图表
+ `browser_action`: 拓展对浏览器的影响. (比如小图标的显示, 右击菜单等)
+ `content_scripts`: 对访问的页面进行操作的脚本.
+ `background`: 后台, 这个后面会讲
+ `options_page`: 选项卡的页面, 右击拓展图表会有选项的选项. 点击会进入这个配置的页面.
+ `perissions`: 需求的权限. 你的拓展可以调用的api的权限在这分配. 当然也回在用户加载你的拓展的时候被提示. 这是一些影响很大的权限. 比如操作storage(随用户名漫游的), 桌面提醒(与web的api是不同的), 操作书签(这个真的厉害了, 可以清空你所有书签), 右击菜单(这个也很帅)等.

### 后台

我们的拓展在`browser_action`中可以指定`default_popup`字段来指定一个点击图表后弹出的页面, 其实也就是拓展的主界面(也有很多拓展没有弹出页面). 这个页面用于展示, 关闭当前页面或者关闭弹出也就会关闭这个页面, 所以无法进行数据的保存.

那么数据的保存就有`background`指定的文件来做. 打开浏览器后background就会在后台运行. 并且他是有页面的(一般不指定, 因为大多情况没有意义). 在这里可以保存数据, 操作api.

也就是说后台类似于服务端, 弹出页面类似于前端. 他们的交互由api实现. 并且交互的api有个比较坑的地方, **接口需要即使相应, 只要有等待的操作会立即返回`undefined`**, 具体原理或者是否可配置还没有深入.

## API

好拉稍微介绍几个api. 这些api通常在`background`中调用的, 原因在上节说了, 少部分在弹出页面调用.

### 消息传递

这个api很重要, 等于是前端后端的协议了. 用起来很简单, 但是觉得坑也是有的, 在上节已经提到一个了. 然后他没有类似'事件名字'意思的字段, 就直接发个数据, 另外每次传递数据会带着当前tab的信息的. 我就为这个消息做了最简单的封装:

```js
class sender {
    send(event, data = null) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({request: event, data: data}, function (response) {
                resolve(response);
            });
        });
    }
}
class reciever {
    constructor() {
        this.events = {};
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            message.request && this.events[message.request] && sendResponse(this.events[message.request](message.data));
        });
    }

    on(event, fn) {
        this.events[event] = fn;
        return this;
    }
}
export let Message = {
    get sender() {
        return new sender();
    },
    get reciever() {
        return new reciever();
    }
};
```

### 桌面提示

这个桌面提示与h5接口略有不同, 可以**改变**, 可以销毁, 弹出的签名不是当前网站的host, 当然也不会requestPermission. 然后每个提示是有id的. 没有仔细想, 如果需要维护id的话应该比较花功夫. 这个是个极简版的:

```js
export let notifier = {
    pop: (content, title = "友情提示", ico = "../imgs/ruby_q.png") => {
        chrome.notifications.create({
            type: "basic",
            iconUrl: ico,
            title: title,
            message: content
        }, (cb) => {
            console.log(cb);
        });
    }
};
```



### badge

badge可以设置颜色, badge内容. 因为badge一般是个消息条数, 提示条数的东西, 限制3个字符(可能是4个), 超过长度会被省略号代替.

```js
export let badge = {
    setColor(color) {
        chrome.browserAction.setBadgeBackgroundColor({color: color});
    },
    setText(text, color) {
        chrome.browserAction.setBadgeText({text: text.toString()});
        if (color)
            this.setColor(color);
    },
    clear() {
        chrome.browserAction.setBadgeText({text: ""});
    }
};
```

### 储存

储存分为2种, 一种为`chrome.storage.local`, 本地储存, 另外一种`chrome.storage.sync`同步储存, 如果没有登录用户或者没有网的时候行为会与本地储存一致. 他与h5的storage也是不同的. h5的只能存字符串. 他可以存数组, 对象什么的. 这个我看来要使用还是需要做一些处理:

```js
export let storage = {
    set(key, value) {
        let obj = {};
        obj[key] = value;
        return new Promise((resolve) => {
            chrome.storage.sync.set(obj, (callback) => {
                resolve(`ok${callback}`);
            })
        });
    },
    get(key) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(key, (callback) => {
                resolve(callback[key]);
            });
        });
    },
    getAll() {
        return new Promise((resolve) => {
            chrome.storage.sync.get((callback) => {
                resolve(callback);
            });
        })
    },
    sAdd(set, key, value) {
        return this.get(set)
            .then((result) => {
                result = result || {};
                result[key] = value;
                return this.set(set, result);
            });
    },
    sGet(set, key) {
        return this.get(set)
            .then((result) => {
                return (result && result[key]) ? Promise.resolve(result[key]) : Promise.reject("set not found");
            });
    },
    sRem(set, key) {
        return this.get(set)
            .then((result) => {
                if (result && result[key]) {
                    delete result[key];
                    return this.set(set, result);
                } else {
                    return Promise.reject("set not found");
                }
            });
    },
    remove(key) {
        return new Promise((resolve) => {
            chrome.storage.sync.remove(key, (callback) => {
                resolve(callback);
            })
        });
    }
};
```

## 告一段落

试水过程中顺带用`vue`(试水++) 做了前端(并没有画样式) 做了一些[小功能](https://github.com/fjonas/yosoro/tree/v0.0.1). 感觉不错. 将来可以拓展作为方便的小工具啦.
