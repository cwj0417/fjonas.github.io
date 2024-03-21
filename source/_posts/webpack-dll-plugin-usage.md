---
title: webpack dll-plugin使用方法
categories: 工作笔记
date: 2024-03-22 00:27:43
tags: [webpack]
---
dll-plugin是个官方插件, 但文档不那么清楚, 网上的文章也比较模糊.

前阵在使用的时候还遇到了个bug, 最后给webpack提了pr, 所以这里说一下dll-plugin的使用方法和简单的原理.

<!--more-->

## 总体效果

效果上来说, 把不容易变的代码分开打包. 比如第三方库和组件.

从形式上来说, 新增一个产生dll文件的打包过程, 原打包就做一下引用. 但dll文件涉及ci相关处理.

从打包结果上来看, dll文件就是一个library的输出, 并且多了manifest文件. manifest文件供使用方读取来获取对应的模块.

##官方例子

这个章节我们直接看[官方例子](https://github.com/webpack/webpack/tree/main/examples/dll)来感受下用法, 和一些option的用法.

### 打包dll

看这个例子的option: 

+ 有2个入口, alpha和beta.
+ 输出配置了library, 我们可以尝试把plugins配置去掉, 发现打包结果是基本一样的, 只有hash值不同.
+ 加载dll-plugin, 这样结果会输出manifest文件, 这个插件的配置内容也就是manifest文件的名字.

运行webpack后, 获得到2个library的打包文件, 和2个manifest文件. 因为配了2个入口.

### 使用dll

我们来到`dll-user`的例子. 可以看到这里调用了2次`DllReferencePlugin`插件.

配置也非常简单, 就是指了下manifest文件的位置. 使用方通过manifest文件知道模块的名字.

至于文件名在哪里, 应该要配置name, 并且与打包dll的output相同, 但这里直接写在html了.

另外, alpha和beta的区别是什么? 是scope. 我们来到example.js下就知道scope的意义了.

## 多入口的问题

我写了简单的测试, 看dll和cache谁更有用, 但偶尔发现了个bug.

在多入口的场景, dll的path没有配置template string. 导致manifest文件偶尔产生非法json.

在与朋友讨论后, 还得出过错误的结论(认为要清理, 并使用了不同清理方法), 最后发现多入口必须要通过path选项来产生多个manifest文件.

于是最后为webpack改进了这个问题的提示, 在错误使用的情况下报了错.

但中间还是经过了一些改动的:

+ 其实说多入口是不准确, 应该是多chunk.

+ 并且光判断path是不是有template string也不能保证是不是每个chunk都有不同的path.
+ 说多chunk也不准确, 一些内部情况下是有最终不输出文件的辅助(假)chunk的.

## 简单看下源码

最后简单看一下这2个plugin的大致内容:

### DllPlugin

可以看到代码很简单, 就引用了3个plugin:

+ `DllEntryPlugin`: 

  特别注意`entryOption`这个钩子是bail钩子, 是会覆盖其他入口的.

  虽然覆盖了原来的entry插件, 但其实把原来的entry作为自己的dependency.

  并且Dll模块的build方法啥事都没干. 所以Dll入口只是在原来entry外面套了一层空的module. 估计是用来配合manifest插件的.

+ `LibManifestPlugin`: 在emit阶段读取chunk graph, 为每个chunk生成一个manifest文件.

+ `FlagAllModulesAsUsedPlugin`: 配合`entryOnly`选项来用, 用来标记模块是否使用, 以防止optimize的时候被干掉的.

  这个plugin里有好多方法是实用的, 比如避免乾坤的入口被tree-shaking掉.

  (关于tree-shaking相关比较复杂, 之前的文章有详细说)

### DllReferencePlugin

读取: 在beforeCompile的时候读取option里的manifest位置, 并去读那个文件, 把结果保存在内存里. (`_compilationData`)

在compile阶段整理参数, 并调用`ExternalModuleFactoryPlugin`插件. 我看网上有人问dll-plugin和external的区别. 那么答案就是没什么区别.

