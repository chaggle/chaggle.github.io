---
title: "Go 语言基础与工程实践笔记"
published: 2026-08-11T00:00:00+08:00
updated: 2026-08-11T00:00:00+08:00
tags: ["2026", "Go", "TDD", "面试", "错误处理"]
category: "go"
---

> 2022 年学习 Go 语言基础与工程实践的多篇笔记（基础知识点、错误处理、TDD、面试复盘、学习方向思考等）合并整理。

## Go 基础知识点自我总结

> tips: 总结知识点一定要自己动手，这样知识点才能牢记！比如开源社区有雨痕大佬的 Go 语言笔记，但是光看几个用法，而不进行代码的编写，代码能力提升不明显，能看懂，但是做不到，形成一种眼高手低的习惯。更何况，以后的工作本来就是写需求的代码，所以，各种基础知识点，快速过完！

### 保留字与预定义字

```go
//保留字有 25 个
break  continue  func  interface  select
case  defer   go  map   struct
chan  else   goto  package   fallthrough
const  switch   if  range   type
default  for   import  return    var

//以下为相关的预定义字
true  false   iota  nil

//内建字类型
int  int16  int32 int64
uint  uint16   uint32  uint64
float32  float64   complex64 complex128
bool  byte   rune  string   error

//内建函数
make  len   cap  new  append
copy  close   delete  complex  real
imag  panic   recover
```

### Go 中的一些常用函数

```go
 append          -- 用来追加元素到数组、slice中,返回修改后的数组、slice
 close           -- 主要用来关闭 channel
 delete          -- 从map中删除 key 对应的 value
 panic           -- 停止常规的 goroutine (panic和recover：用来做错误处理)
    recover         -- 允许程序定义goroutine的panic动作
 real            -- 返回complex的实部 (complex、real imag用于创建和操作复数)
    imag            -- 返回complex的虚部
    make            -- 用来分配内存，返回 Type 本身(只能应用于 slice, map, channel )
    new             -- 用来分配内存，主要用来分配值类型，如 int、struct 返回指向 Type 的指针
    cap             -- capacity是容量的意思，用于返回某个类型的最大容量（只能用于切片和 map）
    copy            -- 用于复制和连接 slice，返回复制的数目
    len             -- 来求长度，比如 string、array、slice、map、channel，返回长度
```

### Go 中的 Array 数组

> 答：Go 语言中的数组与其他语言的数组不一样：
>
> 1、Go 语言中的数组是值类型，赋值和传参会复制整个数组，而不是指针
>
> 2、Go 语言中的数组长度必须是常量，而且是类型的组成成分，[2]int、[3]int 是不同类型
>
> 3、Go 语言中的数组能支持 "==" "!=" 操作，因为内存被初始化过
>
> 4、指针数组 [n]*T //表示由 n 个*T 指针构成
>
> 5、数组指针 *[n]T //表示由一个指针指向这个数组，可以视为一维数组来看
>
> 6、array 数组不建议拷贝，如需要拷贝使用 slice 更好，或者数组指针

### Go 中的 slice

```go
/*
 slice 为结构体，通过内部指针和相关的结构属性引用数组片段
*/
struct Slice {
 byte* array  //引用类型，但是是结构体，所以采用值拷贝传递
    uintgo len  //slice 数量，读写不超过该限制
    uintgo cap  //slice 容量，不能超出数组限制
 //slice == nil, len = cap = 0
}

//Go 中还有一个关于 slice 的拼接问题，两个 slice 在 append 的时候，
//记住拼接第二个 slice 时，需要将 slice 打散再拼接！
s1 := []int{1, 2, 3}
s2 := []int{4, 5}
s1 = append(s1, s2...) //正确写法
//s1 = append(s1, s2) 编译失败: cannot use s2 (type []int) as type int in append
```

### Go 中的面向对象

面向对象的三大特征：多态、继承、封装。Go 语言只支持封装行为，没有继承与多态，也没有 class 关键字，但是能做到 struct 中嵌入 struct 类型。

### Go 方法

方法：方法是绑定对象实例的，隐式将实例作为第一形参。

- 1、只能为当前包内命名类型定义方法
- 2、参数 receiver 随意命名，如果未使用此名称，可省略
- 3、参数 receiver 类型可以为 T、*T，但是基类 T 不能是指针与接口
- 4、不支持方法重载，receiver 为参数签名的组成成分
- 5、可用实例 value 或 pointer 调用全部方法，编译器自动转换
- 6、通常使用简单工厂模式返回对象实例

