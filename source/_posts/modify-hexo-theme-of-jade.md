---
title: 修改hexo主题(Jade版本)
date: 2016-08-29 16:14:08
categories: 试水
tags: hexo
---
hexo主题虽多, 但是都没让自己完全舒服的, 真的没什么意思, 就着现在用的主题来修改吧。
<!--more-->
用的主题是jade写的, 稍微了解了下, 就是一个模板什么的, 气氛搞起来。

## 插入一个js

看了下模板, 大多模板都是继承(`extends`)了一个叫`base.jade`的模板, 那么好了,找到了这个模板, 根据以下引入方式：

```js
script(type='text/javascript', src='//cdn.bootcss.com/jquery/3.0.0/jquery.min.js')
```
```js
link(rel='stylesheet', type='text/css', href=url_for(theme.css) + '/style.css' + '?v=' + theme.version)
```
上面这个是引入自定义样式吧, 那如果我有样式直接写里面好了, 不再引入了, 注意到他引入的时候`url_for`这个函数, 我并不知道是干嘛的。
所以抱着试一试的想法写了`url_for(theme.js)`,如下：

```js
script(type='text/javascript', src=url_for(theme.js) + '/main.js')
```
然后在对应js文件下打了一下控制台, 成功了, 还真对得起我这张脸。

## jade的模板继承

官方是这么说的, 其实就是个模板的复用。
（因为英文不好看半天才明白原来这么简单的东西）

举个伪代码的例子：

```js
//文件名：parent.jade
html
    head
        title i am title
        block script
    block body
    block foot
```

上面的模板出现了3个block, 如果有模板extends了这个模板, 只要改写block就可以重载这个block的部分而继承父的其他结构。
比如：

```js
extends './parent.jade'
block script
    script(src='jquery.js')
block foot
    div.footer
        copyright 1991~2016
```

效果就是这个页面继承了父的内容, 并引入了jquery, 把页脚加了版权信息。

**对于我们的应用： 我在`base.jade`中加入了block script, 这样就可以在不同的模板中自定义引入哪些js了。

## 引入小模块

语法是`include`, 引入文件可以不加拓展名, 需要是jade文件。
比如tag, footer 等小模块就可以如此引入。

## 我修改的内容
+ 修改背景
+ 把博客的链接指向改为新tab页面
+ 用插件增强md代码快
+ 增加post模板的页尾
+ 把火箭回到顶部改为kotori回到顶部

