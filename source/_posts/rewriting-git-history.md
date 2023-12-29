---
title: 改写git历史
categories: 工作笔记
date: 2023-12-29 15:32:43
tags: [git]
---
前阵给webpack-dev-server提了pr, 好不容易等到老板来approve了, 结果因为commit作者信息错误而不能被merge.

对git一直啥都不懂, 所以[看了一下文档](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History), 并记录一下如何改写git历史.

<!--more-->

## 目标

改写git历史可以做到实现任何效果: **修改commit内容, 修改作者, 为commit增加文件, 拆分commit成多个, 删除commit**.

另外有一点要注意的是, **如果代码已经push到remote, 那么需要使用 -f 参数来push修改后的代码**, 并且需要 -f 的仓库权限, 同事可能也会因为commit的修改感到迷惑.

如果不使用 -f 来push, 那么需要先 pull 再 push, 这样会产生一些平行的commit, 也会让人感到疑惑.

所以改写历史操作最好在push到remote前操作, 这是我们最后的机会.

## amend

```
git commit --amend
```

执行这个修改最近的一条commit的内容.

执行完后会进入文本编辑, 修改完保存即可.

因为amend可以实现任何修改效果, 可以这样:

+ 先`add`再`amend`可以把新add的内容合并到最近的commit.
+ 可以配合`--author=<xxx>`来修改作者, 或者配合其他commit的参数.

## rebase

如果要对多个commit进行操作, 就需要用到rebase.

rebase是用来手动整理commit的, 如果使用在当前分支上, 就可以满足修改多个commit的需求.

```
git rebase -i head~x
```

这是我们场景中rebase的用法, x是指修改的commit数量. 

rebase后会出现文本编辑器, 大概是这样:

```
pick f7f3f6d Change my name a bit
pick 310154e Update README formatting and add blame
pick a5f4a0d Add cat-file
```

需要注意到的是, **rebase交互文本的commit顺序是和git log相反的**. 越早的提交在越前面.

我们需要修改的是, 每行的第一列(操作)和最后一列(commit内容).

主要需要了解的, 就是操作. 下面说四个常用的操作. 

### 删除commit和交换commit位子

操作设置为 d (drop), 可以删除commit, 交换commit的顺序, 就可以交换commit的顺序. 举个例子.

```
pick a5f4a0d Add cat-file
d 310154e Update README formatting and add blame
pick f7f3f6d Change my name a bit
```

如果这样修改文件并保存, 中间的commit将会被删除. (代码改动会被删除)

并且剩余的2个commit会交换位子.

要注意的是, 交换commit位子是可能产生冲突的, 因为rebase过程就是模拟修改代码并commit.

### 编辑commit

如果把操作改成 e (edit), 在保存文件后, 会进入编辑模式.

编辑模式会把git的状态切换到每个你设置 edit 操作的 commit. 我们可以在这里执行 `git commit --amend` 来做任何修改.

这里的修改也包括上文所说的"插入一个新的commit"和"修改作者"等.

在对一个 edit 的commit操作完成后, 可以输入`git rebase --continue`来进行下一条edit 的commit的编辑. 直到全部完成, 会自动退出rebase.

当然也可以`git rebase --abort`来主动退出rebase.

### 合并commit

如果把操作符改成 s (squash), 在保存文件后, squash 的 commit 会合并进前一个commit, 并进入 合并后的commit 的编辑文本界面. 再次保存后, squash的commit 和 上一行的commit 就合并成了一个新的commit.

### 拆分commit

拆分commit是在edit的时候进行的.

其实是一种实践方式, 插入commit也是这个原理.

在edit的时候, 可以进行 `git remove`, `git commit`, `git add`, `git commit`的操作, 将当前commit拆分成多个.