```go
type Queue struct{
    elements []interface{}
}

func NewQueue() *Queue {
    return &Queue{
        elements: make([]interface{}, 10),
    }
}

func (*Queue) push(e interface{}) error {
    panic("not implemented")
}

func (this *Queue) length() int {
    return len(this.elements)
}
```

### Go 接口

接口是方法的集合，由于不支持重载，所以每个方法命名唯一：

- 1、接口命名以 er 结尾，结构体
- 2、接口不实现方法
- 3、接口无数据字段
- 4、接口内可以嵌入其他接口
- 5、类型可实现多接口

```go
type Stringer interface {
    String() string
}

type Pointer interface {
    Stringer
    Print()
}

type User struct {
    id int
    name string
}

func (this *User) String() string {
    return fmt.Sprintf("User %d, %s", this.id, this.name)
}

func (this *User) Print() {
    return fmt.Println(this.String())
}
```

### Goroutine

Goroutine 为 go 协程，仅仅需要在函数调用语句前添加 go 关键字即可调用 goroutine，并且创建并发执行单元。goroutine 的设计具有轻量级：

```go
    go func() {
        fmt.Println("Hello World") //此为 goroutine
    }()
    //main 函数的执行其实也是 goroutine
    runtime.Goexit() //立即终止当前 goroutine 的执行
```

具体 CSP 的模式与 GMP 的模型在并发的笔记中继续学习。

### Channel

引用类型 channel 为 CSP 的模式的具体实现，使用 channel 用于多个 goroutine 的通信，确保并发安全，尽量使用 channel 来代替锁进行同步。channel 默认为同步的模式，需要发送和接收配对，否则一直处于被阻塞的状态，直到两边都处于活跃状态然后才被唤醒：

```go
package main

import "fmt"

func main() {
    data := make(chan int) // 数据交换队列
    exit := make(chan bool) // 退出通知

    go func() {
        for d := range data { // 从队列迭代接收数据，直到 close
            fmt.Println(d)
        }

        fmt.Println("recv over.")

        exit <- true // 发出退出通知
    }()

    data <- 1 // 发送数据
    data <- 2
    data <- 3

    close(data) // 关闭队列

    fmt.Println("send over.")

    <-exit // 等待退出通知
}
```

异步方式：通过判断缓冲区来决定是否阻塞。如果缓冲区满，发送阻塞；缓冲区为空，接收阻塞。通常情况下，异步的 channel 可以减少排队阻塞，具有更高的效率。但是应该考虑使用指针规避大对象的拷贝，将大对象分治为小对象，如多个元素打包、减小缓冲区大小等：

```go
package main

import "fmt"

func main() {
    data := make(chan int, 3) // 数据交换队列
    exit := make(chan bool) // 退出通知

    data <- 1 // 在缓冲区未满前，不会阻塞
    data <- 2
    data <- 3

    go func() {
        for d := range data { // 在缓冲区未空前，不会阻塞
            fmt.Println(d)
        }
        exit <- true // 发出退出通知
    }()

    data <- 4
    data <- 5
    close(data)

    <-exit // 等待退出通知
}
```

其中缓冲区是内部属性，非类型构成要素，内置函数 len 返回未被读取的缓冲元素数量，cap 返回缓冲区大小。channel 是第一类对象，可传参（内部实现为指针）或者作为结构成员。

Go 语言还内建了 `close()` 函数来关闭一个 channel，但是存在以下几种情况：

> 1、读写 nil Channel 会永远阻塞，关闭 nil Channel 会导致 panic
>
> 2、关闭一个已关闭的 Channel 会导致 panic
>
> 3、向已经关闭的 Channel 发送数据会导致 panic
>
> 4、向已经关闭的 Channel 读取数据不会导致 panic，但读取的值为 Channel 传递的数据类型的零值，可以通过接收语句的第二个返回值来检查 Channel 是否关闭且排空：

```go
    v, ok := <- ch
    if !ok {
        // 如果是非缓冲 Channel ，说明已经关闭；
        // 如果是带缓冲 Channel ，说明已经关闭，且其内部缓冲区已经排空
    }
```

### Go 中的 select 用法

select 是 Go 中的一个控制结构，类似于用于通信的 switch 语句，其用于处理异步的 I/O 操作。其有以下的几个特征：

