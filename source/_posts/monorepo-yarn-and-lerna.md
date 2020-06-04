---
title: 前端monorepo对依赖包的处理
date: 2020-06-03 23:41:30
categories: 工作笔记
tags: [monorepo]
---
随着行业发展或者是公司发展, memorepo的概念走进了我的面前, 也许早就在行业里出现了. 不管memorepo会不会走下去, 先来了解一下.

<!--more-->

## 为什么会有monorepo

一个概念的出现一定是为了解决一些问题, 一个时代出现一个系列的工具是因为行业的生产工具发展到了一个阶段.

在前端, 关于多仓库的问题也分成不同场景, 所以相对的monorepo的使用也是不同的, 我们在不同场景的开发中可能遇到以下问题:

+ **仓库多**: 新人接手难, 维护项目的时候记住仓库名字难, 挑战电脑性能.
+ **重复安装npm依赖**: 一个公司使用的基本框架大多是一样的. 有几个项目, react和antd或者vue和elementui就要装多少遍. 这些体积比较大的包重复装几十遍, 即使电脑硬盘够大, 让人心里也挺不舒服的.
+ **升级公共组件**: 若一个公共组件进行了升级, 那么所有引用他的项目都要升级依赖.
+ **模块间的互相依赖**: 在开发公共lib的时候需要调用其他模块, 要多次反复操作link, 还要记住各个包名.

于是就出现了一个想法: 把多个仓库合成一个仓库, 每个仓库又可以独立运行, 有自己的`package.json`, 有自己的依赖和脚本, 复制出来是个可以独立运行的仓库.

把仓库合在一起, root仓库就可以对子仓库的信息进行处理, 来简化与管理子仓库的常规操作.

当然, 把仓库何在一起, 也会有一些显而易见的问题, 有的容易解决, 有的不容易解决, 有的可以通过工作流的上下游解决. 比如:

+ **代码权限问题**: 如果各个子仓库要控制代码权限, 那么git可能就不是monorepo契合的版本控制工具了.
+ **git分支问题**: 虽然子仓库可以独立运行, 但版本控制还是在root仓库的, 一个仓库的分支要影响其他项目的, 这显然有问题. 这个问题可能可以通过工作流上下游的工具, 或者git-submodule来解决.

权限问题和分支问题, 也可以通过合理组合仓库, 把功能, 关系密切的仓库合成一个仓库.

## yarn workspace vs lerna

前端的monorepo基本就靠这2个.

他们的模式都是在root仓库下建一个文件夹, 一般是`packages`, 然后里面的每个文件夹里都是一个子仓库. 他们也都提供了一些cli命令来处理上节所提到的问题. 他们有相似的功能点, 也有不同的功能点.

双方的官方都表示, 他们并不是同质竞争, 而是上下游合作关系, 在api体现了. 但就目前的情况看来, 还是有一些重复的api, 可能是lerna希望离开yarn也能活着.

具体来说, yarn的功能更接近于基层(当然了, 因为他是个npm client), 在依赖管理上做得更好. 而lerna的主战场并不在依赖管理, 而在npm版本和git, 脚本层面.

现在公司的使用场景里, 更需要的是对依赖包的管理, 所以用到lerna的地方比较少, 我尝试了下yarn的功能和效果, 进行了一些总结.

## 实践细节

把yarn和lerna进行对比, 基于yarn的功能对比, lerna还有很多其他的功能.

我的实验结果都基于yarn1.22.4版本.

### 定义workspace

`package.json`里有2个特点yarn就认为是有workspace的repo: 

1. `private: true`.
2. `workspaces: ["packages/*"]` 这是个快捷写法, 也可以在数组里写每个子workspace的name.

在yarn0.x的版本里, workspace还要通过配置开启的. 1.x是默认开启的.

lerna的话, `lerna init`就行了, 在目录下会产生一个`lerna.json`

### 安装依赖的行为差异

yarn安装`yarn`, lerna安装`lerna bootstrap`.

lerna的行为比较粗暴, 直接cd到每个子目录, 运行装包命令.

yarn就很智能, 分析每个`package.json`的内容, 智能安装, 后面细说.

### lerna与yarn一起使用

yarn提供了2个方法, 可以在一些行为上使用yarn的特点.

1. 执行cli时加 `--use-workspaces`.
2. lerna.json添加`{“npmClient”: “yarn”, “useWorkspaces”: true}`.

### 模块互相依赖

在这点上, yarn和lerna都做了处理, 只要定义了workspace或者lerna, 模块之间都可以通过软连接引用到, 并且优先内部引用.

### 操作子模块

yarn和lerna操作子模块的思路是不同的.

yarn的思路: 指定一个模块, 然后执行命令; lerna的思路: 执行一个命令, 然后指定子模块.

+ yarn: `yarn workspace (ws-name) add module`. 

  yarn也可以手动cd到子模块进行操作, 我尝试了`yarn`命令, 结果是不会忽视root模块, 执行结果是等同根目录执行的.

  另外, **yarn的workspace的子ws名字是根据`package.json`的name字段来的, 而不是文件夹名字.** (别问我怎么知道的, 枯了)

+ lerna: `lerna add module --scope (ws-name)`. 

  lerna的[filter-options](https://github.com/lerna/lerna/tree/master/core/filter-options)系统是支持glob的, 所以这点很明显强于yarn.

yarn在2.x版本也尝试用lerna的思路, 增加了`yarn foreach --include/--exclude`的api. (但我切到了rc版本并没有实现, yarn为啥做文档有却没发布这这烂事儿)

### yarn是如何处理子模块依赖的

无论是在root层还是子ws层, 执行install和add的时候, yarn都会对模块依赖进行整理. 特点如下:

+ 依赖版本的记录只存在于root层的`yarn.lock`, 子ws不会有.
+ 所有依赖优先安装在root下, 只有当子ws依赖于不同版本的相同包, 才会在子ws下产生node_modules.
+ 如果有多个子ws, 拥有不同版本的相同包, 那么, 优先把相同版本多的安装到root下, 第二优先版本低的.
+ 在每次add/install操作后, yarn都会重新计算哪个版本的包应该在root, 并且进行文件移动操作. (也就是可能在一次add操作后, 某个子ws里的node_modules中的文件会减少)

### yarn add -W

最后, 有一些dev dependency, 需要在root里写在script里的, 可以通过这个命令硬装到最外层node_modules里.

