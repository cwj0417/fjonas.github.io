---
title: chrome拓展应用bug修复记录
date: 2018-05-29 11:43:17
categories: 编码与分析
tags: [chrome extension]
---
好久之前写的[chrome拓展](https://github.com/cwj0417/yosoro)我竟然自己一直在用, 常用的功能是字典, todo列表, 收集tab和笔记本. 用了那么久问题也出了不少, 今天在删笔记本和添加todo的时候出了大bug, 那么就来看看除了什么问题.

<!--more-->

## 问题

我在向todolist添加一条todo的时候报错了.

```
QUOTA_BYTES_PER_ITEM
```

咋肥ser? 到[文档](https://developer.chrome.com/extensions/storage)里看了下, 原来是chrome拓展对storage的大小有限制, 分别对总大小/单条数据大小/数据条数/每小时操作次数/每分钟操作次数有限制. 这个错误是超过了单条数据大小.

由于一开始对这些限制没有了解加入考虑, 我这个应用的数据结构存在问题并且已经定了. 我的todolist现在有80条左右, 那么限制80条todo一定是不合理的, 于是需要想一个办法.

## 解决

经过了一番粗糙的思考, 我决定分批保存, 思路非常简单: **在设置变量的时候判断item大小并分成n个, 在n大于1的时候在原本的键上加后缀, 取出的时候根据后缀规律拼接成一个item.**

幸好之前对storage进行了封装, 在这里改起来就非常方便, 并且所有使用storage的地方都可以应用这次修改.

[代码](https://github.com/cwj0417/yosoro/blob/master/src/libs/storage.js)在非常简单, 就简单地贴一下, 可以点近左侧连接仔细看.

```js
set(key, value) {
    let batches = getBatch(key, value)
    let processes = []
    batches.forEach((item, index) => {
        let obj = {}
        obj[index === 0 ? key : `${key}-p${index + 1}`] = item
        processes.push(new Promise((resolve, reject) => {
            chrome.storage.sync.set(obj, (callback) => {
                catchError(reject)
                resolve(`ok${callback}`);
            })
        }))
    })
    return Promise.all(processes)
        .then(res => merge(res), reject => Promise.reject(reject))
},
    get(key) {
        let getFromStorage = function (originKey, level = 1) {
            let _key = level === 1 ? originKey : `${key}-p${level}`
            return new Promise((resolve) => {
                chrome.storage.sync.get(_key, (callback) => {
                    resolve(callback[_key])
                })
            })
        }
        return (async function () {
            let level = 1, keepGoing = true, cache = []
            while (keepGoing) {
                let temp = await getFromStorage(key, level++)
                if (!temp) {
                    keepGoing = false
                } else {
                    cache.push(temp)
                }
            }
            if (cache.length) {
                return merge(cache)
            } else {
                return Promise.reject(`get ${key} failed`)
            }
        })()
    }
```

