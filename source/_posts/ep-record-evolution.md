---
title: 癫痫发作记录的几个改进
categories: 工作笔记
date: 2024-11-22 02:18:17
tags: [shortcuts,github action]
---
因为有记录癫痫发作的需求, 一开始是习惯性的使用苹果的notes来记录.

随着记录越来越多, 很多需求也慢慢出现了, 最近有了一套完整的流程, 觉得比较有意思, 就做一下记录.

<!--more-->

## 翻看历史很难找到目标

在聊天过程中发现已经不记得国庆的事情, 那么就想知道从国庆到现在有没有发作. 一天的记录就要占小半屏幕, 一个多月的记录很难找到想找的信息.

另外, 发作是有很多种类的, 想知道种类间有没有关系, 也是很难的.

所以我写了一个可视化的页面, 分为2个部分, 日历部分和详情部分. 日历上会标注一些关键信息, 方便跳转, 点击日期就会在详情部分滚动到对应的日期.

另外会把不同发作类型在格式化数据中体现, 并渲染在日历上.

渲染的方式我选择了canvas, 并把canvas的context作为参数注入到渲染方法中, 这样可以使渲染策略变得很灵活.

## 每天每次都要输入日期和时间

记录是使用notes的, 问题有2个.

第一是每天都要输入日期, 并且每次发作都会输入时间, 每天10次发作, 一个月就要输入300多次, 而很明显这些操作是可以省略的.

另外老婆发作告诉我, 我记录, 他也看不到, 有时候轻微的自己可以记录, 也得告诉我, 就需要使用notes的共享.

notes的共享需要点"invite with link"才可以共享, 之前尝试直接发送airdrop只是复制. 并且中国区通过icloud分享是有bug的, 只能通过imessage发送分享.

输入日期的问题我使用了shortcuts来解决. 我写了5个脚本互相调用.

主要调用到的函数很简单. 比如获取当前日期, 获取当前时间, 写入到notes. 再根据具体业务调整就可以了, 没什么难度.

## 同步数据的工作量大

同步数据的问题也分为2个.

首先数据写在代码里的, 所以每次要提交代码.

另外数据格式与代码仓库里的数据肯定是不同的, 要手动整理数据, 也是个很大的工作量.

接上步, 既然日期和时间用shortcuts生成了, 那么格式就很规整, 可以用正则分析出来, 在shortcuts里用的"match text"相关的api.

一些特殊字段, 发作次数, 使用shortcuts, 让用户选填, 加上通过正则得到的数据, 就整理好了格式化数据.

第二点, shortcuts可以触发github action, 并且可以带参数, 那么就可以通过github action来提交代码了.

提交实际, 我选择"每天早上", 因为睡觉前后很容易发, 在整理好睡觉的发作后, 把前一天的内容提交给github action.

shortcuts提交给github action, 使用的是ga的触发方式"workflow_dispatch".

在github rest api的文档中找到workflow的触发方式, 创建一个personal access token(pat)就可以通过shortcuts的get_url_contents来调用了. (这个api名字让我想到了php)

需要注意的是, 手动触发的workflow是不会触发其他workflow的. (我这里需要触发on_push的来build页面并发布到github page)

那么需要新建一个pat, 用这个pat来checkout代码和提交代码.

强调一下我踩过的坑, 需要用这个pat来checkout代码的, 而checkout一般会用`actions/checkout@v4`, 注意在这里设置环境变量.

然后在提交代码的时候先`env`再在这个`env`下面`run`命令就好了.

简单说一下ga的context. 默认情况下执行ga是可以直接推代码的, 因为context默认有自己githubtoken.

我们的场景需要自己新建pat. 然后到repo的setting里的action里设置secret, 这样ga的context的secret命名空间就挂上你设的变量了.

在配置ga的workflow的时候, 使用类似`${{secret.变量名字}}`来设置`run`脚本的`env`或者插件的`with`.
