---
title: 用charles进行https抓包
date: 2017-10-25 15:42:08
categories: 工作笔记
tags: [抓包,入门]
---
之前用charles抓手机上的包做过一些小事情, 但是碰到https就停手了, 今天经同事指导成功地抓到了https的包.

<!--more-->

## 环境

为什么网上的教程不完全可用, 因为环境不同, 我使用的是iPhone5s with iOS 11.x, mbp with macOS 10.12.5, Charles 4.0.1.

## 工作原理

http抓包的原理是手机和电脑在同一个局域网, 手机查看电脑的ip以后通过电脑的代理来上网, 电脑在代理的时候把包抓下来了.

https原理是, 本来你浏览器直接拿到服务器的证书, charles动态为服务器生成证书, 并用自己的跟证书对他签名. 结果就是: charles接受到服务器的证书, 同时你的浏览器接收到charles的证书, 所以你的浏览器通过ssl与charles交互, charles通过ssl与服务器交互, 你的整个流程仍然都是ssl的.

## 操作过程

先说下http代理的操作过程, 可能有遗漏, 因为是太久前用的了.

1. 电脑手机连同一个网, 在电脑上敲shell`ifconfig|grep 192.168`查看电脑ip.
2. 手机连上wifi, 设置手动代理, 填上ip和端口8888.
3. 在charles的`proxy=>proxy settings`里设置相关的内容.

然后要弄ssl证书来抓https的包.

1. charles:`help=>ssl proxy=>install charles root certificate`, 然后会弹出来keychain access, 看到`Charles Proxy`是红色的, 说明一下点了charles的菜单以后证书就已经生成好了, 弹出这个界面是要你手动改一下证书的权限, 双击证书把权限改成always trust然后关闭就可以了.
2. 在手机浏览器打开`chls.pro/ssl`一路同意就可以了.
3. 这个步骤是iOS10+多出来的, [看链接](https://support.apple.com/en-nz/HT204477).
4. charles`proxy=>ssl proxy settings`在ssl proxy里add一个host`*`, port`443`就可以了. 也可以根据情况配置, 现在https越来越多, 几乎都是, 所以配这个问题不大.

好了, 事情已经搞定. 附上[文档](https://www.charlesproxy.com/documentation/proxying/ssl-proxying/)