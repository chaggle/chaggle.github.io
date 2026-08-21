---
title: "GCC 与 GDB 的学习"
published: 2021-10-06T22:56:50+08:00
updated: 2021-10-06T22:56:50+08:00
tags: ["gcc", "gdb", "middleware"]
category: "middleware"
---
:::note

gcc 是 GNU Compiler Collection 的缩写，支持多种语言的编译，比如 C、C++、Java、Pascal 等。

:::


## GCC 的编译过程

- 预处理（pre-processing）E：插入头文件，替换宏
- 编译（Compiling）S：编译成汇编
- 汇编（Assembling）c：编译成目标文件
- 链接（Linking）：链接到库中，变成可执行文件

```bash
gcc -E hello.c -o hello.i

gcc -S hello.i -o hello.s

gcc -c hello.s -o hello.o

gcc hello.s -o hello 链接，生成可执行文件

./hello 运行
```

也可以一次性完成：

```bash
gcc hello.c -o hello
```

但一般情况下生成 .o 文件比较好，目标文件可以重定位，方便让别人使用。

## GCC 常用选项

| 选项名 | 作用 |
| :-------: | :-------: |
| -c | 编译或汇编源文件，但不链接，生成目标文件 |
| -o | 指定输出文件 |
| -E | 只运行 C 预编译器（头文件、宏等展开） |
| -S | 生成汇编语言文件后停止编译（.s 文件） |
| -Wall | 打开编译告警（所有） |
| -g | 嵌入调试信息，方便 gdb 调试 |
| -llib | 链接 lib 库（这里是小写 L），相当于 C++ 的 #pragma comment(lib, "xxx.lib") |
| -Idir | 增加 include 目录（这里是大写 i），指定头文件路径 |
| -LDir | 增加 lib 目录（编译静态库和动态库） |

## GDB 调试实例

下面以一个带有错误的例子程序来介绍 gdb 的使用：

```c
/*bugging.c*/
#include <stdio.h>
#include <stdlib.h>

static char buff [256];
static char* string;
int main ()
{
    printf ("Please input a string: ");
    gets (string);
    printf ("\nYour string is: %s\n", string);
}
```

上面的程序接受用户的输入，然后将用户的输入打印出来。由于使用了未经过初始化的字符串指针 string，编译并运行之后，将出现 "Segmentation Fault" 错误：

```bash
$ gcc -o bugging -g  bugging.c
$ ./bugging

# Please input a string: asdf
# Segmentation fault (core dumped)
# 为了查找该程序中出现的问题，我们利用 gdb，并按如下的步骤进行：

# [1] 运行 "gdb bugging" ，加载 bugging 可执行文件；
$ gdb bugging

# [2] 执行装入的 bugging 命令；
(gdb) run

# [3] 使用 where 命令查看程序出错的地方；
(gdb) where

# [4] 利用 list 命令查看调用 gets 函数附近的代码；
(gdb) list

# [5] 在 gdb 中，我们在第 11 行处设置断点，看看是否是在第 11 行出错；
(gdb) break 11

# [6] 程序重新运行到第 11 行处停止，这时程序正常，然后执行单步命令 next；
(gdb) next

# [7] 程序确实出错，能够导致 gets 函数出错的因素就是变量 string。重新执行测试程序，用 print 命令查看 string 的值；
(gdb) run
(gdb) print string
(gdb) $1=0x0

# [8] 问题在于 string 指向的是一个无效指针。修改程序，在第 10 行和第 11 行之间增加一条语句 "string=buff;"，重新编译程序，然后继续运行，将看到正确的程序运行结果。
```

用 gdb 查看源代码可以用 list 命令，但这样不够灵活。可以使用 "layout src" 命令，或者按 Ctrl-X 再按 A，就会出现一个窗口来查看源代码；也可以使用 -tui 参数，这样进入 gdb 后就能直接打开代码查看窗口。其他代码窗口相关命令：

| 命令 | 作用 |
| :-------: | :-------: |
| info win | 显示窗口的大小 |
| layout next | 切换到下一个布局模式 |
| layout prev | 切换到上一个布局模式 |
| layout src | 只显示源代码 |
| layout asm | 只显示汇编代码 |
| layout split | 显示源代码和汇编代码 |
| layout regs | 增加寄存器内容显示 |
| focus cmd/src/asm/regs/next/prev | 切换当前窗口 |
| refresh | 刷新所有窗口 |
| tui reg next | 显示下一组寄存器 |
| tui reg system | 显示系统寄存器 |
| update | 更新源代码窗口和当前执行点 |
| winheight name +/- line | 调整 name 窗口的高度 |
| tabset nchar | 设置 tab 为 nchar 个字符 |