```go
 1、每个case都必须是一个通信，所有 channel 表达式都会被求值
 2、所有被发送的表达式都会被求值
 3、如果任意某个通信可以进行，它就执行；其他被忽略
 4、如果有多个case都可以运行，select 会随机公平地选出一个执行。其他不会执行
 5、如果有default子句，则执行该语句。如果没有default子句，select将阻塞，
    直到某个通信可以运行；Go不会重新对channel或值进行求值
```

select 会监听每个 case 中 channel 的读写操作，但是每次只能运行一个 channel 进行读或写。

### 初始化函数

初始化函数 init()：go 语言中 `init` 函数用于包（package）的初始化，该函数是 go 语言的一个重要特性。

> 1 init函数是用于程序执行前做包的初始化的函数，比如初始化包里的变量等
>
> 2 每个包可以拥有多个init函数
>
> 3 包的每个源文件也可以拥有多个init函数
>
> 4 同一个包中多个init函数的执行顺序go语言没有明确的定义
>
> 5 不同包的init函数按照包导入的依赖关系决定该初始化函数的执行顺序
>
> 6 init函数不能被其他函数调用，而是在main函数执行之前，自动被调用
>
> main 对比 init 函数，main函数只能用于main包中，且只能定义一个

### go mod 包管理

```go
初始化模块 go mod init <项目模块名称>
依赖关系处理 ,根据go.mod文件 go mod tidy
将依赖包复制到项目下的 vendor目录 go mod vendor
   （如果包被屏蔽(墙)，可以使用这个命令，随后使用go build -mod=vendor编译）
显示依赖关系 go list -m all
显示详细依赖关系 go list -m -json all
下载依赖 go mod download [path@version]
```

### go debug

- go run -race 可以查看有无相应的锁竞争问题
- go tool compile -S [filename] 查看相应的汇编代码
- Linux 下使用 top/htop 指令查看 CPU、Memory、VIRT 等信息，其中关于内存泄漏的问题，主要查看的是 VIRT 是否出现不断增长的情况

### go 内存逃逸

内存逃逸的主要概念是：编译时 go 语言编译器会自动决定把一个变量放在栈还是放在堆，编译器会做逃逸分析（escape analysis），当**发现变量的作用域没有跑出函数范围，就可以在栈上，反之则必须分配在堆**。一般内存逃逸的分析都是编译器进行的，go 语言的设计者不希望我们过多的研究这个方面的内容，所以一般不用管！

## Go 语言中的错误处理

> 通过模块化组件的方式，学习 Go 语言的微服务。

Go 语言中的 error 定义如下：

```go
type error interface {
    Error() string
}
```

在 Go 1.13 版本之前，我们通常使用的是 `errors.New()` 来进行返回一个 error 对象指针，相应的源码如下所示：

```go
func New(text string) error {
    return &errorString{text}
}

// errorString is a trivial implementation of error.
type errorString struct {
    s string
}
```

关于 Go 中的指针与 C 中指针大致相同，都是指向某块内存地址值，可以通过 * 解引用的方式进行使用。至于此处为什么错误类型需要返回一个指针变量，如下解释：

> 主要是防止因为相同的字符串进行匹配，导致错误类型区别不准而导致的问题

可能第一次听会难以理解，我们通过代码来解释，来看以下的代码：

```go
package main

import (
    "errors"
    "fmt"
)

type errorString string

func (e errorString) Error() string {
    return string(e)
}

func New(text string) error {
    return errorString(text)
}

var ErrorName = New("EOF")
var ErrorStructType = errors.New("EOF")

func main() {
    if ErrorName == New("EOF") {
        fmt.Println("Named Type Error")
    }
    if ErrorStructType == errors.New("EOF") {
        fmt.Println("Struct Type Error")
    }
}
```

以上代码输出的是 `Named Type Error`，因为 `var ErrorStructType = errors.New("EOF")` 与 `if ErrorStructType == errors.New("EOF")` 虽然字符串的值相同，但是因为返回的是一个指针地址，地址不同的指针进行比较，当然也不同。所以这就是为什么要返回指针的原因。

其中 `panic` 与 `error` 的区别，主要是 `error` 类型定义仅仅只作为值类型进行处理，其抛出错误，证明业务进行到此处，有错误，但是不影响全局，程序员在后续能进行处理。而 `panic` 一般表示不可恢复类的错误，比如栈溢出、索引越界等程序员在后续无法进行处理的问题，必须修改代码才能解决问题。

