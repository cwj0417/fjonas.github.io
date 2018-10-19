---
title: git操作总结
date: 2018-07-31 10:24:57
categories: 编码与分析
tags: [git,应用]
---
昨天在工作中需要把一个commit提交到另外一个比较老的分支上, 在解决问题以后决定对git操作进行整理, 之前的git操作有点随意了.

<!--more-->

这次的整理的方式是: 以日常开发经常做的操作为线索, 逐个整理操作方式. 于是从新建一个repo开始, 然后在多处操作就当模拟多人开发了.

本文在每个问题(每个标题)下会先写最简单的写法, 再使用`别的做法`为标签来写不是最简便的方法, 并做一些简单解释.

我在本地创建了2个文件夹, 作为2个工作空间, 来模拟推/拉/冲突/分支等操作.

**奉上[原始资料: git手册](https://git-scm.com/docs)**

## 建立版本库

在github上新建了一个repo. 把版本库拖到本地.

```shell
git clone git@github.com:cwj0417/gitop.git ./
```

`./`这个参数代表在当前目录建立, 默认是新建一个同名文件夹.

**别的做法:**

```shell
git init
git remote add origin git@github.com:cwj0417/gitop.git
```

在当前文件夹下建立了repo, 并添加一个远程仓库, 配置远程仓库的本地名字(origin)和地址. 现在的状态使用`git remote -v`可以看到remote的状态. 前面的`git clone`是快捷做法.

顺带一提, 如果项目较大又只需要最新代码, 可以加上参数来减少拉取的代码. `git clone <repo> --depth 1`.

## 提交代码

在做出更改之后, 把文件添加到工作区, 并提交到本地repo.

```shell
git add .
git commit -m 'first commit'
```

`git add`后面的`.`代表添加所有工作区的变化到stage.

当然这个`.`可以改成文件名或者文件夹, 来分批commit改动.

**别的做法:**

如果改动的文件只是修改了内容(没有产生create或者delete). 可以省去`git add`, 在commit的时候加参数:

```shell
git commit -a -m 'modify: develop'
```

## 推送代码到远端

```shell
git push
```

就搞定了. `git push`的语法很复杂, 只是因为我们当前只有一个分支简化了语法.

**别的做法:**

例子中的repo是新建的, 所以只有一个追踪分支, 如果有多个, 就要用完整的语法:

```shell
git push origin master:master
```

解释: origin代表远程主机名字, 因为一个repo可以有多个远程主机. 表示对这个远程主机进行操作.

master:master 把本地的master分支推到远程的master分支, 相同分支名可以简化为master.

那么在多个分支下如何追踪分支呢?

```shell
git branch --set-upstream-to origin/master
```

解释: 把本地的master追踪到 origin为本地名字的远程分支 的master分支.

那么可不可以在多分支的情况下至输入`git push`呢

```shell
git push -u origin master
```

这样设置了默认分支, 下次直接`git push`就行了.

## 从远端获取到代码

```shell
git pull --rebase
```

如果没有追踪分支, 那么就需要:

```shell
git pull origin master:master --rebase
```

和push的原理一样, 只是这里的`master:master`的方向与push相反, 是<远端分支>:<本地分支>. 当然如果分支名一样就可以简写成`master`.

当然也可以和push一样追踪分支. 代码一样不重复写了.

**别的做法:**

```shell
git fetch
git merge
```

以前听了同事的一个说法, 不要pull, 很危险. 现在明白了以后觉得直接pull没有任何问题, 估计这个说法也是以讹传讹. 意思只是: merge是会改变工作区的指令. 明白pull会改变工作区就行了, 只是一个快捷操作. 如果怕出问题, 可以先commit到本地repo, 如果出了很难解决的冲突直接reset就行了, reset操作会在后面说.

**搞笑的做法:**

之前一直不知道rebase, 那么就很有意思了, 我是这样做的:

```shell
git stash
git pull
git stash pop
```

哈哈. 这样来避免产生merge commit. 对了之前没说, `--rebase`参数是这个作用.

**如果产生了冲突:**

手动修改好冲突以后

```shell
git add .
git commit -m 'resolved conflict'
git push
```

就可以. 也可以把commit替换为`git rebase --continue`, 如果想把工作区状态回到rebase前, 可以执行`git rebase --abort`.

## 撤回代码

发生错误在所难免, 这个部分说一下发生了非预期的提交应该怎么做.

### 查看历史commit

```shell
git log
```

在发生问题的时候就体现出了commit的重要性, 所以可以在工作流里加上commit钩子来验证commit内容.

那么如果想看每个提交的改动:

```shell
git log --stat
```

或者查看代码的具体改动:

```shell
git log -p
```

那串很长的东西就是commit号, 作为操作依据.

### 回滚

回滚动作:

```shell
git reset <commit>
```

这里的<commit>号可以是那串很长的东西, 也可以是: `HEAD`, 代表最近的提交, 或是`HEAD^`, `HEAD^^`以此类推, 代表倒数x次的提交.

效果:

把commit重置到目标节点, 工作区代码不变. 也就是**回到写好代码, 但没有add和commit的状态**.

当然也可以把工作区代码也被撤销. 但是算敏感操作, 因为工作区代码撤销就等于删除了目标commit之后的工作代码. 只要加个参数.

```shell
git reset --hard <commit>
```

另外还有个参数`--soft`, 作用是把工作区变成已经add但没有commit的状态.

顺带一提还有一个参数``--mixed``是默认参数, `git reset <commit>`没有加参数就是这个效果.

**回滚以后的效果:**

首先要明白这个操作回滚的是本地repo, 所以reset以后就变成了退回版本而导致落后远端版本, 就意味着需要fetch和merge才能继续提交, 和远端代码(之前错误提交的代码)如果有不同还需要解决冲突.

## 回滚已经提交的内容

```
git revert <commit>
```

效果和手动该文件一样

## 建立新分支

现在单分支的多人合作的基本流程已经差不多了, 下面的部分来看看常用的分支操作.

场景是如果要进行容易出错的功能, 或是对某个发布的公司做出特别的改动, 就需要新建分支.

```shell
git checkout -b <branch>
git push origin <branch>
```

`git checkout -b <branch>`是在本地建立分支, `git push origin <branch>`是把新建的分支推到远端.

## 拉取/切换到新分支

```shell
git fetch
git checkout <branch>
```

`git fetch`是拉取远端代码, `git checkout <branch>`是切换分支.

## 合并分支

在功能开发完成以后就要把功能分支合并到主要开发分支上了.

```shell
git checkout master
git merge <branch> --no-ff
```

`git checkout master`切换到master分支, `git merge <branch>`将<branch>的代码内容合并到master. `--no-ff`会使合并产生一个节点, 可以方便查错.

## 打标签

在大版本节点或是发布点打标签可以方便回滚(滑稽).

```shell
git tag 'tag-name'
git push origin --tags // push所有标签
git push origin 'tag-name' // push单个标签
```

## cherry-pick

这个场景是用在要临时加急发布一个功能, 或是本来需要发布的功能之后又被提交了代码的情况.

这个时候一般develop分支上有n个commit, 原先发布的动作可能是: 把分支切到master, merge develop. 但是现在不能把这n个commit全merge了, 只能选择某些commit来merge.

```shell
git checkout master
git cherry-pick <commit>
```

这样做会产生一个cherry-pick的commit, 没有什么毛病, 但是如果要cherry-pick多个commit, 想一次性commit, 可以加上`-n`的参数来避免自动commit.