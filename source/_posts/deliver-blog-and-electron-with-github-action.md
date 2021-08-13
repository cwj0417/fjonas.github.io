---
title: 用github action来给博客和electron应用做部署与自动更新
date: 2021-08-04 16:10:43
categories: 工作笔记
tags: [electron,ci,github action]
---
travis-ci从21年6月15开始停止服务, 新版本需要迁移才能继续服务, 这意味我的博客和electron应用都要去进行迁移了.

<!--more-->

## 困难

在迁移过程中老的travis脚本一直报错, 在查询文档完全没头绪之后在stackoverflow上找到了答案, 要手动选择一个plan才能正常跑ci. 即使是选免费的, 所以我选了一下免费plan.

ci终于和以往一样跑成功了, 但发现免费plan的额度是不会再生的, 也就是真正意义上的"试用", 原来travis-ci收费了.

于是我尝试去找了免费ci, 找到了circle-ci. 每个月都有1000分钟免费时间, 并且vue和facebook等都在用. 于是照着circle-ci的文档配了ci.

在配完ci运行以后发现, circle-ci有个概念叫"excutor", macos和windows是要收钱的, 那这很明显不能符合我打包electron应用的需求了.

于是放弃, 最后找到了github action.

## github action

github action是github搞的ci工具. 他说自己是workflow, 但我没能说出workflow和ci/cd的区别.

[github action](https://docs.github.com/en/actions)有2大优点: 大公司靠谱, 免费用户没有功能限制. (travis以免费为名实为试用, circleci免费用户阉割功能)

github action配置形式是在repo的指定文件夹写yaml文件. 下面介绍下一些基本概念:

## 概念简介

文档里有个一句话概括, 我觉得很帅:

> An event automatically triggers the *workflow*, which contains a *job*. The job then uses *steps* to control the order in which *actions* are run. 

这几个概念的关系是:

**event** ==(触发)==> **workflow** ==(包含多个)==> **job** ==(包含多个)==> **step** ==(包含多个)==> **runner**

并且, **step** + **runner** 可以被抽成一个 **action**. 并发布到云上给其他人用.

下面说说我对各个概念关系的理解:

+ **event**和workflow. 每个**workflow**都是一个文件, 每个**workflow**都要指定一个event来触发这个**workflow**.
+ **workflow**和**job**. 一个**workflow**可以包含一个或多个**job**. 不同**job**作为一个运行单位可以同步运行也可以异步运行.
+ **step**, **runner**, **action**. 在我理解是同级的, 只是影响显示分组, 不影响实际执行.
+ **action**其实是一个**job**. 但使用的时候是**step**的下级.

## 例子

我拿了3个项目来写不同复杂度和用处的github action. 这里分别介绍.

### 运行测试用例

[第一个例子](https://github.com/cwj0417/sxdm/blob/main/.github/workflows/test.yml)最简单, 分支被推送的时候运行测试用例. 简单介绍下步骤.

```yaml
name: test
on: [push]
jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '14.x'
      - run: yarn
      - run: yarn test
```

因为很短, 所以逐行分析每行配置的作用:

1. name: test     当前工作流的名字, 随便叫
2. on: [push]     在分支被推送的时候运行这个workflow
3. jobs:     job声明的键, 没什么意义
4. unit-test:     job的名字, 随便起
5. runs-on: ubuntu-latest     job运行环境. 这里可以设matrix来让job运行在多个环境里
6. steps:     step声明的键, 没什么意义
7. uses: actions/checkout@v2     使用别人的action, 作用是拉代码.
8. uses: actions/setup-node@v2     同样是别人写好的action, 作用是设置node环境.
9. with: node-version: '14.x'      给上面action传的参数, 意思是要用node版本14
10. run: yarn      执行命令`yarn`安装依赖
11. run: yarn test     执行命令`yarn test`运行测试脚本

就是这么简单然后根据这个workflow的输出信号, 来判断这段ci的失败和成功, 还会在github的commit界面上显示一个小勾或者小叉.

### 部署博客

之前在travis-ci上已经能做到, 推了代码后, 博客网站直接更新. 这次迁移比以前容易多了, hexo官网已经写好了github action的action插件, 直接用就行了. (顺便更新了hexo的node和pug版本)

[例子](https://github.com/cwj0417/fjonas.github.io/blob/source/.github/workflows/build.yml)中可以看到有`${{ secrets.GITHUB_TOKEN }}`来作为token的占位符. 这里还有2个巨大的便捷处: 

1. 免配置, 我去github personal token看了, 没有一个token被使用的, 也就是配置token是不需要去新建一个token的. 文档没有特别仔细看, 我理解为这是个虚拟token.
2. 没有额外的设置步骤. travis-ci除了在github生成token, 还要去travis的设置里设置token, 用github action省去了这2个麻烦的步骤.

### 部署electron应用

[例子](https://github.com/cwj0417/schedule-pro/blob/main/.github/workflows/build.yml)中有许多注释, 我尝试了各种action, 创建release, 上传artifact, 把artifact上传至release等. 后还是发现直接用`electron-builder`提供的功能比较好.

他的部署功能集成在npm build命令里的, 我理解做了几件事:

1. 整理更新文件.
2. 把应用的主进程和渲染进程打包, 根据配置, 把更新文件一起打入包内.
3. 根据配置, 把应用包和更新文件一起传到指定的地方.

这里注意要把`releaseType`设置为`release`, 默认是`draft`, 还要去手动发布.

这比自己写github action方便的地方有:

1. 支持auto-updater, auto-updater有约定schema的更新文件, 自己很难处理.
2. 不需要配置麻烦的action.

只要使用`electron-builder`的npm build命令, 再引用对应的npm包`electron-updater`在[主进程里](https://github.com/cwj0417/schedule-pro/blob/main/src/main/index.ts#L13), 自动更新就能完成了. 要注意的是. 如果应用没有签名, 是不能自动安装的, 但可以获取更新信息引导用户手动下载哦.