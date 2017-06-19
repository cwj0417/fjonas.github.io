---
title: 函数式编程介绍
date: 2016-11-21 09:58:43
categories: 胡乱编码
tags: [翻译,设计模式,函数式编程]
---
许多函数式编程(以下简称fp for functional programming)文章都说一些抽象的fp技巧. 比如构造(composition), 管道操作(pipelining), 高阶函数(higher order functions). 本文不同. 这里会告诉大家一些平时大家平时每天都要写的命令式的, 非函数式的代码应该如何转换为fp风格的例子.

第一部分将会是把一些遍历处理数据的代码转为`map`和`reduce`. 第二部分把比较长的循环打成小块, 并使每个部分函数化. 第三部分会处理一个更大的数据结构并把他写成管道的形式.

## 引言

当人们说到fp, 就会去联系到一些特性. 会提到**不可编辑的数据(immutable data)**, **第一类公民(first-class function)**, **尾递归(tail call optimisation)**. 这些是fp的语言特征. 会提到**map**, **reduce**, **管道(pipeling)**, **递归(recursing)**, **柯里化(currying)** 和使用**高阶函数(higher order functions)**. 以上这些是编写fp的技巧. 然后提到了**并行(parallelization)**, **懒求值(lazy evaluation)** 和 **决定性(determinism)**. 这些是fp的优点.

除了这些. fp还有一个特点: 没有**附带作用(side effects)**. fp不依赖方法所在的环境, 也不会改变函数外的变量. 任何变量都可以在函数内获得到. 把以上的东西作为你学习fp的引导思路.

这是一个非函数式的函数:

```python
a = 0
def increment1():
    global a
    a += 1
```

这是一个函数式函数:

```python
def increment2(a):
    return a + 1
```

## 不要对列表遍历. 使用map和reduce

### Map

map接受一个函数和一个集合. 然后创建一个新空集合, 在每个集合的元素上运行函数来插入空集合. 最后返回新的集合.

下面是个简单的获取名字长度的map:

```python
name_lengths = map(len, ["Mary", "Isla", "Sam"])

print name_lengths
# => [4, 4, 3]
```

下面是个返回元素平方的map:

```python
squares = map(lambda x: x * x, [0, 1, 2, 3, 4])

print squares
# => [0, 1, 4, 9, 16]
```

上面的map没有接受一个有名字的函数, 而是一个行内的, 匿名的用lambda定义的函数. lambda函数定义在分号前, 函数体在分号后. 函数体也是lambda函数的返回值.

下面的非fp的代码: 接受真名列表和代名列表, 并随机给真名赋值为代名.

```python
import random

names = ['Mary', 'Isla', 'Sam']
code_names = ['Mr. Pink', 'Mr. Orange', 'Mr. Blonde']

for i in range(len(names)):
    names[i] = random.choice(code_names)

print names
# => ['Mr. Blonde', 'Mr. Blonde', 'Mr. Blonde']
```

(如你所看到的, 这个算法可以给保密机关的人员分配保密代号. 希望他们不要在执行任务的时候搞错代号.)

上面的代码也可以写成map:

```python
import random

names = ['Mary', 'Isla', 'Sam']

secret_names = map(lambda x: random.choice(['Mr. Pink',
                                            'Mr. Orange',
                                            'Mr. Blonde']),
                   names)
```

**练习1.** 尝试用map重写以下代码: 这次用更可靠的策略来给特工代号.

```python
names = ['Mary', 'Isla', 'Sam']

for i in range(len(names)):
    names[i] = hash(names[i])

print names
# => [6306819796133686941, 8135353348168144921, -1228887169324443034]
```

(希望特工都记性不错, 不要在秘密任务中忘记别的同事的代号.)

答案:

```python
names = ['Mary', 'Isla', 'Sam']

secret_names = map(hash, names)
```

### Reduce

reduce接受一个函数和一个集合. 他返回的值是混合了输入的值.

下面是一个reduce. 他会返回输入集合的和. 

```python
sum = reduce(lambda a, x: a + x, [0, 1, 2, 3, 4])

print sum
# => 10
```

`x`是当前被遍历到的元素, `a`是暂存值. 他的值是上次循环lambda函数的返回值. `reduce()`循环每个元素. 每次都用当前的`a`和`x`执行lambda表达式, 把结果赋给下次的`a`.

那第一次循环`a`是什么? 第一次没有上一次. `reduce()`集合的第一个元素作为`a`的第一次值, 并从集合的第二个元素开始遍历. 也就是说, 第一个`x`是集合的第二个元素.

下面的代码计算'Sam'出现的次数:

```python
sentences = ['Mary read a story to Sam and Isla.',
             'Isla cuddled Sam.',
             'Sam chortled.']

sam_count = 0
for sentence in sentences:
    sam_count += sentence.count('Sam')

print sam_count
# => 3
```

