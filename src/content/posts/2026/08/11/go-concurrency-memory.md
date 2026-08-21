---
title: "Go 并发与内存学习笔记"
published: 2026-08-11T00:00:00+08:00
updated: 2026-08-11T00:00:00+08:00
tags: ["2026", "Go", "GMP", "GC", "channel", "mutex", "sync"]
category: "go"
---

> 2022 年学习 Go 并发编程的五篇笔记（GMP 模型、垃圾回收、channel、sync.Mutex、sync.Pool）合并整理。内容主要参考极客时间 Go 并发编程实战课（鸟窝大佬），如有需要查看其详细内容，请前去购买。

## GMP 模型分析

关于 GMP 模型的一些理解，G 为 goroutine，M 为 thread（内核级线程）、P 为 Processor（处理器）。

### Golang 早期调度器的由来

在讲述早期调度器之前，让我们先聊一下早期的操作系统。

在没有多核 CPU 之前，操作系统以单进程的任务执行，计算机只能一个任务一个任务地完整执行。在此情况下，操作系统不仅存在工作效率低下的问题，而且一旦正在执行的任务被阻塞时，CPU 资源无法释放，会导致其 CPU 资源与时间的浪费，因此操作系统采用了时间片轮询的方式调度进程，而此举动也无法改变单核 CPU 的硬件条件。

为了解决上述缺陷，随后引入了多进程、多线程的解决方式。虽然多进程与多线程的方式很好地解决了 CPU 调度的效率问题，但是设计多进程、多线程的架构会变得异常复杂。不仅如此，当进程与线程数量越多的时候，多进程多线程系统进行进程线程切换的成本就越大，资源浪费现象也越明显：如（锁、竞争资源冲突等），所以在多进程、多线程模型中也存在相应的壁垒，即高内存占用与高 CPU 调度消耗。

而 Go 语言为了更好的解决操作系统中线程调度的开销大，引入了比线程更轻量级的协程，其内存占用一般只有 4KB，调度灵活，切换成本低。并且开发出 Go 语言早期的调度器：基本的全局 Go 队列和比较传统的轮询方法，利用多个 M 进行 G 的调度，可以称其为 GM 模型。

### GM 早期调度器的缺点

Go 语言早期的调度器 GM 模型虽然能够利用多核的 CPU，但是其相应的缺点也非常明显：

> - 1、创建、销毁、调度 G 都需要每个 M 获取锁，形成了激烈的锁竞争
> - 2、M 调度 G 时，会造成延迟以及额外的系统负载
> - 3、系统调用（CPU 在 M 之间的切换）导致频繁的线程阻塞和取消操作，增加了系统开销

所以为了解决以上的问题，引入了 GMP 模型。

### GMP 现代调度器简介

GMP 现代调度器，采用了两种队列：全局队列以及本地队列：

![GMP](/images/go/GMP2.png)

全局队列很好理解，可视为全局变量，本地队列则能理解为局部变量。本地队列的个数依赖于 P 的个数，即 GOMAXPROCS 的个数，此值由启动时环境变量 `$GOMAXPROCS` 或者是由 `runtime` 的方法 `GOMAXPROCS()` 决定。这意味着在程序执行的任意时刻都只有 `$GOMAXPROCS` 个 goroutine 在同时运行。每一个 P 的本地队列中能存放 G 的个数不超过 256 个。新建的 G 一般优先放置在 P 的本地队列中。

Go 语言本身限定 M 数量的最大量为 10000（忽略），一般操作系统也达不到 10000 个线程。使用 runtime/debug 包中的 SetMaxThreads 函数来设置。有一个 M 阻塞，就会创建一个新的 M，如果有 M 空闲，则会进行回收或者睡眠。

### GMP 调度策略

设计策略有以下四种：

> 1、线程复用：采用两种机制：work stealing 机制与 hand off 机制。
>
> work stealing 机制：当本线程无可运行的 G 时，尝试从其他的线程绑定的 P 偷取 G，而不是销毁线程，优先级是先从全局队列中获取 G，再从其他的 P 的本地队列中获取 G。
>
> hand off 机制：当本线程因为 G 进行系统调用阻塞的时候，线程释放绑定的 P，把 P 转移给其他空闲的线程执行。
>
> 2、并行应用：一般来说，GOMAXPROCS 限定的 P 个数为 CPU 的核心数量的一半。
>
> 3、抢占：有多个 G 等待执行时候，每个 G 在 CPU 执行下不超过 10ms，防止其他 G 被饿死现象。
>
> 4、全局 G 队列：基于 work stealing 机制进行的补充。从其他 P 本地队列偷不到 G 时，偷取全局队列的 G。

