---
title: "Day 3 1381. 设计一个支持增量操作的栈"
published: 2021-09-12T17:42:15+08:00
updated: 2022-06-15T10:48:56+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1381. 设计一个支持增量操作的栈](https://leetcode-cn.com/problems/design-a-stack-with-increment-operation/)**

## 题目

```cpp
请你设计一个支持下述操作的栈。

实现自定义栈类 CustomStack ：

CustomStack(int maxSize)：用 maxSize 初始化对象，maxSize 是栈中最多能容纳的元素数量

栈在增长到 maxSize 之后则不支持 push 操作。

void push(int x)：如果栈还未增长到 maxSize ，就将 x 添加到栈顶。

int pop()：弹出栈顶元素，并返回栈顶的值，或栈为空时返回 -1 。

void increment(int k, int val)：栈底的 k 个元素的值都增加 val

如果栈中元素总数小于 k ，则栈中的所有元素都增加 val 。


示例：

输入：
["CustomStack","push","push","push",
"push","push","increment","increment",
"pop","pop","pop","pop"]
[[3],[1],[2],[2],[3],[4],[5,100],[2,100],[],[],[],[]]
输出：
[null,null,null,null,null,null,null,null,2,103,202,201]
解释：
CustomStack customStack = new CustomStack(3); // 栈是空的 []
customStack.push(1); // 栈变为 [1]
customStack.push(2); // 栈变为 [1, 2]
customStack.pop(); // 返回 2 --> 返回栈顶值 2，栈变为 [1]
customStack.push(2); // 栈变为 [1, 2]
customStack.push(3); // 栈变为 [1, 2, 3]
customStack.push(4); // 栈仍然是 [1, 2, 3]，不能添加其他元素使栈大小变为 4
customStack.increment(5, 100); // 栈变为 [101, 102, 103]
customStack.increment(2, 100); // 栈变为 [201, 202, 103]
customStack.pop(); // 返回 103 --> 返回栈顶值 103，栈变为 [201, 202]
customStack.pop(); // 返回 202 --> 返回栈顶值 202，栈变为 [201]
customStack.pop(); // 返回 201 --> 返回栈顶值 201，栈变为 []
customStack.pop(); // 返回 -1 --> 栈为空，返回 -1


提示：

1 <= maxSize <= 1000
1 <= x <= 1000
1 <= k <= 1000
0 <= val <= 100
每种方法 increment，push 以及 pop 分别最多调用 1000 次
```

## 题目思路

- 创建一个动态数组 data，可以使用 C++ 中的 resize 函数重置数组容量，但反复动态扩容反而增大了时间的消耗；
- push、pop 都是经典的栈写法；
- increment 函数通过一次数组遍历即可完成。

## 题目代码

### 代码块

```cpp
class CustomStack {
private:
    vector<int> data;
    int top;

public:
    CustomStack(int maxSize)
    {
        data.resize(maxSize);
        top = -1;
    }

    void push(int x)
    {
        if (top != data.size() - 1)
        {
            data[++top] = x;
        }
    }

    int pop()
    {
        if (top == -1) return -1;
        else return data[top--];
    }

    void increment(int k, int val)
    {
        int minx = min(k, top + 1);
        for (int i = 0; i < minx; i++)
        {
            data[i] += val;
        }
    }
};
```

```go
type CustomStack struct {
    top int
    cap int
    stack []int

}

func Constructor(maxSize int) CustomStack {
    return CustomStack {
        stack : make([]int, 0),
        cap : maxSize,
        top : 0,
    }
}

func (this *CustomStack) Push(x int)  {
    if this.top < this.cap {
        this.stack = append(this.stack, x)
        this.top++
    } 
}

func (this *CustomStack) Pop() int {
    if this.top == 0 {
        return -1
    }
    
    x := this.stack[this.top - 1]
    this.stack = this.stack[:this.top - 1]
    this.top--
    
    return x
}

func (this *CustomStack) Increment(k int, val int)  {
    if k > this.top {
        k = this.top
    }
    for i := 0; i < k; i++ {
        this.stack[i] += val
    }
}

/**
 * Your CustomStack object will be instantiated and called as such:
 * obj := Constructor(maxSize);
 * obj.Push(x);
 * param_2 := obj.Pop();
 * obj.Increment(k,val);
 */
```

## 复杂度

- 时间复杂度：push、pop 均为 $O(1)$，而 increment 为 $O(minx)$，go 中为 $O(K)$。
- 空间复杂度：由创建的动态数组 data 的长度决定，即为 $O(maxSize)$。
