---
title: vue2.0 filter替代方案
date: 2017-03-02 16:48:27
categories: 胡乱编码
tags: [vue 2.x,设计模式,函数式编程]
---
vue2.0开始其实是准备取消filter, 最后保留了text的filter并取消内置filter. 作者本意是用原生更优雅, 灵活地替代filter的. 所以讨论并总结一下

<!--more-->

## filter的prons&cons

关于吹黑的东西我真的觉得是浪费时间, 只有值得去解释的人和直接碰到同样理解的人. 这个head只是交代一下问题背景.

### filter proponents

+ 容易, 直白
+ 全局, 可复用
+ 新手容易上手, 体验好

### computed/native proponents

+ 确实比较难上手
+ 可以在vue中挂在prototype上使用, 但还是建议按需引用
+ 因为原生, 可灵活组合/可用在别的地方
+ filter的管道操作符将进入es标准, 导致和现在的filter冲突

## 如何不使用filter来在项目中format data

不使用filter的代替而使用原生的函数format数据, 首先需要

### 引入方式

首先有一种不推荐的全局引入到vue的`prototype`, 代码在issue(文末)里有, 我觉得比较正规的做法是按需引入.  类似于:

```js
import {reserve, filterBy, findBy} from "./filter"
```

### 使用方式

filter使用有两种情况, 一种是对字符串做处理, 一种是对数组/对象做处理.

+ 第一种情况其实是真的format数据, 可能占去了90%的使用.

  ```js
  import {reserve, filterBy, findBy} from "./filter"
  export default {
    methods: {
      reverse,
      filterBy,
      findBy
    }
  }
  ```

  html也很容易, 如下:

  ```html
  <span>{{reverse(words)}}</span>
  ```

  ​

+ 第二种情况占比相对少, 是对数组/对象做处理, 一般用于过滤, 排序, 分页等情况. 这种情况filter的使用会出现链式调用, 如果与第一种用法相同会导致代码可读性变差.

  ```js
  import {filter, sort, slice} from "./filter"
  ```

  html

  ```html
  <span>{{slice(sort(filter(data, "keywords"), "asc"), 5, 0)}}</span>
  ```

  所以这种情况推荐使用`computed`, 还能充分利用函数编程的灵活, 给开发者极大的空间来根据自己的情况开发filter, 也给第三方lib一个更好的机会.

  ```js
  computed: {
    filteredThings () {
      return this.things
         .filter(contains(this.foo))
         .sort(by(thing => thing.bar))
         .slice(0, 10)
    }
  }
  ```

  这些辅助函数可能是:

  ```js
  function contains (value) {
    return thing => thing.indexOf(value) > -1
  }

  function by (getValue) {
    return (a, b) => {
      return getValue(a) > getValue(b) ? 1 : -1
    }
  }
  ```

## 如何写filter

这个问题大概能看出程序员的水平了. 如何更优雅是个永久的问题. [现在是这样的](https://github.com/fjonas/vueFormatData)



参考:

+ [issue](https://github.com/vuejs/vue/issues/2756)
+ [discussion](https://forum-archive.vuejs.org/topic/3896/i-m-going-to-miss-filters-in-vue-2-0)