## Golang 垃圾回收机制

### Go V1.3 版本之前的标记清除（mark and sweep）

此版本的垃圾回收机制，一般分为以下四步：

> 1、暂停程序业务逻辑，找出不可达的对象以及可达的对象
>
> 2、开始标记，程序找出其所有可达的对象，并进行标记
>
> 3、标记完之后，开始清除未标记的对象
>
> 4、继续运行程序。循环以上的过程，直到程序的生命周期终止为止

但是相应的，V1.3 版本中的垃圾回收的问题也较大：首先有个 STW 暂停程序，这会浪费大量的时间去处理垃圾回收，不利于效率的提升，其次每一次的标记需要扫描整个 Heap 堆区，而且清除相关的数据也会产生内存堆的碎片。

### Go v1.5 版本的三色标记法

此时，垃圾回收机制将运行中的程序状态分为：白、黑、灰三种状态：

> 1、每一步默认创建的对象均标记为"白色"
>
> 2、每一次 GC 回收的时候，均会从根节点遍历所有的对象，而且把遍历的对象从白色的集合放入"灰色"的集合中，遍历为非递归形式
>
> 3、遍历灰色的集合，将灰色对象引用的对象从白色集合中放入灰色集合，然后将灰色对象放入黑色集合中
>
> 4、重复第三步，直到灰色集合中无任何对象
>
> 5、回收所有白色集合中的对象，即回收垃圾

但是此处有两个问题：

- 1、如果黑色对象之间直接引用指向一个白色的对象，那么在第二步的时候，此白色对象并不能进行相应的染色，所以说此处会导致白色对象被清除
- 2、如果之前白色对象被灰色对象引用，而在扫描时系统发生了故障，导致灰色对象引用白色对象的指针丢失，导致白色对象被清除

所以这样也引入了相应的优化方法：插入屏障与删除屏障机制。

### Go 插入写屏障、删除写屏障

插入写屏障主要应用为：在强三色不变式下（黑色直接引用白色的对象），那么此时，使用插入写屏障机制，强行改写黑色引用对象白色为灰色。但是插入写屏障机制会有几个缺点：需要重新扫描栈，大约 10 ms ~ 100 ms，也消耗了相应的系统资源。

删除写屏障主要应用为：在弱三色不变式下（黑色引用白色对象，白色对象其他上游的引用对象有灰色对象进行引用）。其也存在相应的不足：回收精度低、一个对象即使被删除了最后一个指向它的指针也依旧能活过这一轮，在下一轮的 GC 中被清除。

### Go V1.8 三色标记法与混合写屏障

混合标记法其实很容易理解，就是把插入写屏障与删除写屏障混合起来进行使用，其相应的步骤如下：

> 1、在 Go GC 触发之前，递归扫描分配在栈上的对象，使栈上的对象全部标记为"黑色"（此处因为是标记为全部"黑色"，所以不会使用 STW 机制）
>
> 2、在 Go GC 运行期间，如果往栈上插入对象，将栈上的对象全部标记为"黑色"
>
> 3、同理，在 Go GC 运行，所有往堆上插入或者删除的对象，都标记为"灰色"

### Go GC 性能不佳的原因

1、建立的 struct 对象过小，所以导致频繁的 GC 检查；

2、Go 文件中出现内存泄漏的问题。

## Go 语言中的 channel 学习

虽然 Go 的开发者极力推荐使用 channel。但是通过大家的工程化道路上的探索，channel 并不是处理并发问题的普适性的使用方法，有时候使用传统的并发原语更简单，而且不容易出错。

所以在使用并发原语时候，一般遵循以下几种设置方式：

> 1、共享资源的并发访问使用传统并发原语
>
> 2、复杂的任务编排和消息传递使用 channel
>
> 3、消息通知机制使用 channel，除非只想 signal 一个 goroutine，才使用 Cond
>
> 4、简单等待所有任务的完成用 WaitGroup，也有 channel 的推崇者用 channel，都可以
>
> 5、需要和 select 语句结合，使用 channel
>
> 6、需要和超时配合时，使用 channel 和 context

