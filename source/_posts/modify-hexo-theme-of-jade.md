---
title: 修改hexo主题(Jade版本)
date: 2016-08-29 16:14:08
categories: [试一试]
tags: hexo
---
hexo主题虽多， 但是都不少女， 真的没什么意思， 就着现在用的主题来修改吧。
<!--more-->
用的主题是jade写的， 稍微了解了下， 就是一个模板什么的， 气氛搞起来。

## 插入一个js

看了下模板， 大多模板都是继承(`extends`)了一个叫`base.jade`的模板， 那么好了，找到了这个模板， 根据以下引入方式：

```
script(type='text/javascript', src='//cdn.bootcss.com/jquery/3.0.0/jquery.min.js')
```
```
link(rel='stylesheet', type='text/css', href=url_for(theme.css) + '/style.css' + '?v=' + theme.version)
```
上面这个是引入自定义样式吧， 那如果我有样式直接写里面好了， 不再引入了， 注意到他引入的时候`url_for`这个函数， 我并不知道是干嘛的。
所以抱着试一试的想法写了`url_for(theme.js)`，如下：

```
script(type='text/javascript', src=url_for(theme.js) + '/main.js')
```
然后在对应js文件下打了一下控制台， 成功了， 还真对得起我这张脸。

## 我修改的内容
+ 修改背景
+ 把博客的链接指向改为新tab页面
+ 用插件增强md代码快
+ 把火箭回到顶部改为kotori回到顶部

