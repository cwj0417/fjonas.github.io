---
title: 如何探测小程序返回到webview页面
date: 2019-05-13 17:38:12
categories: 工作笔记
tags: [小程序,vue]
---
在公司项目中经常会遇到一个场景, 尝试过各种不同的方法, 最后想到了一种很技术上简单且可行的方法.

<!--more-->

## 经常被QA同学反应同一类型的问题

项目是小程序(wepy), 部分页面使用webview(vue). 经常会遇见一个场景: 当小程序navigateTo到一些页面对用户的"收藏状态", "身材细节"做了修改后, 用户点击返回按钮回到上一个页面, **收藏的状态或是身材细节没有改变**.

那是当然的, 作为一个小程序中的webview, api相当有限, 没有一个事件可以让网页触发重新渲染动作, 轮询更是不理智的表面功夫.

我们试过绑定blur和click事件来模拟事件, 试过从业务逻辑上加入一些时间点检查状态, 最后才想到个技术简单, 操作简单的解决方案.

## 解决方法

第一步, 在小程序webview绑定的url上加上时间戳.

```html
<web-view src="{{url}}"/>
```

```js
onShow () {
  this.url = ${base_url}?ts=Date.now()
}
```

第二步, 在html里监听query变化. 我遇到问题的项目使用的是vue.

```js
watch: {
      '$route.query.ts': function () {
        this.fetchData()
        this.patchRender() // 获取数据, 重新渲染变化的部分
      }
    }
```

这样就解决了触发退回到webview的事件探测问题, 剩下的只要根据业务来重新渲染可能变化的部分就行了.

## 更多

小程序的部分每次都需要改变url的query参数没有办法, 但是对vue设计这么良好的框架还有一定改良空间.

我们可以把这串代码写到mixin里, 对性能有些小影响, 但方法没写也不会去执行, 只是在不需要的页面上多了个observer.

```js
Vue.use(function () {
  Vue.mixin({
    watch: {
      '$route.query.ts': function () {
        this.$options.onShow && this.$options.onShow.call(this)
      }
    }
  })
})
```

那么在vue页面中就省去了写watch的麻烦, 直接像小程序那样写onShow方法就行了.

```js
  onShow () {
    this.fetchData()
    this.patchRender() 
  },
  methods: {
    fetchData () {//...}
  }
```

总结, 使用了这个方法如需再添加需要探测onShow事件的页面, 只需要:

1. 小程序webview的url在onShow的时候修改ts参数
2. 在vue文件里添加onShow方法, 进行业务操作. (方法里的this是正常指向vm的)

