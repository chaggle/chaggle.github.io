---
title: "Go 网络编程与框架学习笔记"
published: 2026-08-11T00:00:00+08:00
updated: 2026-08-11T00:00:00+08:00
tags: ["2026", "Go", "HTTP", "gin", "zinx", "IM"]
category: "go"
---

> 2022 年学习 Go 网络编程的四篇笔记（HTTP 服务器/客户端、gin 框架、zinx 框架、轻量级 IM 项目）合并整理。

## Golang 开发一个 HTTP Web 服务器/客户端

:::note
之前的 zinx 学习，是基于 TCP/UDP 的 socket 协议进行编写，而本次要实现的是基于 HTTP 协议开发一个 Web 服务器端与客户端！
:::


### 要求

服务器端要求：

- 1、服务端维护一个内存数据结构，所有数据进程重启丢失，不做数据持久化，不考虑内存容量问题
- 2、服务端实现一个网络 API 接口，客户端向该 API 发送一个网络请求，请求数据是一个 string 的信息
- 3、服务端该 API 收到请求后响应一个 []string 的信息，返回之前发送过的所有 string，当次请求发送的 string 一定在最后，不关心是否重复

示例：

> 第一次请求发送："a"，响应: []string{"a"}
>
> 第二次请求发送："b"，响应: []string{"a", "b"}
>
> 第三次请求发送："a"，响应: []string{"a", "b", "a"}
>
> 注意服务端代码部分，任何情况下均不能退出进程。

客户端要求：

- 1、客户端必须是 Golang 函数（该函数后面简称 BcjClient），调用该服务端的 API 接口
- 2、该客户端函数输入参数为：string，输出参数为：[]string 和 error。客户端函数是个 function/函数，不是 method/方法
- 3、注意客户端函数业务代码执行过程中，任何情况下均不能退出进程
- 4、客户端函数的类型必须严格匹配

源码要求：

- 1、代码运行结果应当正确
- 2、不应该有 data race（race condition/竞争条件/数据竞争）。多线程客户端调用服务端时，不应当出现任何 2 个客户端得到的同样响应的可能性
- 3、需要满足 Database transaction（数据库事务）的 Serializability（可串行性）要求（注意：Golang 的 data race 工具只能找到部分 data race 情况）
- 4、代码不允许忽略错误，而且只能调用官方标准库，不能包含其他第三方代码（比如 github.com/xxx，比如 "golang.org/x/sync/xx"）。只有 GOROOT/src 下面的库算官方库，其他都不算官方库
- 5、实现应当简洁，代码可读性不能过差

### 设计思路

1、http 服务，基于 http 协议规则实现，并非 socket 协议规则进行实现

2、web 请求，restful 标准下，采用 POST 进行客户端的 web 服务请求

3、开发第一个版本时服务器维护的内存数据结构采用 sync.Map，采用 client 不设置用户名称，统一设置 token 值为 Client，返回客户端数据为 string 类型，并通过简单的空格字符串 " " 进行分离每一个 []string 类型的元素

4、（未完成）第二个版本客户端自设名称为 token 值，通过 header 包头的 token 值来对客户端进行区分，这个 token 值的维护放置于客户端，理论上为保证数据安全，应该放置于服务器。（2025 年再来看，只需要服务器端针对于 token 进行校验即可，jwt 的设置即为服务器端不保存 token，由客户端自行维护，当然这里可以采用双 token 的设计方法，在服务器端进行 redis 存储，当然设计也是有安全性风险的，但是一般性企业也不会需要安全性高到此中设计程度）

### 开发的细节

> 1、Go 语言很适合使用**测试驱动开发**，在工期缩短的情况下，可能不适用 TDD，而在工期充足的情况下，开发过程中，首先需要进行逻辑的梳理，逻辑梳理好之后再开始代码的撰写，上来就写代码都是想到哪里写到哪里，这种习惯不好，**最合适的方法是先使用注释写好相应的需求逻辑，再写代码，对于逻辑思考很实用**！
>
> 2、在做 string 字符串存储成 []string 类型的切片的时候，服务器端程序也需要使用一个 []string 类型进行保存，但是服务器回显给客户端是以 io.writer 实现的 writer 接口返回 []byte 流的数据，**而 []string 直接转为 []byte 流数据形式，之后客户端对于格式的处理较为麻烦**，所以最好还是 []string 类型，通过拼接一个 string 传输给客户端，我选择 []string 中间分割字符为空格字符。客户端接收到这个 string 类型的字符串后，使用 strings.Split() 函数，以空格字符进行分割。
>
> 3、为了解决客户端先于服务器端启动时间不同，导致的客户端 Dial 服务器端发生端口拒绝错误，采用 for 循环提交 POST 请求，直到请求建立成功后，再 break for 循环。
>
> 4、bug fix: 防止程序 panic 掉，mutex.unlock 并未释放，所以采用 defer m.Unlock 合适