reduce版本:

```python
sentences = ['Mary read a story to Sam and Isla.',
             'Isla cuddled Sam.',
             'Sam chortled.']

sam_count = reduce(lambda a, x: a + x.count('Sam'),
                   sentences,
                   0)
```

那么怎么解决希望reduce从第一个元素开始? 按照之前的执行, 第一个元素的'Mary read a story to Sam and Isla'中的'Sam'就不会被记入结果了, 我们要在第三个参数传入`a`的初始值, 这样reduce就会从第一个元素开始了.

#### 为什么map和reduce更好?

首先, 他们简化了代码.

第二, 遍历的最重要的部分  — 集合, 他们的操作与返回值不会改变集合的位置.

第三, 循环的代码会影响别的代码, 当然map和reduce是函数式的, 所以不会影响.

第四, map和reduce是元素性的操作. 每次我们操作一个循环, 都需要写几行循环逻辑的代码. 相对的, map和reduce把这些逻辑放进了算法, 代码的可读性也更高. '啊, 这个代码是这样这样改变了集合的每个值'.

第五, map和reduce还有一些类似的很实用的封装. 比如: `filter`, `all`, `any`, 和`find`.

**练习2.** 实用map, reduce和filter重写以下代码. filter接受一个函数和一个集合, 返回所有经过函数返回`true`的元素的集合.

```python
people = [{'name': 'Mary', 'height': 160},
    {'name': 'Isla', 'height': 80},
    {'name': 'Sam'}]

height_total = 0
height_count = 0
for person in people:
    if 'height' in person:
        height_total += person['height']
        height_count += 1

if height_count > 0:
    average_height = height_total / height_count

    print average_height
    # => 120
```

如果看起来不好搞, 试试不要考虑数据操作. 思考下数据经过的状态, 从信息列表到平均身高. 不要尝试混合多个操作. 先做一部分, 代码成功了再混合他们.

答案:

```python
people = [{'name': 'Mary', 'height': 160},
          {'name': 'Isla', 'height': 80},
          {'name': 'Sam'}]

heights = map(lambda x: x['height'],
              filter(lambda x: 'height' in x, people))

if len(heights) > 0:
    from operator import add
    average_height = reduce(add, heights) / len(heights)
```

## 代码要声明式的, 而不是命令式的

下面的程序是三台车的比赛. 每个阶段, 每台车都有概率前进, 有概率暂停. 每一步程序都把三台车的进度打出来. 五步以后比赛结束.

下面是样例输出:

```
 -
 - -
 - -

 - -
 - -
 - - -

 - - -
 - -
 - - -

 - - - -
 - - -
 - - - -

 - - - -
 - - - -
 - - - - -
```

这是代码:

```python
from random import random

time = 5
car_positions = [1, 1, 1]

while time:
    # decrease time
    time -= 1

    print ''
    for i in range(len(car_positions)):
        # move car
        if random() > 0.3:
            car_positions[i] += 1

        # draw car
        print '-' * car_positions[i]
```

这段代码是用命令式写的. 函数式版本应该是声明式的. 会声明要做什么, 而不是如何做他.

## 使用函数式

程序可以通过拆分方法变得更声明化.

```python
from random import random

def move_cars():
    for i, _ in enumerate(car_positions):
        if random() > 0.3:
            car_positions[i] += 1

def draw_car(car_position):
    print '-' * car_position

def run_step_of_race():
    global time
    time -= 1
    move_cars()

def draw():
    print ''
    for car_position in car_positions:
        draw_car(car_position)

time = 5
car_positions = [1, 1, 1]

while time:
    run_step_of_race()
    draw()
```

想要理解程序, 读者只需要看一下主循环. '如果还有次数剩余, 运行比赛的一个阶段并打印, 然后继续检查剩余次数.' 如果读者想进一步了解是怎么比赛, 怎么画的, 他们可以去对应的函数查看.

这点代码一点都没有注释, 代码是自解释的.

把代码拆分成方法很great, 不太耗脑力又把代码可读性提高. 这种技术使用了函数, 但只是把函数作为子程序使用, 包裹了代码. 从之前的引言来看, 这些代码并不是fp. 上面的代码使用的状态没有通过参数传导. 代码通过改变外部变量来实现. 为了知道方法真正做了什么需要去看外部变量. 如果变量不在, 还要去找变量哪里来的. 还要去查看哪些函数改变了这个变量...

## 移除状态

下面才是fp版本:

```python
from random import random

def move_cars(car_positions):
    return map(lambda x: x + 1 if random() > 0.3 else x,
               car_positions)

def output_car(car_position):
    return '-' * car_position

def run_step_of_race(state):
    return {'time': state['time'] - 1,
            'car_positions': move_cars(state['car_positions'])}

def draw(state):
    print ''
    print '\n'.join(map(output_car, state['car_positions']))

def race(state):
    draw(state)
    if state['time']:
        race(run_step_of_race(state))

race({'time': 5,
      'car_positions': [1, 1, 1]})
```