### 错误类型

一般错误类型有以下几种：

1、`Sentinel Error` 预定义的错误，如 `io.EOF`、`syscall.ENOENT`。使用预定义的错误相当的不方便，所以尽可能避免使用预定义的错误，如果实在要使用，需要联系资深的程序员，进行 code review。

2、`Error types` 使用 `error interface` 接口的自定义类型，定义后可以包装底层的错误，提供更多的上下文与堆栈的信息，方便程序员进行调试、定位问题。但是使用这种 interface 接口进行实现的 API 需要将 error 变成 public 字段，会导致和调用者产生强耦合，从而导致 API 变得脆弱。所以还是得尽量避免使用 error types。

3、`Opaque errors` 最为灵活的错误处理，主要是只返回错误，但是错误内部不透明，一般建议 API 的设计，对外只暴露一个 error 类型的返回值即可！

### go 1.13 版本前的错误处理

一般的错误处理模式基本上是 `if err != nil {}` 这种常见的模式。所以此处只写建议的事情：

1、无第三方库协作的时候，简单使用 `errors.New()` 或者 `errors.Errorf()` 两个函数进行方法的处理。

2、如果需要配合 github 开源第三方包以及公司中台组件内部的包，使用 `errors.Wrap()` 与 `errors.Wrapf()` 保存堆栈信息，最终集中化输出所有日志，而不是遇到错误就打印日志。

### go 1.13 版本后的错误处理

go 在 1.13 版本给 `errors` 包新增了两个函数方法：errors.Is() 与 errors.As()。并在 `fmt` 包中也新增了 `fmt.Errorf()` 函数方法，用于向错误中添加错误信息，占位符为 `%w`，用于支持以上两个 errors 方法。具体使用案例如下：

```go
err := fmt.Errorf("access denied: %w", ErrPermission)

if errors.Is(err, ErrPermission)
```

### go 日志错误处理注意事项

关于 `log.Fatal()` 使用只推荐在 go 项目 init 函数中使用，或者 main 函数内初始化配置失败时候使用！因为 `log.Fatal()` 函数会调用 `os.Exit(1)`，此种情况下会导致程序直接退出，defer 函数都不会执行，不利于程序排查问题！

### uber_go_guide 错误处理

1、若调用者需要自己处理其中抛出的错误，采用 error.As() 或 error.Is() 函数合适。

2、错误如果不需要匹配，则如果是静态字符串，则使用 errors.New 进行抛出即可，若是动态字符串信息，则使用 fmt.Errorf 或者自定义的错误。

| 错误匹配？ | 错误消息 | 指导 |
| :-: | :-: | :-: |
| No | static | errors.New |
| No | dynamic | fmt.Errorf |
| Yes | static | top-level var with errors.New |
| Yes | dynamic | custom error type |

