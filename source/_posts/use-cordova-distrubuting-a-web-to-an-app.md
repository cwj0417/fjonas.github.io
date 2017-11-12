---
title: 使用cordova来为web应用做app壳
date: 2017-11-09 16:14:20
categories: 代码与分析
tags: [入门,cordova]
---
想把一个网页发布成app要怎么做, 经过一番调研: phonegap, cordova, react native, weex. 这些可能是根据时间来的, apache买下了phonegap重命名成cordova, rn和weex的爹分别是fb和阿里, 推的web框架是react和vue. 目前weex不成熟, rn又强制用react, 所以决定先用cordova来做个皮包app.

<!--more-->

[cordova](http://cordova.apache.org/)可以把web发布到很多平台, 安卓, 黑莓, iOS, winPhone, ubuntu, windos, OS X. (没错, 电脑平台也可以发布, 然而有什么意义, 应该没有native api).

那么现在先走第一步, 把一个网页发布成iOS应用(因为我用的是iPhone5s). **本文的内容都是ios步骤, 安卓暂没研究, 这句话适用全文**, 另外, 本文**以构建[abandon](https://github.com/fjonas/abandon)为例**.

## 打包流程

参考了[如何创建cordova应用](http://cordova.apache.org/docs/en/latest/guide/cli/index.html)和[iOS平台发布方法](http://cordova.apache.org/docs/en/latest/guide/platforms/ios/index.html), 成功地在自己的破烂手机上装上了你好世界. 下面记录一边流程, 因为我认为这个框架是不应该放在版本控制中的, 所以这个架子要记一下的.

### 基础需求

硬件上:

+ 一台苹果系统电脑
+ 一台苹果系统手机
+ Xcode(并不硬, 为什么要写在这里)

软件上:

+ cordova: `npm i -g cordova`
+ xcode-select: `xcode-select —install`
+ ios-deploy: `npm i -g ios-deploy`
+ cocoapods: `sudo gem install cocoapods`

软件的话都会在下面的步骤里写到的.

### 步骤

首先安装cordova, xcode-select, ios-deploy

```shell
npm i -g cordova ios-deploy
xcode-select --install
```

选择你的工作目录, 开始创建cordova目录:

```shell
cordova create cordova abandon.fjonas abandon
// cordova create [路径] [id] [name]
```

创建成功以后进入目录并添加发布的平台

```shell
cd cordova
cordova platform add ios
cordova platform ls // 查看而已, 可选
```

然后如果没有安装过上面所述的软件, 在这里就可以安装了. 执行检查命令, 根据检查命令的提示安装软件. 安装好再运行检查命令, 直到通过检查.

```shell
cordova requirements
```

cordova的原理好像是把整个网页扔到webview里吧, web根目录是www, 里面已经放好了`index.html`了, 这次的实验项目用的是vue, 那么把项目的webpack输出改到这里就可以了, 当然真正的项目也要在这里进行`git clone`.

现在暂时用初始的网页来构建

```shell
cordova build ios // 或者 cordova build 来构建全部平台
```

然后运行模拟器来看效果:

```shell
cordova emulate android
```

现在用Xcode打开`platforms/ios/abandon.xcworkspace`, 选中根目录"abandon", 在"signing"里选择一个team. 如果有错误按照提示就可以. 至于如何产生team certificate, 因为我之前弄electron的时候已经弄过了, 好像是在`Xcode=>refrecens=>acoount`里操作一下就可以了.

### 模拟与安装

Xcode左上有个三角的"播放"按钮, 右边有个下拉列表, 选择设备型号, 把自己手机连上USB, 自己的手机也会出现在列表里.

选择设备, 按"播放"(run), 就会开启模拟器.

选择自己的设备, 按播放, 就会把app装到自己手机里了. 就是这么简单.

## 调整

### vue项目构建

在cordova目录下跑`git clone https://github.com/fjonas/abandon.git —depth 1`把项目拉下来, 改一下webpack配置把输出放到`www`目录下就可以了. [代码](https://github.com/fjonas/abandon)在这里.

### app图标

[cordova文档](http://cordova.apache.org/docs/en/7.x/config_ref/images.html#ios)中也有说如何添加自定义图标, [苹果开发文档](https://developer.apple.com/library/content/qa/qa1686/_index.html)说了一些具体尺寸, 因为我暂时只考虑iPhone端, 那么很简单了.

我从网上随便找了个图片, 调整了一下, 然后分别导出为60, 120, 180, 40, 80, 29, 58七种大小的**png** (苹果开发文档说明一定要带透明通道的png), 并放到对应的目录下. 然后在`config.xml`里配置如下:

```xml
<platform name="ios">
  <icon height="60" src="res/icon/ios/Icon-60.png" width="60" />
  <icon height="120" src="res/icon/ios/Icon-60@2x.png" width="120" />
  <icon height="180" src="res/icon/ios/Icon-60@3x.png" width="180" />
  <icon height="40" src="res/icon/ios/Icon-40.png" width="40" />
  <icon height="80" src="res/icon/ios/Icon-40@2x.png" width="80" />
  <icon height="29" src="res/icon/ios/Icon-29.png" width="29" />
  <icon height="58" src="res/icon/ios/Icon-29@2x.png" width="58" />
  <allow-intent href="itms:*" />
  <allow-intent href="itms-apps:*" />
</platform>
```

小插曲, 60是图标, 29是任务界面的缩略图, 这都是用血试出来的.

然后运行`cordova build ios`, 在Xcode里run起来, app图标就变啦.

### 图标工具

因为适配各个图标太累, 想自己写个工具, 想在npm找注册名字的时候发现已经有小哥哥写好了工具, 名字叫`cordova-icon`和`cordova-splash`, 轮子可以造, 但不是在现在这种紧急的时候, 所以推荐使用噢, 很方便.

## trouble shooting

### cordova create 失败

在cordova create的时候报了254错, 如下

```
Error: Uncaught, unspecified "error" event. (  Error from Cordova Fetch: Error: npm: Command failed with exit code 254 Error output:
npm ERR! not a package /usr/local/lib/node_modules/.cordova_npminstall/node_modules/.7.1.0@cordova/node_modules/cordova-lib/node_modules/cordova-create/node_modules/cordova-app-hello-world/index.js
npm ERR! addLocal Could not install /usr/local/lib/node_modules/.cordova_npminstall/node_modules/.7.1.0@cordova/node_modules/cordova-lib/node_modules/cordova-create/node_modules/cordova-app-hello-world/index.js
npm ERR! Darwin 16.7.0
npm ERR! argv "/usr/local/bin/node" "/usr/local/bin/npm" "install" "/usr/local/lib/node_modules/.cordova_npminstall/node_modules/.7.1.0@cordova/node_modules/cordova-lib/node_modules/cordova-create/node_modules/cordova-app-hello-world/index.js"
npm ERR! node v6.1.0
npm ERR! npm  v3.8.6
npm ERR! path /var/folders/81/f_57f26j30zcrgzy5pc2n0rc0000gn/T/npm-733-4cc4760b/unpack-99633e40/package.json
npm ERR! code ENOENT
npm ERR! errno -2
npm ER
```

原因是没装好, 我一开始用cpmn装的, 卸了重新用npm或者yarn装就行了. (实测是用npm装的).

### build失败

在运行`cordova build ios`以后报错, 签名错误, 只要在Xcode里设置好签名再运行就可以了.

### 选择签名失败

在cordova官网例子中的项目id`com.example.HelloWorld`选择签名的时候会报错, 原因不知道, 把名字改了就可以了, 我这里改成了`abandon.fjonas`, 是git地址的反写.

### 连接手机失败

在安装到手机的过程中, Xcode提示手机正忙. 这个是Xcode9的bug? 解决方案是重启Xcode, 重启手机, 也许只要重启一个就可以了, 我重启了2个, 问题解决了.

### 构建以后白屏

这个问题非常大, cordova构建了vue的dist文件以后进去是白屏, 最后发现原因是cordova构建的时候js引入的目录错误了. 最后查到原因是webpack配置里`assetsPublicPath`设成了`/`, build的时候把这个杠加进去所以路径错了.

## 以后

把网页弄到移动设备上会产生许多问题, 设计不同/适配是小事, 前后端分离, 本地起server, 可能用到ssr等. 眼前最大的问题可能是数据储存到哪.