### channel 具体使用的方式

1、动态处理不定数量的 channel，使用 reflect.Select 函数，将 channel 当成参数传入，具体案例代码如下：

```go
func main() {
    var ch1 = make(chan int, 10)
    var ch2 = make(chan int, 10)

    // 创建SelectCase
    var cases = createCases(ch1, ch2)

    // 执行10次select
    for i := 0; i < 10; i++ {
        chosen, recv, ok := reflect.Select(cases)
        if recv.IsValid() { // recv case
            fmt.Println("recv:", cases[chosen].Dir, recv, ok)
        } else { // send case
            fmt.Println("send:", cases[chosen].Dir, ok)
        }
    }
}

func createCases(chs ...chan int) []reflect.SelectCase {
    var cases []reflect.SelectCase

    // 创建recv case
    for _, ch := range chs {
        cases = append(cases, reflect.SelectCase{
            Dir:  reflect.SelectRecv,
            Chan: reflect.ValueOf(ch),
        })
    }

    // 创建send case
    for i, ch := range chs {
        v := reflect.ValueOf(i)
        cases = append(cases, reflect.SelectCase{
            Dir:  reflect.SelectSend,
            Chan: reflect.ValueOf(ch),
            Send: v,
        })
    }

    return cases
}
```

上述代码先使用 createCases 函数分别为每个 channel 生成了 recv case 和 send case，并返回一个 reflect.SelectCase 数组。然后，通过一个循环 10 次的 for 循环执行 reflect.Select 从 cases 中伪随机的选择一个 case 执行。第一次肯定是 send case，因为此时 channel 还没有元素，recv 还不可用。等 channel 中有了数据以后，recv case 就可以被选择了。这就可以处理不定数量的 channel。

2、经典的消息传递案例：

> 有 4 个 goroutine，编号为 1、2、3、4。每秒钟会有一个 goroutine 打印出它自己的编号，要求你编写程序，让输出的编号总是按照 1、2、3、4、1、2、3、4……这个顺序打印出来。

```go
type Token struct{}

func newWorker(id int, ch chan Token, nextCh chan Token) {
    for {
        token := <-ch         // 取得令牌
        fmt.Println((id + 1)) // id从1开始
        time.Sleep(time.Second)
        nextCh <- token
    }
}
func main() {
    chs := []chan Token{make(chan Token), make(chan Token), make(chan Token), make(chan Token)}

    // 创建4个worker
    for i := 0; i < 4; i++ {
        go newWorker(i, chs[i], chs[(i+1)%4])
    }

    //首先把令牌交给第一个worker
    chs[0] <- Token{}

    select {}
}
```

首先，我们定义一个令牌类型 Token，其结构为空的 struct，一般都是使用空结构体进行消息的通知。接着定义一个创建 worker 的方法，这个方法会从它自己的 chan 中读取令牌。哪个 goroutine 取得了令牌，就可以打印出自己编号。因为需要每秒打印一次数据，所以，我们让它休眠 1 秒后，再把令牌交给它的下家。接着启动每个 worker 的 goroutine，并将令牌先交给第一个 worker。这样，就会保证程序的运行是 1、2、3、4 的顺序输出。

## Go 语言中的 sync.Mutex 学习

Go 语言中的 sync 包的 mutex 的设计，有四个演变阶段。

- 1、初版的 Mutex 采用一个 flag 表示锁是否被持有，实现比较简单
- 2、之后为了照顾新来的 Goroutine（下文简称 G），会让新人能够尽可能的优先获取锁，此为第二个阶段
- 3、第三个阶段呢，是使被唤醒的 G 与新来的 G 有更多的机会竞争锁，但是这样会引发相应的饥饿问题，所以目前又加入了饥饿的解决方案
- 4、第四个即为解决饥饿的阶段

![mutex1](/images/go/mutex1.png)

### 初版 mutex 的实现

