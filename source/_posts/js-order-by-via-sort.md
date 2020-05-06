---
title: 用sort实现orderby
date: 2018-12-21 14:48:57
categories: 工作笔记
tags: [javascript,应用]
---
工作到了这个年数, 感觉那些基本函数语法已经跟人合一了, 根本不会为操作一些数据结构而思考半天了. 在做小程序的时候遇到了个orderby的场景, 结果发现没有以为的那么简单. 也许是之前不求甚解的原因, 那么现在来解决orderby的问题.

<!--more-->

## 问题的产生与探讨方向

在小程序中有个将list的某一条置顶的需求, 在初始化数据到时候可以使用数据库的orderby, 但在更新数据以后再重新初始化就显得有些不妥, 所以我尝试直接使用computed列表来解决这个问题.

所以现在的问题是: **输入list, 输出orderby置顶字段**.

之前以为的sort很简单, 我就尝试了: `arr.sort(i => i.stick)`. 字面看起来是根据stick字段来排序. 输出结果一团糟. 仔细思考了下又尝试了别的方法, 还是失败, 才决定仔细想一下应该如何处理.

## 对sort的理解与快速shuffle

先说一下之前对sort的理解.

sort接受的参数返回大于0或者小于0. 根据结果来排序.

所以有一个快速shuffle数组的方法:

```js
arr.sort(() => Math.random() - 0.5)
```

因为函数的返回结果一半是大于0一半是小于0的(不严格, 但之后也认为概率是一半一半). 所以任何输出进行了如此处理, 都会变成一个随机顺序的数组.

另外一个例子, 对一个数组: `[1, 2, 3, 4, 5, 10, 11, 12]`进行排序, 如果不传参数排序结果是错的, 因为默认是localCompare. 所以要写成:

```js
arr.sort((a, b) => a - b)
```

这样才能得到正确从小到大的排列.

以上就是我多年以来对sort的所有理解. 所以才会写出上面的: `arr.sort(i => i.stick)`这样搞笑的东西. 因为理解是有问题的.

## sort是如何排序的

因为不知道sort函数得到了结果后是如何排序的. 所以对sort的理解有问题. 而我们知道reduce就是从头到尾遍历并传递每次计算的结果. sort却不知道. 所以打出每次的返回值来看一下每次得到返回值后sort做了些什么.

我们要对不同数组进行同样的操作, 排序方法是一样的, 先写一下:

```js
const log = (a, b) => {
    console.log(a, b, a - b > 0)
    return a - b
}
```

开始对不同数组进行排序: 先来1到5

```js
[1, 2, 3, 4, 5].sort(log)
```

结果: `[1, 2, 3, 4, 5]`

```
2 1 true
3 2 true
4 3 true
5 4 true
```

尝试: 从5到1

```js
[5, 4, 3, 2, 1].sort(log)
```

结果: `[1, 2, 3, 4, 5]`

```
4 5 false
3 4 false
2 3 false
1 2 false
```

目前看来, sort应该是插入排序. 

```js
[3, 5, 7, 9, 2, 1, 6].sort(log)
```

看log的时候我把当前排序结果也打一下:

```
5 3 true [3, 5]
7 5 true [3, 5, 7]
9 7 true [3, 5, 7, 9]
2 9 false // 2还是与当前最大的9比.结果第一次false
2 7 false // 于是一路比下来
2 5 false
2 3 false // 比到最小的, 于是确定了位置 [2, 3, 5, 7, 9]
1 5 false // 1选择了与5比, 此时5是中间位置的数, 而不是最大的数
1 3 false // 然后一个一个比较下来
1 2 false [1, 2, 3, 5, 7, 9]
6 5 true // 6还是于5比, 此时5也是中间位置的数
6 9 false // 没有选择与7, 而是与9比了
6 7 false
```

从这些log能得出一些粗浅的结论:

1. sort是插入排序
2. 每次比较的数字会根据两个因素来决定: 分别是之前比较的结果和当前排序的位置

## 如何实现orderby

首先明确思路:

sort认为每个元素之间的关系是比大小, 所以我们需要做的是**写出任意两个元素的相对顺序的普遍公式**.

先构建一组数据:

```js
let gnrt = () => ({ age: Math.round(Math.random() * 50), height: Math.round(Math.random() * 200) })
let arr = Array.from({length: 10}).map(() => gnrt())
```

我们先建立`纯数字, 无顺序`的orderby来理这个思路.

```js
let orderby = function (arr, ...orders) {
	return arr.sort((a, b) => {
		let res = 0
		for (let order of orders) {
			if (a[order] - b[order] !== 0) {
				res = a[order] - b[order]
				break
			} 
		}
		return res
	})
}
```

调用`orderby(arr, 'height', 'age')`就得到了理想的orderby结果了: 根据权重排序, 如果都一样就保持顺序.

**#后续#**

这个思路清晰以后, 做兼容就容易了:

1. 如果要指定顺序, 在排序参数里带特征, 例如'height', '-height', 来决定在执行的时候是a - b 还是b - a.
2. 如果要指定排序函数(在非数字情况下). 把排序参数改写成兼容function的, 判断是string就执行默认, 是function就调用function即可.

当然, 功能越完善的函数就越复杂, 函数本身只是函数复杂度和业务复杂度交换的作用. 具体实现就不写了.

## 所以置顶排序如何实现

我们已经想清楚了orderby的实现, 那么置顶排序是stick这个布尔值字段, 就必须根据我上面说的传函数进去, 并且改写orderby函数.

这样又要多些2个函数, 所以我选择:

```js
[...arr.filter({stick} => stick), ...arr.filter({stick} => !stick)]
```

搞定.

