---
title: http1.1科普
date: 2018-05-31 14:33:06
categories: 编码与分析
tags: [http]
---
因为工作碰到了一些疑惑所以看了[火狐的http文档](https://developer.mozilla.org/en-US/docs/Web/HTTP), 简单地看, 简单地总结了一下, 本文只介绍http1.1的概念, 不介绍具体让人心烦的细节(配置和行为).

<!--more-->

## 什么是http

### 概念

全称是超文本传输协议. 何为超文本? 超文本就是文本(文本不一定是超文本).

http的本体是文本. 并且http2之前的版本(包含现在正在用的1.1)都是人类可读的文本.

再说一下什么是协议? 协议就是双方约定一些东西, 使用的时候大家都遵照规则执行.

我们来类比html, 超文本标记语言. 本身是文本(div, p, img). 放到浏览器里解析的时候就会被画成一个块, 一个图片等. 那么http也是如此, 普通的人类可读的文本, 进行了一系列约定, 协议双方根据一些关键词来执行某些约定的行为, 便是http了.

### 环境

那么http到底是在哪里发生的, http的三个属性:

+ http是[应用层](https://en.wikipedia.org/wiki/Application_layer)协议.
+ http是基于[客户端/服务端模型](https://en.wikipedia.org/wiki/Client%E2%80%93server_model).
+ http是[无状态协议](https://en.wikipedia.org/wiki/Stateless_protocol).

高中就学过了osi七层协议, http是最上层的协议, 下面是基于传输层的(不仅限于tcp/ip).

客户端指浏览器, 服务端指服务器. 顺序是浏览器的某些动作(比如输入url并敲回车)触发http请求, 服务器接到请求返回, 形成了一次完整的http请求. http请求每次都是独立的, 所以是无状态协议.

### 总结

http就是**浏览器使用传输层协议向服务器发出一些文本**, 这些文本带有约定的东西, 服务器根据约定的规则来分析内容并作出响应. 学习http就是学习这些约定.

## http消息

就像html是div, p, img一样, http长啥样, 平时使用浏览器的调试工具或是http抓包工具都能看到. (当然都是进行过可视化处理的).

http消息分为请求(request)消息和响应(response)消息. 即浏览器发出请求的消息和服务器响应的消息.

### 消息组成

request和response的消息组成是一样的.

1. start-line: 请求/响应的基本信息.
2. http header: 请求/响应的头信息.
3. 空行: 作为分隔符.
4. body: 请求/响应的主体内容.

request和response的每个部分的消息内容不同. 下面介绍每个部分的具体内容.

### request

1. start-line: 方法(get/post等), 目标(通常是url), 协议版本. 例: `GET /background.png HTTP/1.1`

2. header, 用冒号/换行隔开的键值对, request和response拥有不同的有效header键值, 详见文末链接.

3. 大多数request的body为空, 比如get, delete, options方法. 一些需要上传数据的方法如post, put会有body. 

   body有两种情况: 单个资源: 此时header要定义`content-type`和`content-length`. 多个资源: 在`content-type`里定义`boundary`, 然后在body中用`boundary`来分隔多个资源. [例子链接](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#multipartform-data)

### response

1. start-line: 协议版本, 状态码, 状态描述. 例: `HTTP/1.1 404 Not Found`.
2. header, 同request.
3. response的body也不是必须的, 与request类似, 也分为单个资源和多个资源. 多了一个情况, 不知道文件长度的时候可以把`transfer-encoding`设为`chunked`.

### 总结

至此, http已经介绍完了. 我来举一个简单的http的例子.

我打开了浏览器, 敲入`yo-cwj.com`. 浏览器发出了http request.

```
GET https://yo-cwj.com HTTP/1.1
Host: yo-cwj.com
User-Agent: Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.5; en-US; rv:1.9.1b3pre) Gecko/20081130 Minefield/3.1b3pre
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-us,en;q=0.5
Accept-Encoding: gzip,deflate
Accept-Charset: ISO-8859-1,utf-8;q=0.7,*;q=0.7
Connection: keep-alive
```

这个简单的get请求没有body, header都是浏览器默认带上的.

然后收到了回复:

```
HTTP/1.1 200 OK
Date: Mon, 01 Dec 2008 00:23:53 GMT
Server: Apache/2.0.61 
Keep-Alive: timeout=2, max=100
Connection: Keep-Alive
Transfer-Encoding: chunked
Content-Type: application/xml

<html>陈文俊的博客</html>
```

200, ok 代表请求成功, 倒数第二行空行代表header和body的分隔, 具体返回内容是`<html>xxx</html>`, 浏览器获得结果就可以去渲染页面啦, 完美.

是的, http就是这么简单, **http的结构就是start-line, header, body三部分.** 而协议复杂的地方大部分就在header了. header有一万个字段, 每个字段能研究一年. (所以要搞懂http需要一万年). 那么下面的章节简述一下经常接触的协议规则.

## Cookie

### 介绍

http是无状态协议, 但网站的登录状态/购物车等是有状态的, 就要借助cookie来实现. cookie是储存在浏览器上的信息. 会在向服务器发起请求的时候带着, 以代表浏览器当前的状态.

cookie原先的作用除了登录/购物车, 还有储存用户主题, 分析用户行为等. 但浏览器的行为会将cookie都带到http请求中, 所以现在推荐使用现代storage api来储存部分信息. 

### 实现

两个关键点: cookie传输是通过http的header, cookie的储存的地方是浏览器.

response header可以设置cookie:

```
Set-Cookie: <cookie-name>=<cookie-value>
```

然后浏览器收到set-cookie头以后会储存cookie, 在发送请求时把对应的cookie带在request header的`Cookie`中, 格式是: `k=v; k2=v2`:

```
Cookie: yummy_cookie=choco; tasty_cookie=strawberry
```

那么浏览器中会有很多cookie, 因为我们经常同时浏览不同的网页. 浏览器进行request的时候把所有cookie带上是不对的, 那么会带上哪些cookie呢, 就涉及到cookie的作用范围.

### 作用范围

控制cookie作用范围的关键字是Domain和Path, 如果都没设置默认行为是**只向当前路由发送cookie**, 我的理解是什么路由接到set-cookie的就只向这个路由发送.

domain和path的语法是`Domain=mozilla.org`, `Path=/docs`. domain被设置的时候会向domain的所有子domain发送, 所以希望发送范围越小就要设置得越细. path相同.

### 生命周期

cookie的生命周期是浏览器关闭, 也可以在response header里通过设置expire来改变cookie的过期时间.

### xss与csrf

因为浏览器通过`document.cookie`可以获取自己的cookie. 通过一些手段发出一些请求并带上cookie就可以获取cookie来做不好的事情. 这也是http的特点: 无状态. 所以理论上一切请求都是可以模拟的. (只要获取了关键信息, 任何人都可以在他的电脑上模拟你正在登陆某网上银行甚至进行操作).

这些操作有: 让页面执行一段js, 让页面append一个img, src的target是恶意网站. 所以防止xss攻击只要做到控制用户可进行的操作或转移用户输入就可以了.

题外话, 因为js和css和html都是明文的, 所以安全必须通过加密手段来强化.

## 跨域请求

跨域好像是每隔一段时间都会被问到的问题, 先来定义一下什么是跨域请求.

### 定义

违反[同源策略](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)的请求就叫跨域. 同源策略一句话就能说完: **协议, 主机, 端口都相同的url是同源url**. 强调是**都**相同, 即使`http`和`https`的区别也算跨域. 左边的链接举了一些例子, 一看就明白. 

那么从一个页面向一个非同源的target发起了http请求, 这个请求就是跨域请求了.

### 触发对象

那么什么情况下会发起跨域请求呢? 我的印象里百分之90的情况是js代码发起的, 也就是或经过框架包装的xmlhttprequest. 下面这些都会触发http请求:

+ js代码发起的, xmlhttprequest, fetch. 因为fetch存在兼容问题, 基本所有的框架封装都是通过前者的.
+ web字体. 通过`@font-face`.
+ webgl texture.
+ canvas用`drawImage`画的Image或者Video.
+ css和script标签.

### 跨域请求需要做的事情

说了半天什么情况是跨域, 那么为什么要讨论跨域呢? 当然是报错了才会讨论了.

因为安全关系, http是默认阻止跨域请求的, 想要顺利地进行跨域请求, 必须在浏览器和服务器都进行一些header设置, 来确认这次跨域请求是双方都认同的. 就像你要删除社交工具的好友前会进行提示: 你是否要删除好友xxx.

[跨域相关的request和response的header](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)都在左边的链接里了, 这里只提一个作为例子:

(开始讲故事)

我的**博客**(https://yo-cwj.com)需要加载一些图片来丰富博客内容, 因为博客托管的服务器对博客大小有限制, 所以我把图片放在了另外一个**图库**(https://picture-cwj.com). (下文就用`博客`和`图库`来代表2个地址).

博客使用了img标签来请求了图库的图片. 图库返回的图片response header 带有:

```
Access-Control-Allow-Origin: https://yo-cwj.com
```

博客进行请求的request header带有:

```
Origin: https://yo-cwj.com
```

图库的response header告诉所有过来的请求: 我只给`yo-cwj.com`跨域. 博客的request header带着表明身份的`Origin` header. 这样一次不被阻止的跨域就完成了.

(故事完)

故事讲完了, 博客是存在的, picture-cwj.com是不存在的. 简单的2个header就让浏览器放行了跨域请求. 别的header都在故事前贴出来的链接中.

### preflight request

强行翻译: 跨域准备请求.

当跨域请求满足了某些条件以后, 浏览器在跨域请求前会发起一次preflight request, 用来确认即将发送的请求是否被允许.

preflight请求的method是options, 之前说的跨域相关的header大部分是和preflight相关的.

下面介绍发起preflight请求的触发条件:

1. method不是`get`, `post`, `head`的.
2. request header 带有指定字段之外的. 
3. `cotent-type`头的值在指定范围之外的.

只要满足任何一个条件就会发起preflight请求. [具体条件](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)在左边的链接中.

## 缓存

关于[缓存](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)暂时只做概念介绍, 缓存的控制也都是header控制的.

### 概念

什么是缓存? 当同一个请求进行了2次以上, 浏览器不真正向浏览器发起请求而直接返回之前储存的结果.

### 缓存哲学

缓存的好处是: 提高浏览器响应速度, 节省服务器带宽. 因为没有与服务器真正数据交互, 也获得了期望里的数据.

缓存的问题也非常明显, 获得的数据是缓存里的, 而不是最新的. 所以缓存的关键就在于猜测哪些数据是不经常更新的. 猜测什么类型的数据的更新频率是多少, 并使用缓存相关的header来控制. 比如某门户网站的首页html是不经常更新的, 或者是每小时一更新, 而首页轮播的图片是十分钟更新的.

### 缓存类型

缓存类型分为本地缓存和共享缓存.

我们概念中的, 或者说我们经常使用的都是本地缓存.

共享缓存是指ISP对服务器的缓存, 之前听说淘宝怎么能让网速更快, 离用户最近的地方是ISP机房, 所以把淘宝首页放在ISP机房就行了.

### 新鲜度检查

有一种缓存的机制是新鲜度检查. 之前说的缓存response是: 200 OK (from disk cache). 新鲜度检查是根据`cache-control: max-age=xxx`向服务器发起新鲜度检查. 如果返回结果是304(not modified), 服务器将不返回数据, 使用浏览器缓存的数据, 从而节省数据下载时间和带宽.

## 参考链接

+ [http header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
+ [request methods](<https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)
+ [response status](<https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)