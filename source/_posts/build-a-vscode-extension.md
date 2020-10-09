---
title: 写一个简单的vscode插件
date: 2020-09-30 14:34:20
categories: 工作笔记
tags: [vscode,vue源码]
---
工作中新写一个页面经常会遇到: 根据想好的布局写完了html片段, 然后要把对应的类名写个sass树.

于是产生了写个vscode来简化这个步骤的想法. 回头来分享这个[简单的demo](https://github.com/cwj0417/vscode-get-sass-structure-from-html), 发布到[vscode商店](https://marketplace.visualstudio.com/items?itemName=cwj0417.get-sass-structure-from-html&ssr=false#overview)也是免费的.

<!--more-->

## vscode插件结构

### 文件结构

vscode的脚手架是在yeoman的.

```shell
# 安装
npm install -g yo generator-code
# 使用脚手架创建文件夹和目录结构
yo code
```

然后根据想使用的语言, 项目名称配置一下就行了.

进入文件夹, 会有很多文件, 都是为我们配置好的, 我们只需要关注2个文件: `src/extension.ts`和`package.json`.(需要发布的话需要写readme)

想完成一些插件功能, 入口都是从这2个文件. 所以在深入之前, 需要了解一下vscode插件概念.

### vscode插件能力和基本概念

vscode插件提供的能力有:

+ 存储数据
+ 发出通知
+ 绑定快捷键
+ 控制右键菜单
+ 选择文件/文件夹

和一些我不关心的插件能力:

+ 控制颜色主题
+ 翻译语言
+ 语言(计算机语言)高亮
+ 扩展debugger

另外可以扩展一些工作区:

+ 菜单栏
+ 侧边栏
+ 状态栏
+ 新建tab插入webview

这些功能, 基本都通过2种入口来获取, `package.json`的配置字段`contributes`, 和引入node api的命名空间`vscode`. 现在可以开始介绍具体一些的实现了.

### command与激活状态

command是vscode插件的一个基本概念, 在`src/extension.ts`注册, 然后在`package.json`中设置就会触发对应的动作.

`extension.ts`中export2个方法, 分别是`activate`和`deactivate`. 一般注册方法会写在`active`里, 所以要通过`package.json`中`activationEvents`来激活才可以注册command的行为.

## 完成插件功能

我希望创建一个命令, 通过右击菜单获取当前选中的html, 分析并产生一个sass树字符串, 并复制到剪切板中.

### 插件实现

`package.json`中这样配置:

```json
"contributes": {
		"commands": [
			{
				"command": "get-sass-structure-from-html.generate-structure",
				"title": "生成css节点树"
			}
		],
		"keybindings": [
			{
				"command": "get-sass-structure-from-html.generate-structure",
				"key": "ctrl+i",
				"mac": "cmd+i"
			}
		],
		"menus": {
			"editor/context": [
				{
					"when": "",
					"command": "get-sass-structure-from-html.generate-structure",
					"group": "navigation"
				}
			]
		}
	},
```

+ commands注册一个command
+ keybindings注册一个快捷键, 当使用<kbd>ctrl + i</kbd>时就触发这个command
+ 在右击菜单添加一个菜单, 作为触发命令的入口.

在`src/extension.ts`的`active`方法里注册这个command:

```ts
const generateStructure = vscode.commands.registerCommand("get-sass-structure-from-html.generate-structure", (fileUri: vscode.Uri) => {
  
		const editor = vscode.window.activeTextEditor;
		const tplstring = editor?.document.getText(editor.selection);
  
		const res = parser(tplstring ?? '');
                       
		vscode.env.clipboard.writeText(res);
		vscode.window.showInformationMessage('已复制');
  
	});

context.subscriptions.push(generateStructure);
```

首先通过`vscode.window.activeTextEditor`获取到选区文本.

然后通过`parse`方法来获取转换后的sass树字符串.

最后通过`vscode.env.clipboard.writeText`写入剪切板, 并用`vscode.window.showInformationMessage`发出通知.

剩下的就是parse实现来简单解释一下.

### parse实现

要分析一段html代码, 于是我从vue编译template的代码中[解析html的方法](https://github.com/vuejs/vue/blob/dev/src/compiler/parser/html-parser.js)里找到了他[参考的lib](http://erik.eae.net/simplehtmlparser/simplehtmlparser.js), 并[简写](https://github.com/cwj0417/vscode-get-sass-structure-from-html/blob/master/src/parser/htmlparser.ts)了一下.

最下层的做法是:

1. 逐段读取domString.
2. 用预先写好的一系列正则, 逐段匹配. 匹配目标是: 标签开始, 标签结束. (还有注释, 被我去掉了)
3. 把匹配成功的段落, 根据匹配的类型, 扔到预先写好的回调里去执行.
4. 若没有一段正则匹配成功, 则认为匹配到了"直到下个`<`符号"的字符串, 并扔到字符串回调里去执行.
5. 从这次匹配结果的下一个字符开始下一轮匹配.

执行以后, 处理标签开始, 结束, 字符串的回调分别会依次执行, vue会在回调里建立自己的ast, 我直接在回调里拼接字符串, 我的parse函数就写好了.

当然, 最好的方式还是建立一个ast, 会更容易测试和开发后续功能和修复问题.

### todos

demo级别的完成了, 但是还剩下好多东西没做.

1. 对输出sass树字符串的格式化.
2. 对属性"类"检测的和兼容.
3. 对同级多个类的输出写法.
4. 对错误输入的兼容.
5. 对错误情况的处理.

## 发布到应用市场

发布流程非常简单, 并且是免费的. [教程](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)说得非常清楚, 并且有截图.

总的来说分为2步:

+ 去[azure devops](https://azure.microsoft.com/en-us/services/devops/)注册一个账号, 并生成一个应用市场专用的token.
+ 用工具`vsce`发布.

安装`vsce`(vsce的全称是: vscode插件)的方法: 

```shell
npm install -g vsce
```

然后登录

```shell
vsce login
```

然后发布

```shell
vsce publish
```

完事, 提示什么错误解决什么错误就可以了.