```go
// 2008 年时候，Russ Cox 提交的第一版的 mutex 如下所示

//CAS 操作，当时并未抽象出 atomic 原子包
func cas(val *int32, old, new int32) bool
func semacquire(*int32)
func semrelease(*int32)

type Mutex struct {
    //锁是否被持有
    key int32

    //信号量专用，用于阻塞/唤醒 G
    sema int32
}

//保证成功在 val 上添加 delta 的值
func xadd(val *int32, delta int32) (new int32) {
    for {
        v := *val
        if cas(val, v, v + delta) {
            return v + delta
        }
    }
    panic("unreached")
}

//请求锁
func (m *Mutex) Lock() {
    if xadd(&m.key, 1) == 1 { // 标识加 1，如果为 1，则获取到锁
        return
    }
    semacquire(&m.sema) //否则阻塞等待
}

func (m *Mutex) Unlock() {
    if xadd(&m.key, -1) == 0 {// 标识减 1，如果为 0，则没有其他的等待者
        return
    }
    semrelease(&m.sema) //唤醒其他的 G
}
```

- 其中，CAS 为一种指令，即将给定的值与内存地址中的值进行相比较，如果是同一个值，就用新值替换内存地址中的旧值。而且 CAS 操作指令是原子性的指令（即数据库中原子性的概念，修改不了数据，事务回滚到修改之前的数据，数据不改变）

![mutex2](/images/go/mutex2.png)

> 有趣的事情是，Unlock 方法能被任意的 G 调用释放，即使没有持有互斥锁的 G，也能进行相应的操作。

所以在使用 Mutex 的时候，必须保证 G 尽可能不去释放自己未持有的锁，一定遵循"谁申请，谁释放"的原则。一般在使用 Mutex 的时候，Lock 与 Unlock 方法都应该在一个方法内成对出现。

> 在 1.14 版本中 Go 对 defer 做了相应的优化，采取更有效的内联模式，将之前生成的 defer 对象放入 defer chain 中，所以 defer 对程序执行的影响微乎其微了。

缺点：请求锁的时候，G 会排队等待获取互斥锁，虽然看起来挺公平的，但是从性能上来看，并非最优的解法。如果能将锁让给正在用 CPU 时间片的 G 的话，就不需要做上下文的切换，在高并发的情况下，可能会有更好的性能。

### "给新人机会" 阶段

2011 年 6 月 30 日，Go 语言开发者在 commit 中对 Mutex 做了一次大调整，调整后的 Mutex 实现如下：

```go
type Mutex struct {
    state int32
    sema uint32
}

const (
    mutexLock = 1 << iota //mutex is locked
    mutexWoken
    mutexWaiterShift = iota
)
```

其中 Mutex 此版本的设计思想为将第一个 int32 类型的 state 字段，拆分为二进制，按二进制的位数进行区分：

![mutex3](/images/go/mutex3.png)

这样可以以最小的内存来实现互斥锁结构，最低位表示锁是否被占有（1|0 占有|非占有），次低位表示锁是否有被唤醒的 G，其余 30 位表示等待此锁的 G 的数量。与计算机网络的子网划分很相似的设计，一个数值，分为三部分，代表三个意义。

并且因为 atomic 原子性包的添加，请求锁 Lock 也变复杂了：

```go
func (m *Mutex) Lock() {
    //Fast path : 幸运 case，能够直接获取到相应的锁
    if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
        return
    }

    awoke := false
    for {
        old := m.state
        new := old | mutexLocked //新状态加锁
        if old & mutexLocked != 0 {
            new = old + 1 << mutexWaiterShift //等待者数量加一
        }

        if awoke {
            //G 是被唤醒的
            //新状态清除唤醒标志
            new &^= mutexWoken
        }

        if atomic.CompareAndSwapInt32(&m.state, old, new) {//设置新状态
            if old & mutexLocked == 0 { //锁原状态未加锁
                break
            }
            runtime.Semacquire(&m.sema) //请求信号量
            awoke = true
        }
    }
}
```

设计包含大量的位运算，要联系 Go 语言的位运算优先级进行思考。

### 使用 mutex 的一些注意事项

1、能不用 mutex 尽量不用 mutex，使用读写锁更合适

2、尽量使用 defer 释放锁，防止因为 panic 而导致锁未释放

3、mutex.Lock() 后是不可重入的，写递归时候，不能调用 mutex

4、尽量使用读写锁！sync.RLock/RUnlock（读锁）、Lock/Unlock（写锁）

## Go 语言中的 sync.Pool 学习