### 优化

在服务器端，**使用 sync.Map 数据结构对传输的字符串进行存储，防止进行并发访问与并发存储**，但是由于自己在并发的能力功底不足，导致虽然设计是 sync.Map 控制，但仍存在 data race 的情况，无奈之下还是对一整段进行了加锁处理，其实也能使用全局的 channel 进行处理。但是这都与最初自己想要一步实现拒绝数据的竞争性访问的设计理念冲突，暂时也没想到很好的解决办法！等日后再对其进行优化！

### 代码附件

客户端：

```go
package gohttp

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

func BcjClient(writer string) ([]string, error) {
	var r *http.Response
	for {
		client := &http.Client{}
		req, err := http.NewRequest(
			http.MethodPost,
			"http://127.0.0.1:8999/v1",
			bytes.NewReader([]byte(writer)),
		)

		req.Header.Add("Token", "Client")
		req.Header.Add("content-Type", "text/plain")

		r, err = client.Do(req)
		if err == nil {
			break
		} else {
			fmt.Printf("err: %s\n", err)
			time.Sleep(3 * time.Second)
			continue
		}
	}
	defer func(Body io.ReadCloser) {
		_ = Body.Close()
	}(r.Body)

	content, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}

	//将传入的字符串变成字符串切片，并除去最后的换行格式问题！
	ToVisual := strings.Split(string(content), " ")
	ToVisual = ToVisual[:len(ToVisual)-1]

	return ToVisual, nil
}
```

服务器端：

```go
package gohttp

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"sync"
)

var cache sync.Map
var m sync.Mutex

func ClientHandler(writer http.ResponseWriter, req *http.Request) {

	if req.Method != "POST" {
		_, _ = fmt.Fprintf(writer, "Request is not POST! please send POST request!")
		return
	}

	token := req.Header.Get("Token")
	body, err := ioutil.ReadAll(req.Body)
	if err != nil {
		_, _ = fmt.Fprintf(writer, "read body err, %v\n", err)
		return
	}

	m.Lock()
	defer m.Unlock()

	GetFromCache, ok := cache.Load(token)
	if ok {
		GetFromCache = append(GetFromCache.([]string), []string{string(body)}...)
		cache.Store(token, GetFromCache)
	} else if !ok {
		cache.Store(token, []string{string(body)})
		GetFromCache, _ = cache.Load(token)
	}

	change := GetFromCache.([]string)
	var ToClient string
	for _, v := range change {
		ToClient += v
		ToClient += " "
	}
	_, _ = fmt.Fprintf(writer, "%s\n", ToClient)
}
```

## Go web 的相关知识复习（gin）

开始动手学习一些框架的基本样例，抛开学习底层的设计不谈，主要还是参考文档进行相应的组件开发。

### Beego 与 gin

首先学习框架之前，需要我们理解一个道理，学习框架的目的首先是适应业务场景的需要，其次是分为两种大类：一种是为了开发效率，另一种是为了追求运行的性能。追求运行性能的框架包含的东西挺多，比如 GIN，另一种追求开发效率的框架封装得非常好，即是 Beego 框架。

### 路由分组

gin 框架的路由分组为：对 router 创建 Group 即为分组，同一分组拥有同一前缀和同一中间件。其相关的写法如下：

```go
r := gin.Default()

v1 := r.Group("v1")
{
    v1.POST("/login", login)
    v1.POST("/submit", func)
    v1.POST("/read", func)
}
```

路由分组的目的是：使路由更加清晰，方便管理路由。

### 中间件

