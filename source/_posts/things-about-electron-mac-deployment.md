---
title: electron的mac包部署发布流程
categories: 工作笔记
date: 2022-10-19 22:55:58
tags: [electron]
---
偶然发现[之前开发的效率软件](https://github.com/cwj0417/schedule-pro)在github上下载了不能打开, 弄完签名发现以前弄过, 但没记录, 现在简要记录一下在mac平台上发布部署流程.

<!--more-->

## icns图标

mac打包需要icns图标, 是mac specified的. icns虽然会在finder里显示图片, 但他不是一个图片, 而是一个图片集合.

准备好一个`icon.png`后需要2个步骤来生成icns: 使用sips裁剪图片, 使用iconutil生成icns.

```shell
mkdir icons.iconset
sips -z 16 16 icon.png -o icons.iconset/icon_16x16.png
sips -z 32 32 icon.png -o icons.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png -o icons.iconset/icon_32x32.png
sips -z 64 64 icon.png -o icons.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png -o icons.iconset/icon_128x128.png
sips -z 256 256 icon.png -o icons.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png -o icons.iconset/icon_256x256.png
sips -z 512 512 icon.png -o icons.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png -o icons.iconset/icon_512x512.png
sips -z 1024 1024 icon.png -o icons.iconset/icon_512x512@2x.png
iconutil -c icns icons.iconset -o icon.icns
```

这个sips在平时对图片进行裁切旋转拉伸也是好用的.

## code sign

mac打包必须经过code sign才能被下载使用. 步骤也挺简单的.

1. 网上下载一个最新的`apple wwdrca`(Apple Worldwide Developer Relations Certification Authority)放到keychain里的system里.
2. 在xcode的account里生成一个apple development证书.

好了, 完事. 但记得在换电脑或证书过期的时候要重新操作一遍. 我就是因为换电脑并过期重新操作的时候忘了以前怎么弄的又折腾了一下.

## ci code sign

我的ci用的github action, 其他的也类似.

electron-builder使用体验非常好, 接受base64证书, 而不需要在ci里写麻烦的流程. 我们要做的是:

1. 在keychains里把apple development证书导出p12文件.
2. 获取p12文件的base64值.
3. 在github新建一个environment, 设置2个秘密变量, 一个是base64值, 一个是导出p12时候设置的密码.
4. 在ci里指定environment为上个步骤创建的environment.
5. 在ci执行electron-builder的那一步新增2个env: `CSC_LINK`和`CSC_KEY_PASSWORD`分别指向环境的秘密变量. (要使用env变量不能export定义变量)

好了, 又完事. 这样ci环境也会进行code sign了. [如果觉得抽象就点这里看具体ci](https://github.com/cwj0417/schedule-pro/blob/main/.github/workflows/build.yml).



另外有个小细节, 如果不小心在keychains里把证书删了无法导出, 去xcode新建一个项目, 证书就会重新被产生了.

## auto update

直接使用electron-builder的auto-updater. 按照文档做好配置, call几个api, 非常丝滑, 就能达到非常理想的程度.

用户第一次下载并右击打开软件后, 以后我们推了代码后用户就能丝滑更新了.
