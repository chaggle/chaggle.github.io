---
title: "Day 5 232. 用栈实现队列"
published: 2021-09-14T16:11:21+08:00
updated: 2021-09-14T16:11:21+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[232. 用栈实现队列](https://leetcode-cn.com/problems/implement-queue-using-stacks/)**

## 题目

```cpp
请你仅使用两个栈实现先入先出队列。

队列应当支持一般队列支持的所有操作（push、pop、peek、empty）：

实现 MyQueue 类：

void push(int x) 将元素 x 推到队列的末尾

int pop() 从队列的开头移除并返回元素

int peek() 返回队列开头的元素

boolean empty() 如果队列为空，返回 true ；否则，返回 false
 

说明：

你只能使用标准的栈操作
就是只有 push to top, peek/pop from top, size, 和 is empty 操作是合法的。

你所使用的语言也许不支持栈。

你可以使用 list 或者 deque（双端队列）来模拟一个栈，只要是标准的栈操作即可。
 
进阶：

你能否实现每个操作均摊时间复杂度为 O(1) 的队列？

换句话说，执行 n 个操作的总时间复杂度为 O(n) ，即使其中一个操作可能花费较长时间。
 

示例：

输入：
["MyQueue", "push", "push", "peek", "pop", "empty"]
[[], [1], [2], [], [], []]
输出：
[null, null, null, 1, 1, false]

解释：
MyQueue myQueue = new MyQueue();
myQueue.push(1); // queue is: [1]
myQueue.push(2); // queue is: [1, 2] (leftmost is front of the queue)
myQueue.peek(); // return 1
myQueue.pop(); // return 1, queue is [2]
myQueue.empty(); // return false
 

提示：

1 <= x <= 9
最多调用 100 次 push、pop、peek 和 empty
假设所有操作都是有效的 （例如，一个空的队列不会调用 pop 或者 peek 操作）
```

## 题目思路

- 如题所给，创建两个栈，其中 s1 为入栈，s2 为出栈；
- 由于栈是动态实现的，不存在上溢问题，所以入栈只需要将 x 保存至 s1 中即可；
- 在 pop() 与 peek() 函数中，是相同的逻辑，只是一个需要删除，一个不需要删除。

## 题目代码

### 代码块

```cpp
class MyQueue {
private:
    stack<int> s1, s2;
public:
    /** Initialize your data structure here. */
    MyQueue() {}

    /** Push element x to the back of queue. */
    void push(int x) {
        s1.push(x);
    }

    /** Removes the element from in front of queue and returns that element. */
    int pop()
    {
        if(s2.size() == 0 && s1.size() == 0) return false;
        else if(s2.size() != 0)
        {
            int temp = s2.top();
            s2.pop();
            return temp;
        }
        else
        {
            while(s1.size() != 0)
            {
                int tmp = s1.top();
                s2.push(s1.top());
                s1.pop();
            }
            int temp = s2.top();
            s2.pop();
            return temp;
        }
    }

    /** Get the front element. */
    int peek() {
        if(s2.size() == 0 && s1.size() == 0) return false;
        else if(s2.size() != 0) return s2.top();
        else
        {
            while(s1.size() != 0)
            {
                int tmp = s1.top();
                s2.push(s1.top());
                s1.pop();
            }
        }
        return s2.top();
    }

    /** Returns whether the queue is empty. */
    bool empty() {
        return s1.empty() && s2.empty();
    }
};

/**
 * Your MyQueue object will be instantiated and called as such:
 * MyQueue* obj = new MyQueue();
 * obj->push(x);
 * int param_2 = obj->pop();
 * int param_3 = obj->peek();
 * bool param_4 = obj->empty();
 */
```

## 复杂度

- 时间复杂度：均摊 O(1)。除了调用 pop() 与 peek() 初次需要较长的时间之外，其余都只需要 O(1) 的复杂度（击败 100% 应该就是 O(1) 吧）。
- 空间复杂度：O(n)，两个栈一共存放输入 n 个数据规模，故应为 O(n)。