> 参考：[Uber Go 语言编码规范](https://github.com/xxjwxc/uber_go_guide_cn#Errors)

## TDD 概念介绍与学习课程

> 在接触 TDD (测试驱动开发) 之后，发现自己的确很能认同测试驱动开发的理念。所以在加上极客时间中有徐昊老师新开的一门课程，所以就开始自己的 TDD 学习之路。

### 前言

首先推荐两个课程：

1、徐昊老师的新课：[TDD 项目实战 70 讲](https://time.geekbang.org/column/intro/100109401?tab=catalog)

2、go 语言的教程：[Learn-go-with-test](https://studygolang.gitbook.io/learn-go-with-tests/)，建议能尽量进行英文阅读，就阅读英文原版

### 推荐

1、郑烨老师的专栏《软件设计之美》

2、《测试驱动开发的艺术》

3、《代码整洁之道》与《修改代码的艺术》

### 上手训练

可以查看博主推荐的 github 仓库，查看 TDD 具体的流程是怎么样进行的，以及 TDD 为什么能驱动程序员进行高效的开发：

> github: [Alexdown 的 github 仓库](https://github.com/longyue0521/TDD-In-Go/commits/main)

![TDD1](/images/go/TDD1.png)

> 回看：TDD 的确重要，但是由于自己的工程能力并未到达老师所说的那种高度，所以说自己基础能力存在一定的问题，需要一点前置知识，比如看 uncle Bob 的 clean code、软件工程上的知识，都是对自己的职业发展非常重要的！

## TDD 实践

> TDD 的项目驱动。

### TDD 具体原则

1、当且仅当存在失败的自动化测试，才开始编写生产代码

2、消除重复（徐昊老师：消除坏味道）

经典的红/绿/重构（Red/Green/Refactoring）：

> 红：编写一个失败的小测试，甚至可以是无法编译的测试；
>
> 绿：让这个测试快速通过，甚至不惜犯下任何罪恶；
>
> 重构：消除上一步中产生的所有重复（坏味道）。

### TDD 工作流程

学习过程中，老师建议使用任务分解法，作为 TDD 的核心要素：

> 1、先构思软件的使用方式，然后把握对外的接口方向
>
> 2、大致的构思方向，划分组件以及组件之间的关系，如果没有头绪，也可以不划分
>
> 3、根据需求的功能描述拆分功能点，功能点要考虑正确路径与边界条件
>
> 4、根据组件与组件的关系，将功能划分到组件中
>
> 5、针对拆分写测试，然后进入红/绿/重构模式

![TDD-2](/images/go/TDD-2.jpg)

### 2022-6-9 日新增

- 1、通过学习 TDD，发现多余的代码会给团队增加编译成本、跑用例的时间成本（这两项影响不大），最重要的是影响理解的成本
- 2、好的测试，就应该通过测试用例就能清晰的理解业务逻辑。TDD 的说法是写不出测试代码，就是不能理解整个业务需求。理解业务需求不需要通过一行一行的看代码进行理解
- 3、TDD 对程序员来说是一种内功修炼，通过 TDD 会对自己的掌握的知识进行重现，比如语言特性、设计模式、重构手法以及对业务的理解
- 4、TDD 是一种对做事方法的极致拆分，一次只做一件事，思考业务逻辑时就不考虑实现和代码坏味道；编写业务代码时，也仅考虑能通过用例的逻辑；而重构时，也是不能改变原来的代码逻辑的。通过一个个极小粒度的操作，实现最终整体的协调
- 5、程序员需要对自己的编程的手艺进行匠艺的打磨，比如代码的鲁棒性，就是修改一个模块内部的代码后，需要修改其他的模块多不多。如果不多，证明 code 的鲁棒性良好，反之如果需要修改大量的模块，则证明不好

### 思考

发现自己花在 TDD 的时间上少了，所以为了保证自己的代码质量以及学习的方式，决定需要花更多的时间在 TDD 上，进行思考。项目选用 Java 先跟着老师的代码思路走，再针对 Go 语言进行自己的项目实现，如果只是自己从老师的项目出发去模仿老师的 Java 风格去写 Go，只会像一道菜一样"串味"而变得难吃。

## Go Test 的一个小坑

> 使用 TDD 的模式驱动自己编写测试、驱动开发后，使用 goland 调试过程中出现的一些小问题，做一些记录。

### 如何解决 undefined function

首先在确保自己的测试代码与主干代码在同一个软件包下。最合适的办法是采用命令行调试，但是如果喜欢使用 goland 调试，那么在 go test 模板中需要把目录改成软件包，或者是把目录下文件全部添加上（不建议）。

![go-test](/images/go/go-test.png)

### Go mod init packagename

接着上一个问题，goland 进行 go test 测试很难用的原因，是因为自己在 go mod init 的时候，并未使用一个合理的名称，比如使用的 example，而在 function.go 中导入的包是 function name，导致 go mod 模式并未很好的利用，所以 go mod name 建议与文件夹的包名一致，这样不容易出现错误。

## Go GET 代理

Windows 下在安装 github 上的东西时，一般来说建议使用修改 git 配置，使用代理连接 github。即为打开 `C:\Users\Lenovo` 下的 `.gitconfig` 文件，加上相关的代理配置。如果是 socks5 连接，把 `http:` 改为 `socks5:` 即可，127.0.0.1 为本地回环地址，7890 是端口号，端口号以你的代理工具使用的端口号为准。

`go get -u -v github.com/gin-gonic/gin` 使用代理的情况下都能下载，唯一一个无法下载的包是 `google.golang.org/protobuf`，不仅仅只是网址找不到的原因，更多的是在 `https://github.com/golang/protobuf` 下没有这个包。

**所以那么上面问题又要怎么去解决呢？**

搜索一番后发现，这个包使用了另外一个 github 仓库，地址为如下 `https://github.com/protocolbuffers/protobuf-go`，我们使用 go get 去下载它：

```bash
go get -v -u github.com/protocolbuffers/protobuf-go
```

当然，这个源文件是下载在 gopath 里面的，为了方便使用，我们将下载到 gopath 的这个文件放到 gopath 下的 `google.golang.org` 目录下，而且如果解压后文件有版本号时，去掉这个版本号，与上面包名保持一致即可。这样就解决好问题了。

其中 go 现在采用 go mod 进行包模式的管理，所以说一般出现包管理问题，使用 `go mod tidy` 可以解决一些依赖包的问题。

## Go 学习方向（面试总结）

> 通过几次面试，来总结一些现在阶段，对于自己的职业规划的发展与思考！

经历了三四次面试，收获挺大的。面试不是目的，只是一种过程，要在不断的面试中，找到适合自己发展的领域才是面试的目的！

### 现阶段发展的方向

首先，Go 语言的云原生跟云中间件发展是非常迅速的，而且 Go 语言社区中，讨论最多的也是云计算的发展，docker、K8S集群、普罗米修斯，都是云中间件的代表，所以去学习其中设计的思想、源码的思想是非常重要的！

### Go 面试问题总结

> 1、数组与链表的区别（数据结构基础知识）
>
> 2、进程、线程、协程有什么区别（操作系统的知识，加 Go 语言特有的协程）
>
> 3、Redis 与 MYSQL 熟悉吗，Redis 有哪几种数据结构，缓存过期（TTL 网络中的生存时间），Redis 一般使用在哪一些场景里面（针对热点数据进行缓存、限时数据缓存、热点权值数据进行缓存）
>
> 4、channel 有几种类型（自己回答是读、写、读写三种，不一定对，也可能 chan int、string、byte）
>
> 5、控制 Goroutine 数量的几种方式（channel 控制，sync.WaitGroup 控制）
>
> 6、Go 语言调度模型：GMP 模型（hand off 机制没回答特别好）
>
> 7、Go 语言的 GC（标记清除法、三色标记法、混合写屏障机制）
>
> 8、Go GC 在什么时候会导致 GC 效率不高（STW 次数多的时候效率不高，毕竟依赖于 STW 机制）
>
> 9、TCP 的 CLOSE_WAIT 状态出现在那一步
>
> 10、slice 与 map 底层源码（slice 底层为指针 Array 类型，Go 中的 map 是 slice + list 数组加链表，而 java 里面是最简单的是数组，规模达到一定程度转换为数组 + 链表或数组 + 红黑树的形式）
>
> 11、Go 语言的内存泄漏、内存逃逸问题（内存逃逸就是栈上开辟空间存放的变量，逃逸到堆上去了，内存泄漏主要是看 OS 的环境，Linux 下使用 top/htop）
>
> 12、几道 Go 语言面试的题目：闭包传参、向空 slice append 数等
>
> 13、Go 语言如何 debug（自己回答是采用单元测试的办法、pprof 等方式方法）
>
> 14、算法题目：三数之和，返回二维数组，二维数组内不能有重复值，即数组内元素相等

### 5 月 21 日温故而知新

> 1、Go 语言中协程出现了 panic 的情况，有什么样的机制保证协程恢复并继续执行下去？
>
> 2、Go 语言中的调试信息使用什么查看？
>
> 3、Go 语言中的内存模型与内存回收机制
>
> 4、Go 与 Python 语言的协程对比有什么区别
>
> 5、**Mysql 里面执行计划的概念**（之前复盘都没有听出来这个问题，一个劲在说不知道）
>
> 6、redo-log、undo-log、bin-log 三个 log 文件的作用与区别，如何使用 redo 与 bin 两种日志去保证数据的一致性？
>
> 7、**数据库出现过性能问题嘛，千万级数据量的表如何进行一个排查+处理**
>
> 8、gorm 操作数据库是如何操作的？
>
> 9、**redis 中 AOF 与 RDB 两种快照日志主要是为了解决什么样的问题？**
>
> 10、gin 框架的源码看过吗，里面路由具体的实现机制是怎样的
>
> 11、平时关注哪些开源技术？

## Go 面试复盘

> 先上总结：
>
> - 面经光看没用，只有自己不断的面试，然后总结，自己理解性的进行描述才有意义，否则只是像八股文一样去背记，从而未能理解真正的含义。那么，可能下一次面试的时候，上一次面试的问题依然处于一种遗留的状态，这样就无法在技术的关键节点进行成长
> - 尤其是算法题，如果一两个月不复盘算法问题，那么算法思维存在，但是代码熟练度会下降，从而导致写算法的时间变长，以及相应的心态焦虑
> - 以下为自己答的不好与没答出的问题

### TCP 三次握手

> 答：TCP 的三次握手为：
>
> 1、客户端发送的报文为 SYN 报文，并选择一个初始的 Seq 序号，之后客户端进入监听状态（SYN-SENT）
>
> 2、服务器在接收到客户端第一次发送的 SYN 报文之后，如果同意连接，即向客户端发送连接确认报文，即 SYN + ACK 报文，也附加一个自选的初始 Seq 序号，并且此序号与客户端的序号无关，之后服务器端继续维持监听状态（SYN-RCVD）
>
> 3、客户端在接收到服务器发送回的报文之后，再向服务器端发送确认报文，确认号为服务器初始的 Seq 序号 + 1，序号为自己初始的 Seq 序号 + 1
>
> 4、此后服务器与客户端正式建立连接，开始发送数据，双方状态为 ESTABLISHED

![tcp3](/images/go/tcp3.png)

### TCP 需要三次握手的原因

> 答：采用第三次握手的原因是：
>
> 1、如果第一次客户端的报文中途出现延迟，而客户端开始重发第一次的报文，并且重发报文被服务器正确接收
>
> 2、而此时，第一次客户端发送的报文又到达服务端，服务端接收后，又返回一个报文，相当于服务器同一个客户端建立了两个连接，而客户端只认为自己建立的一个连接，造成了状态不一致，同时服务器的资源也被浪费了
>
> 3、故为了尽可能保证连接的建立及时、有效且资源节约，故采用 TCP 三次握手

### TCP 四次挥手

> 答：TCP 的四次挥手过程为：
>
> 1、首先由客户端向服务器端发送关闭连接请求报文，即 FIN 报文，此时客户端由 ESTABLISHED 状态转变为 FIN-WAIT-1 状态，此时还能继续接收服务器所发送的数据
>
> 2、服务器在接收到客户端发送的 FIN 包后，向客户端发送确认报文，即 ACK 报文，此时服务器的状态由 ESTABLISHED 状态转变为 CLOSED-WAIT 状态，此时服务器端还能继续把未能发送完的数据继续发送
>
> 3、客户端在接收到服务器端发回的 ACK 确认报文之后由 FIN-WAIT-1 转变为 FIN-WAIT-2 状态，并且能继续接收数据，直到服务器发送终止报文，即 FIN 包为止
>
> 4、服务器向客户端发送 FIN 包，此时服务器端由 CLOSED-WAIT 状态转变为 LAST-ACK 状态，等待客户端返回最后一次确认报文，即 ACK 为止
>
> 5、客户端接收到 FIN 包后，由 FIN-WAIT-2 变为 TIME-WAIT 状态，超过一定的时间后自动转变为 CLOSED 状态
>
> 6、服务器端收到客户端的 ACK 报文后，即由 LAST-ACK 状态转变为 CLOSED 状态，不再发送与接收客户端的数据

![tcp4](/images/go/tcp4.png)

### TCP 需要四次挥手的原因

> 答：采用第四次挥手的原因是：
>
> 1、如果客户端第四次发送 ACK 报文后就直接进入 CLOSED 状态，那么如果第四次发送的 ACK 报文在传输的过程中丢失，服务器由于一直未能接收客户端发送的 ACK 报文，再次向客户端发送相应的 FIN 报文，而此时客户端已经关闭，接收不到服务器发送的 FIN 报文。即造成了服务器的资源浪费
>
> 2、故为了保证通信尽可能的可靠，采用 TCP 四次挥手，但是在考研中，有种特殊的情况，在确保第三次握手能成立的情况下，第四次挥手可以被省略。若将一个往返视为 RTT 的情况下，最短的释放连接所需要的时间为 1.5 个 RTT 即可，不需要 2 个 RTT，所以这也是为了节省资源所考虑的情况，并不一定视为错误答案

### TCP 粘包问题

> 答：TCP 对比 UDP，前者主要是以字节流的形式传输数据，而 UDP 则以报文的形式传输数据。
>
> 其中报文与字节流的区别主要是，字节流传输是以字节为单位进行数据传输，与每一个数据中的独立的内容无关，而报文传输为传输以报文为单位，保留了报文内容的边界。所以就会导致 TCP 传输字节时候，有可能区分不了数据的边界，导致最后解包数据所造成的解码乱码现象，即 TCP 的粘包的问题。
>
> 解决 TCP 粘包问题的办法有许多种，其中在之前所学的 Zinx 框架中，刘丹冰老师（Aceld 老师）解释了一种 TLV 格式的封包解包办法，即使用 datalen、msgID、data 作为封包解包的字段，首先读取一遍封包的头部长度，即 datalen 与 msgID 字段的大小，此处按照自己设置的来。一般设置是两个 uint32 类型，即为 8 Byte 的。
>
> 其中解析开头的 datalen 为 data 字段的数据长度，msgID 为相应的数据包编号。然后根据开头的 datalen 的具体数值来读取之后的 data 段的数据。至于 TCP 发送数据流中出现的错误，利用好 TCP 的错误重传机制就好。

![TLV](/images/go/TLV.jpeg)

### 写代码：channel

```go
//多多练习一下代码能力，要脱离相应的视频项目开发，变为生产实际开发。
//有些东西，一段时间没用就会忘记，比如算法时间复杂度，以及相应的代码熟练度。

//实现两个channel，一个 channel 输出 ping，一个channel 输出 pang，并发执行。

//22-5-13 日再回头看，发现问题很显然了，自己当时写一个经典的并发案例没写出来
//就是属于基础不够好，这个代码也不符合面试官需要达到的要求，只是效果达到了。

package main

import "fmt"

func main() {
	p := make(chan string)
	q := make(chan string)

	go func() {
		p <- "ping"
	}()

	go func() {
		q <- "pang"
	}()

	c := <-q
	a := <-p

	fmt.Printf("type of c : %T\n", c)
	fmt.Printf("type of a : %T\n", a)

	for {
		fmt.Println(a)
		fmt.Println(c)
	}
}
```

### Go 中 map 查询的时间复杂度为 O(1)

> 答：查看了相应的各种博客，了解到：
>
> - 1、java 中 map 的底层源代码实现为数组 + 链表 + 红黑树，所以在数据量极小的情况下，相应的**查询时间复杂度为 O(1)**，而在数据量较多的情况，map 的查询时间复杂度应该是大于 O(1)，小于 O(N)，接近 O(logN) 的时间复杂度的
>
> - 2、所以说关于 map 的查询时间复杂度是一个很老的问题了，一般使用情况默认为 O(1) 的时间复杂度。但是这并不意味着就要否认 map 的查询时间复杂度是 O(logN) 的说法
>
> - 3、不懂不理解的问题，一定需要事后进行相关资料的查询，以及总结

关于 map 查询的时间复杂度，[StackOverFlow](https://stackoverflow.com/questions/1055243/is-a-java-hashmap-search-really-o1) 上给出的说法挺多：

![mapsearch](/images/go/mapsearch.png)

![mapAnswer1](/images/go/mapAnswer1.png)

![mapAnswer2](/images/go/mapAnswer2.png)

### GMP 模型

> 强烈推荐 Aceld 老师的 GMP 模式详细解释，可以明白调度器的调度行为。GMP 模型已经单独作为一篇博客存在，所以此处不再阐述。

### Go GC 在什么情况下性能比较低

1、内存泄露。

2、小对象，结构体比指针的好。

## 开源的思考

本人曾经的职业规划是，在读研后学习 NLP、CV 等领域的算法论文，而后向着算法工程师的方向进行努力。而近几年的考研难度以及行业的形式导致自己的期待与期望成了泡沫。在二战也未能达到名校的分数线后，自己毅然决定，不调剂，投入社会进行学习与工作。

但是困扰自己的问题出现了，学习什么样的技术、向什么样的行业发展，成为自己的一大困惑。通过一段时间的自我认知与自我反省，想到了自己曾经大三时候学习的 go 语言，并且使用 beego 框架进行相应的简易博客开发，所以方向是 go 语言工程师，go 语言中的几个方向：云原生、微服务、高性能 API、服务器端开发、游戏开发。自己这几个方向都还是比较喜欢的，更坚定了自己使用 go 语言进行找工作的决心。

而在今天看到了云原生社区对 APISIX 的联合创始人&CEO 温铭做的采访，其中几个观点，我也是非常认可其中的理念：

> 1、开源比业务代码更有意义
>
> 2、开源的本质是要拿开发者的杠杆
>
> 3、Apache 的理念是社区比代码更重要

自己的确非常喜欢开源社区，也十分认同开源的理念，就是能让自己的智慧以及不断发展的能力，给开源社区做出贡献。
