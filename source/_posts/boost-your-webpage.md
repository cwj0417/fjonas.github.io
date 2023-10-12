---
title: 增强你使用的网页
categories: 工作笔记
date: 2023-10-11 17:57:43
tags: [vue, chrome-extension]
---
有一些刚需网页不好用, 经常有重复操作, 自己来修改是比向网站拥有者提需求容易的.

分享一下最近对2个网站的修改. 这些修改确实节省了我很多日常重复操作的时间.

<!--more-->

## 用什么工具来修改你的网页

我选择的是arc浏览器的`boost`功能. 在网页上新建一个`boost`, 点击`code`, 选到`js`的tab就可以把编写的js插入到当前host的网页里运行了. 还有辅助功能`zag`可以帮你抓dom.

对于没有用arc浏览器的大家, 可以写一个chrome extension, 只需要使用`content_scripts`功能, 可以实现和arc的`boost`类似的功能: match网址url并且加载一段js. (其实功能是比arc多且灵活的)

## 修改jira页面

jira是个必须用, 且很多重复操作的网站. 我做了这些修改:

### 站会看板过滤器顺序调整

每天站会轮到的人的顺序和jira看板上不一致, 导致站会轮下一个人的时候得去找下一个人的位置. 只要获取一下看板过滤器, 调整一下子元素就行了.

```js
const container = document.getElementsByClassName('aui-expander-content ghx-quick-content')[0]
container.children[6].remove()
container.children[10].remove()
container.children[6].after(container.children[2])
container.children[9].after(container.children[1])
```

### 看板过滤器多选改单选

jira看板的过滤器是多选的, 所以切换下一个人的时候必须把前一个人取消了, 这样每次都多一次操作.

我们只要给每个过滤器加一个点击事件, 把其他active的过滤器都点击一下就行了.

```js
let child = null
container.onclick = function (e) {
  if (child) return
  child = e.target
  for (let i = 0;i < container.children.length; i++) {
    if (container.children[i].children[0] && container.children[i].children[0].classList.contains('ghx-active') && container.children[i].children[0].innerHTML !== child.innerHTML) {
      container.children[i].children[0].click()
    }
  }
  child = null
}
```

### 关闭bug的时候必须填写原因

公司有个规定, 关闭jira必须填写一些字段. 其实每次填写的内容都一样的, 自动填写可以节省非常多时间.

实现也非常简单, 定时器来寻找指定dom, 然后为这些dom附上指定的值.

```js
const setInputValue = (id, value) => {
  if (document.getElementById(id)) {
    document.getElementById(id).value = value
  }
}

setInterval(() => {
setInputValue('resolution', 10000)
setInputValue('customfield_10903', 12502)
setInputValue('customfield_12301', `故障原因：代码错误
解决方式：修复
影响范围：界面
故障处理人：yo-cwj.com`)
}, 1000)
```

## 获取vue应用的实例来修改界面

老婆画了几套微信表情, 于是我经常登录上去看数据.

但dashboard上信息很少, 需要点到每个表情的详情中才能查看.

通过网络请求, 我看到其实在dashboard的界面, 数据已经请求到了, 于是开始我们的修改.

### 从dom中寻找vue实例

通过基础的vue知识, 我们知道vue实例是会挂在dom上的. 

(vue作者说可以认为他是可用的, 因为vue的devtool也是依赖这个特性的, 那我们一个小脚本是更可用了)

那么哪些dom上有vue实例, 有点像个面试题, 写个简单的脚本就可以找到:

```js
let traverse = (dom) => {
    if (dom.__vue__) {
        console.log(dom.__vue__._data)
    }
    for (let i = 0; i < dom.children.length; i++) {
        traverse(dom.children[i])
    }
}
traverse()
```

找到目标数据所在的dom, 正式的脚本就这样获取vue实例就可以了.

### 编写脚本

首先通过vue实例的`_data`属性获取到数据:

```js
const list = document.querySelector('.page_mod_page_simple.page_home').__vue__.$parent.currentList;
```

然后把数据贴到对应的dom上:

```js
const emotion_dom = document.querySelector('.table_wrp_emotion_list').querySelector('.table_body');
for (let i = 0; i < emotion_dom.children.length; i++) {
	emotion_dom.children[i].children[2].innerHTML += `(${list[i].SendNum} - ${list[i].DataTime})`
}
```

到这里脚本就写完了, 其他的vue应用其实还可以调用vue实例中的方法获取数据, 或自己获取数据放进vue实例.

### 解决执行环境的问题

但把这段代码放到boost中会出现拿不到dom的`\_\_vue\_\_`实例的问题, 因为boost和chrome extension的执行环境并不是浏览器执行环境. 可以通过创建script并执行的方式.

```js
let script = document.createElement('script');
script.textContent = "const list = document.querySelector('.page_mod_page_simple.page_home').__vue__.$parent.currentList;" +
  "const emotion_dom = document.querySelector('.table_wrp_emotion_list').querySelector('.table_body');" +
  "for (let i = 0; i < emotion_dom.children.length; i++) {" +
  " emotion_dom.children[i].children[2].innerHTML += `(${list[i].SendNum} - ${list[i].DataTime})`" +
  "}";
setTimeout(() => {
  document.documentElement.appendChild(script);
}, 1000)
```