这些代码依然被分隔成了方法, 但这些方法是函数式的. 有三个特点. 第一, 没有共享的变量了. `time`和`car_positions`被直接传入`race()`.第二, 函数接受了参数. 第三, 没有变量在方法内部被初始化. 所有数据处理完都被作为返回值了. `race()`递归调用了`run_step_of_race()`的返回值. 每次运行产生的新状态都会被传入下次的调用中.

现在有2个函数, `zero()`和`one()`:

```python
def zero(s):
    if s[0] == "0":
        return s[1:]

def one(s):
    if s[0] == "1":
        return s[1:]
```

`zero()`接受一个字符串, `s`. 如果第一个字符是`'0'`, 就返回剩余的, 如果不是就返回`None`, python函数的默认返回值.

`one()`方法一样, 但检测的是`'1'`.

假设一个函数叫做`rule_sequence()`. 他接受的参数是一个字符串和一系列规则函数类似`zero()`和`one()`. 他在字符串上调用第一个规则, 除非返回值是`None`, 他会继续把返回值调用第二个规则. 除非返回值是`None`, 他会把返回值作调用第三个规则, 然后第四个... 除非返回了`None`, `rule_sequence()`就停止并返回`None`. 否则, 就返回最后的结果.

以下是一些输入输出:

```python
print rule_sequence('0101', [zero, one, zero])
# => 1

print rule_sequence('0101', [zero, zero])
# => None
```

下面是`rule_sequence()`的命令式实现:

```python
def rule_sequence(s, rules):
    for rule in rules:
        s = rule(s)
        if s == None:
            break

    return s
```

**练习3.** 上面是循环的实现方式, 用递归来实现:

答案:

```python
def rule_sequence(s, rules):
    if s == None or not rules:
        return s
    else:
        return rule_sequence(rules[0](s), rules[1:])
```

## 使用管道操作

在上个章节, 一些命令式的循环被重写为了递归函数. 在这个部分, 另外一个类型的命令式循环会被用一种管道操作的技术重写.

下面的循环作用是: 纠正错误的国家, 纠正错误的拼写及格式.

```python
bands = [{'name': 'sunset rubdown', 'country': 'UK', 'active': False},
         {'name': 'women', 'country': 'Germany', 'active': False},
         {'name': 'a silver mt. zion', 'country': 'Spain', 'active': True}]

def format_bands(bands):
    for band in bands:
        band['country'] = 'Canada'
        band['name'] = band['name'].replace('.', '')
        band['name'] = band['name'].title()

format_bands(bands)

print bands
# => [{'name': 'Sunset Rubdown', 'active': False, 'country': 'Canada'},
#     {'name': 'Women', 'active': False, 'country': 'Canada' },
#     {'name': 'A Silver Mt Zion', 'active': True, 'country': 'Canada'}]
```

问题从函数名字开始, 'format'太含糊了. 想要仔细查看代码, 这个问题会很严重. 在这个函数里做了3件事: 把`country`字段的值改为`Canada`. 把`.`移除出了band name. 把band name 首字母大写. 这样的函数名很难让人知道他做的什么事, 很难重用, 很难测试, 很难并用.

与下面这个对比下:

```python
print pipeline_each(bands, [set_canada_as_country,
                            strip_punctuation_from_name,
                            capitalize_names])
```

这样的代码很容易看懂. 一下就让人感觉这样的辅助函数是函数式的, 因为他们看起来链在一起. 上一个的输出和下一个的输入是连在一起的. 如果函数是函数式的, 就很容易被验证. 也很容易被重用, 测试, 和并用.

`pipeline_each()`是使用传入的类似`set_canada_as_country()`的辅助函数(每次一个)来改变bands. 当辅助函数被应用到了所有bands上, `pileline_each()`把结果传到下一个函数中. 

我们来看看这些辅助函数.

```python
def assoc(_d, key, value):
    from copy import deepcopy
    d = deepcopy(_d)
    d[key] = value
    return d

def set_canada_as_country(band):
    return assoc(band, 'country', "Canada")

def strip_punctuation_from_name(band):
    return assoc(band, 'name', band['name'].replace('.', ''))

def capitalize_names(band):
    return assoc(band, 'name', band['name'].title())
```

每个都关联了band上的一个键并给了新值. 没有简单的办法可以不改变原来band的值, 所以`assoc()`使用了`deepcopy()`来解决问题. 每个辅助函数改变了一份副本并返回这份副本.