在请求到达路由的方法前和后进行的一系列的操作，使用中间件的时候，在路由组上进行 use 操作，后面传入中间件函数即可。中间件有概念叫做[洋葱中间件](https://zhuanlan.zhihu.com/p/279391637)：

![gin](/images/go/gin.jpg)

用 Go 语言写的还有以下的相关中间件：

> 日志：一般日志使用其他的工具：如 go-logging、logrus 等开源库。以及配合相应的日志切割工具去使用。
>
> Gorm：orm 是一种数据库操作辅助工具。Gorm 即是在 go 语言结构体和数据库产生映射，使得数据库关系、表内容可以直观的体现在结构体上。即可使用结构体完成增删改查的操作！至于 Gorm 如何使用，可以参考相应的详细文档，简单的增删改查可以使用 Gorm。设计复杂的结构以及优化操作，建议阅读 MYSQL 性能调优，阅读相应的例子进行优化。

### 框架的学习

快速掌握代码库中的库函数，最适合的学习方法为：先读库函数 -> 再读相应的结构体定义 -> 最后读相应的结构体绑定的方法。其中前两部分只需要执行 go doc 命令即可查看相应的函数与结构体，而第三部分需要仔细阅读相应的源码。记录学习的过程，建议使用思维导图，最后导入 markdown 文件中。

### Restful 风格

其中 restful 主要有四种方式：GET、POST、PUT、DELETE：

> GET 用于获取资源
>
> POST 用于创建资源
>
> PUT 用于修改资源
>
> DELETE 用于删除资源

> 参考文档：<https://www.kancloud.cn/shuangdeyu/gin_book/949415>、<https://gorm.io/zh_CN/docs/>

## Zinx 框架的学习

开始学习 Go 语言实现的 zinx 框架，项目地址为：[https://github.com/chaggle/zinx-study](https://github.com/chaggle/zinx-study)

> 使用 go mod 管理，初始化为 go mod init github.com/chaggle/zinx-study，并部署代码到 github.com 以及使用 go get 同步到本地 Gopath 的 github 包下！

### V0.1 基础的 server 模块

> 方法：初始化服务器 NewServer(name string) ziface.IServer、启动服务器 Start()、停止服务器 Stop()、运行服务器 Serve()
>
> 属性：名称 name、IP 版本 IPVersion、监听 IP IP、监听端口 Port

### V0.2 简单的链接封装和业务绑定

> 方法：启动链接 Start()、停止链接 Stop()、获取当前链接的 conn 对象（套接字）GetTCPConnection() \*net.TCPConn、得到链接 ID GetConnID() uint32、得到客户端连接的地址和端口 RemoteAddr() net.TCPAddr、发送数据的方法 Send(data []byte) error
>
> 属性：socket TCP 套接字 Conn \*net.TCPConn、链接的 ID ConnID uint32、当前链接状态（是否已经关闭）isClosed bool、与当前链接所绑定的处理业务与方法 handlerAPI ziface.HandleFunc、等待退出的 channel 管道 ExitChan chan bool

### V0.3 基础的 router 模块

Request 请求封装：将链接与数据绑定一起：

> 属性：链接的句柄 GetConnection() IConnection、请求数据 GetData() []byte
>
> 方法：得到链接 func (r \*Request) GetConnection() ziface.IConnection、得到数据 func (r \*Request) GetData() []byte、新建一个 Request 请求

Router 模块：

> 抽象的 IRouter：处理业务之前的方法 PreHandle(request IRequest)、处理业务的主方法 Handle(request IRequest)、处理业务之后的方法 PostHandle(request IRequest)
>
> 具体的 BaseRouter：继承并实现三个接口方法

zinx 集成 Router 模块：

> IServer 增添路由功能 AddRouter(router IRouter)
>
> Server 类增加 Router 成员（去掉之前的 HandAPI）
>
> Connection 类绑定一个 Router 成员
>
> 在 Connection 调用已经注册过的 Router 处理业务

当前版本只有一个路由能使用，如果加入新的路由模块，会使上一个路由模块的方法被重写覆盖。

### V0.4 全局配置模块

> 路径：服务器项目主地址/conf/zinx.json（用户进行填写）
>
> 创建一个 zinx 的全局配置模块 utils/globalobj.go
>
> 初始化后读取用户配置的 zinx.json，globalobj 对象中对应的 zinx 服务器句柄代码进行参数替换
>
> 提供一个 GlobalObject 对象 var GlobalObject \*GlobalObj

### V0.5 消息封装

定义消息的结构 Message：

> 属性：消息的 ID、消息的长度、消息的内容
>
> 方法：SetMsgId(uint32)、SetData([]byte)、SetDataLen(uint32)、GetDataLen() uint32、GetMsgId() uint32、GetData() []byte

定义解决 TCP 粘包问题的封包拆包的模块：

> 针对 Message 进行 TLV 格式的封装 func (dp \*DataPack) Pack(msg ziface.IMessage) ([]byte, error)：写 Message 的长度、写 Message 的 ID、写 Message 的内容
>
> 针对 Message 进行 TLV 格式的拆包 func (dp \*DataPack) Unpack(binaryData []byte) (ziface.IMessage, error)：先读取固定长度的 head（消息的长度和消息的类型），再根据消息内容的长度，再进行一次读写，从 conn 中读取消息的内容

将消息封装机制集成到 Zinx 框架中：

> 将 Message 添加到 Request 属性字段
>
> 修改连接读取数据的机制，将之前的单纯读取 byte 改成拆包形式，读取按照 TLV 形式进行读取
>
> 给链接提供一个发包的机制：将发送的消息打包，再发送

### V0.6 多路由模式

消息管理模块（支持多路由 API 调度管理）：

> 属性：集合 - 消息 ID 与对应 router 的关系 - map Apis map[uint32]ziface.IRouter
>
> 方法：根据 MsgId 来索引调度路由方法 func (mh \*MsgHandle) DoMsgHandler(request ziface.IRequest)、添加路由方法到 map 集合中 func (mh \*MsgHandle) AddRouter(msgID uint32, router ziface.IRouter)

消息管理模块集成到 Zinx 框架中：

> 将 server 模块里面的 Router 属性变为 MsgHandle 属性
>
> 将 server 模块中的 AddRouter 修改调用 MsgHandler 的 AddRouter
>
> 将 connection 模块中的 Router 属性替换为 MsgHandle 属性
>
> 将 connection 模块中 Router 的业务调度改为 MsgHandle 调度，并修改 StartRead 方法

### V0.7 读写协程分离

小修改，新增一个 goroutine 即可：

> 1、添加一个 Reader 和 Writer 之间通信的 channel
>
> 2、添加一个 Writer Goroutine
>
> 3、Reader 由之前发送给客户端 改成 发送给 通信 Channel
>
> 4、启动 Reader 和 Writer 一同工作

### V0.8 消息队列以及多任务

消息队列以及 Worker 工作池的实现：

> 创建一个消息队列 --- MsgHandler 消息管理模块：
>
> - 消息队列 TaskQueue []chan ziface.IRequest
> - 工作池的数量 WorkPoolSize uint32
>
> 创建多任务 work 工作池，并且启动：
>
> - 创建一个 worker 工作池：func (mh \*MsgHandle) StartWorkerPool()
> - 根据 WorkPoolSize 的数量去创建 Worker
> - 每个 worker 都应该用一个 Go 去承载
> - 1、阻塞等待当前 worker 的对应的 channel 的消息
> - 2、一旦有消息到来，worker 应该处理当前消息对应的业务
> - 3、将之前的发送消息，全部改成将消息发送给消息队列和 worker 工作池处理
>
> 定义一个方法，将消息发送给消息队列工作池的方法：
>
> - func (mh \*MsgHandle) SendMsgToTaskQueue(request ziface.IRequest)

将消息队列机制集成到 Zinx 框架中：

> 1、开启并调用消息队列及 worker 工作池，保证 workerPool 只有一个，应该在创建 Server 模块时候开启（在 Server listen 之前添加）
>
> 2、将从客户端处理的消息，发送给当前的 Worker 工作池来处理，在处理完拆包，得到了 request 请求，交给工作池来处理

小型项目，具体以技术方案跟思考为主，而与需求、产品、测试、运维的沟通可以让步于项目的上线。

## Go语言实现的轻量级IM项目

项目地址：[https://github.com/chaggle/go-im](https://github.com/chaggle/go-im)

### V0.1：建立基础的 main.go、server.go

> main 功能主要为创建服务器以及启动服务器
>
> server 功能有：
>
> 1、创建 server 对象
>
> 2、启动 Server 服务（TCP socket 套接字）
>
> 3、处理连接的业务

### V0.2：用户上线功能

> user 功能新增：
>
> 1、创建 user 对象
>
> 2、监听每个 user 对应的 channel 的消息
>
> server 新增功能：
>
> 1、新增 OnlineMap 与 Message 属性
>
> 2、在处理客户端上线的 Handler 创建并添加用户（使用到 OS 中的同步 Lock）
>
> 3、新增广播消息方法以及监听广播消息的 channel 方法

### V0.3：用户消息广播机制完善

> server 新增功能：
>
> 1、完善 handle 模块处处理业务的方法，启动一个针对于当前客户端的读 goroutine

### V0.4：用户业务层封装

> 对于用户层业务的层次化、模块化：
>
> server 中的 user 业务进行迁移：
>
> 1、server 关联
>
> 2、新增 Online、Offline、Domessage 方法

### V0.5：查询用户名以及用户名修改

> user 新增两个功能：
>
> 1、用户名查询的功能
>
> 2、用户名修改的功能，保证每个用户名唯一

### V0.6：超时强制下线以及私聊功能

> user 新增两个功能：
>
> 1、设置定时器，超时强制剔除，发消息代表活跃，长时间不发消息代表超时，即强制关闭用户连接
>
> 2、私聊功能，通过获取用户名队列中的用户名，来向用户发起私聊

### V1.0、V1.1：客户端基本功能

> 新增 client 客户端，当然并非 GUI 界面版本，也可以使用带 GUI 界面版本，满足通信协议即可：
>
> 1、连接建立功能、命令行解析功能
>
> 2、客户端菜单功能的预写

### V1.2：客户端的相应基本请求

> client 新增：
>
> 1、用户名修改请求，通过 io.copy() 阻塞监听的方式进行回显输出
>
> 2、用户进入公聊模式，进行消息的广播与退出公聊模式
>
> 3、用户进行私聊模式，选择用户功能封装以及单独对其发送消息