Go 语言是自带垃圾回收机制的，所以我们不用像 C/C++ 一样，在使用完对象后还需要手动删除/析构对象，防止因为空指针导致的内存泄漏。

但是 Garbage Collect 机制方便的同时，也带来了一定的性能隐患，比如 STW 机制仍然存在，我们大量在堆上创建的对象，会影响垃圾回收标记的时间。

所以在 Go 语言中，性能优化的方向一般是采用对象池的方式，把不用的对象回收起来，避免被垃圾回收掉。同样的，类似于数据库、TCP 等长连接，也是保存在对象池中，可以大量减少业务的耗时！对应用程序整体性能也有一个提升。

### sync.Pool 的概念

首先需要我们理解 sync.Pool 的两个概念：

> sync.Pool 数据类型是：独立访问的临时对象，本身是**线程安全**的，能进行并发读取其中的对象！
>
> sync.Pool 也是不能进行复制使用的！

### sync.Pool 的使用方法

sync.Pool 仅有三种方法：New()、Get()、Put()

**New()**：sync.Pool 中的 New() 是 func() any 类型，其中 any 在源码中用 interface{} 表示。New 方法的使用场景为：在调用 Pool 的 Get 方法并不能从池子中获取空闲元素后，就会创建新的元素。

**Get()**：调用此方法会将一个 Pool 中的一个元素取走，返回值可以为 nil 值，所以使用此方法需要对返回值进行判断。

**Put()**：此方法用于将一个元素返回给 Pool，Pool 会将此元素保存在池中，而且可以复用，但是如果值是 nil，则 Pool 会忽略此值。

### sync.Pool 的应用场景

一般来说，很经典的场景即是 buffer 池，如 hugo 中的 bufpool，即可看到以下一段代码：

```go
var buffers = sync.Pool{
    New: func() *bytes.Buffer {
        return new(bytes.Buffer)
    },
}

func GetBuffer() *bytes.Buffer {
    return buffers.Get().(*bytes.Buffer)
}

func PutBuffer(buf *bytes.Buffer) {
    buf.Reset()
    buffers.Put(buf)
}
```

然而上述代码可能会导致内存泄漏的问题。因为取出 bytes.Buffer 后，在使用时，我们通常会向此 buffer 中增加大量的 byte 数据，此时的 slice 容量可能会扩大到另一个量级。而当我们再将其放入 Pool 中时，在 slice 容量不改变的情况下，由于 Pool 回收的机制，这些大的 buffer 就不会被回收，而是一直留在 Pool 池中，占用着计算机的内存。

### sync.Pool 的实现

Go 1.13 之前的版本实现的 sync.Pool 有两个问题：

> 1、每次 GC 都会回收其中创建的对象；
>
> 2、底层实现采用了：mutex，而在之前的 mutex 学习中，可以知道，对 mutex 锁进行并发操作，在锁竞争相当激烈的情况下，会导致性能的急剧下降。

所以 go 团队在 go 语言的 1.13 版本中，针对上述两个问题，做出了大量的优化（这也是 go 语言不建议我们在大量的并发中使用锁）。所以其中的一种优化方式就是 Pool 中不使用锁。

### 好用的第三方 sync.Pool 库

1、[bytebufferpool](https://github.com/valyala/bytebufferpool)：fasthttp 作者 valyala 提供的一个 buffer 池，基本功能和 sync.Pool 相同。底层使用 sync.Pool 实现的，并且会检测最大的 buffer，超过最大尺寸的 buffer，就会被丢弃。此官方的库提供了校准（calibrate，用来动态调整创建元素的权重）的机制，可以动态地调整 Pool 的 defaultSize 和 maxSize。

2、[oxtoacart/bpool](https://github.com/oxtoacart/bpool)

3、[fatih/pool](https://github.com/fatih/pool)

大部分 Work Pool 都是通过 channel 来缓存任务的，因为 channel 能很好的实现并发的保护，防止数据因为并发访问所造成的 data race！

### 总结

![pool2](/images/go/pool2.png)

> pool 是一个通用性的概念，用于解决对象重用与预先分配的一个常用的优化手段。类似数据库连接、HTTP 的 API 请求中已经封装使用了 Pool 了。

如果在程序中 GC 耗时特别高，大量相同的类型的临时对象不断进行创建与销毁，可以考虑通过使用 sync.Pool 对其进行优化改良！