看起来一切正常. band的原始值也没有被修改. 但有2处潜在的修改问题. 在`strip_punctuation_from_name()`里, 没有带`.`的名字因为在原始值上调用了`replace()`而生成, 大写化的名字也因为调用了`capitalize_names()`而生成. 如果`replace()`和`title()`是非函数式的, 那么`strip_punctuation_from_name()`和`capitalize_names()`也不是函数式的了.

幸运的是, `replace()`和`title()`不会修改他们操作的元素. 这是因为字符串在python中是不可修改的. 也就是说`replace()`操作元素的时候新建了一份副本并在副本上操作.

python是像Clojure一样的语言, 程序员不需要考虑他们是否改变数据, 这些语言永远不会.

**练习4.** 试着写出`pipeline_each`方法. 思考一下操作的顺序. 输入的元素, 一次一个元素, 给第一个辅助函数操作. 然后传递给之后的辅助函数.

答案:

```python
def pipeline_each(data, fns):
    return reduce(lambda a, x: map(x, a),
                  fns,
                  data)
```

三个辅助方法都有重复的代码. 我们可以用`call()`方法来抽象他.

```python
set_canada_as_country = call(lambda x: 'Canada', 'country')
strip_punctuation_from_name = call(lambda x: x.replace('.', ''), 'name')
capitalize_names = call(str.title, 'name')

print pipeline_each(bands, [set_canada_as_country,
                            strip_punctuation_from_name,
                            capitalize_names])
```

如果我们为了简洁而牺牲些可读性:

```python
print pipeline_each(bands, [call(lambda x: 'Canada', 'country'),
                            call(lambda x: x.replace('.', ''), 'name'),
                            call(str.title, 'name')])
```

`call()`的代码:

```python
def assoc(_d, key, value):
    from copy import deepcopy
    d = deepcopy(_d)
    d[key] = value
    return d

def call(fn, key):
    def apply_fn(record):
        return assoc(record, key, fn(record.get(key)))
    return apply_fn
```

**这里发生了很多, 让我们一点点地看.**

第一. `call()`是个高阶函数. 高阶函数接受函数为参数或者返回一个函数. 或者像`call()`一样, 两者都有.

第二. `apply_fn()`看起来很像那3个辅助函数. 他接受record(就是band). 他找到`record[key]`并用`fn`调用它. 最后返回一份结果的副本.

第三. `call()`方法实际没有做任何工作. 调用以后是`apply_fn()`来工作的. 在`pipeline_each()`中, 一个`apply_fn()`的实例会讲`country`设置为`Canada`. 另一个实例会把名字首字母大写.

第四. 当`apply_fn()`运行了, `fn`和`key`不在作用域中. 他们都是`apply_fn()`的参数, 也不是本地变量. 但仍可以被获取到. 当函数被定义, 会把引用当做变量存在自己的作用域里: 无论在方法内还是方法外的变量. 当函数运行, 他的代码引用了变量, python查找在参数中的变量. 如果找不到, 会去找保存过的引用. 这就是为什么可以找到`fn`和`key`.

第五. 在`call()`方法中没有涉及到bands. 因为`call()`方法是用来生成管道操作的, 不关心操作的内容. fp从某个程度上来说是构造一个普遍的, 可复用的, 组件化的函数.

好. 闭包, 高阶函数, 和变量作用域都在上面的例子说好了. 让我们喝杯柠檬水吧.

---

我们还有一个band需要处理的东西. 就是移除除了name和contry的所有字段. `extract_name_and_contry()`:

```python
def extract_name_and_country(band):
    plucked_band = {}
    plucked_band['name'] = band['name']
    plucked_band['country'] = band['country']
    return plucked_band

print pipeline_each(bands, [call(lambda x: 'Canada', 'country'),
                            call(lambda x: x.replace('.', ''), 'name'),
                            call(str.title, 'name'),
                            extract_name_and_country])

# => [{'name': 'Sunset Rubdown', 'country': 'Canada'},
#     {'name': 'Women', 'country': 'Canada'},
#     {'name': 'A Silver Mt Zion', 'country': 'Canada'}]
```

`extract_name_and_country()`可以用`pluck()`写成一个普通的函数.

`pluck()`的作用是:

```python
print pipeline_each(bands, [call(lambda x: 'Canada', 'country'),
                            call(lambda x: x.replace('.', ''), 'name'),
                            call(str.title, 'name'),
                            pluck(['name', 'country'])])
```

**练习5.**  `pluck()` 接受一个键的数组, 然后把键从集合中去掉. 试着写一下:

```python
def pluck(keys):
    def pluck_fn(record):
        return reduce(lambda a, x: assoc(a, x, record[x]),
                      keys,
                      {})
    return pluck_fn
```

---

[原文地址](https://codewords.recurse.com/issues/one/an-introduction-to-functional-programming) *顺带一提: 本文的章节号很乱, 出于尊重原文(lan)的原因没有改*