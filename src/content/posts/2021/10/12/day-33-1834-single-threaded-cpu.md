---
title: "Day 33 1834. 单线程 CPU"
published: 2021-10-12T16:05:18+08:00
updated: 2021-10-12T16:05:18+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1834. 单线程 CPU](https://leetcode-cn.com/problems/single-threaded-cpu/)**

## 题目

```cpp
给你一个二维数组 tasks ，用于表示 n 项从 0 到 n - 1 编号的任务。

其中 tasks[i] = [enqueueTimei, processingTimei]

意味着第 i 项任务将会于 enqueueTimei 时进入任务队列

需要 processingTimei 的时长完成执行。

现有一个单线程 CPU ，同一时间只能执行 最多一项 任务，该 CPU 将会按照下述方式运行：

如果 CPU 空闲，且任务队列中没有需要执行的任务，则 CPU 保持空闲状态。

如果 CPU 空闲，但任务队列中有需要执行的任务，则 CPU 将会选择 执行时间最短 的任务开始执行。

如果多个任务具有同样的最短执行时间，则选择下标最小的任务开始执行。
一旦某项任务开始执行，CPU 在 执行完整个任务 前都不会停止。
CPU 可以在完成一项任务后，立即开始执行一项新任务。
返回 CPU 处理任务的顺序。

 

示例 1：

输入：tasks = [[1,2],[2,4],[3,2],[4,1]]
输出：[0,2,3,1]
解释：事件按下述流程运行：
- time = 1 ，任务 0 进入任务队列，可执行任务项 = {0}
- 同样在 time = 1 ，空闲状态的 CPU 开始执行任务 0 ，可执行任务项 = {}
- time = 2 ，任务 1 进入任务队列，可执行任务项 = {1}
- time = 3 ，任务 2 进入任务队列，可执行任务项 = {1, 2}
- 同样在 time = 3 ，CPU 完成任务 0 并开始执行队列中用时最短的任务 2 ，可执行任务项 = {1}
- time = 4 ，任务 3 进入任务队列，可执行任务项 = {1, 3}
- time = 5 ，CPU 完成任务 2 并开始执行队列中用时最短的任务 3 ，可执行任务项 = {1}
- time = 6 ，CPU 完成任务 3 并开始执行任务 1 ，可执行任务项 = {}
- time = 10 ，CPU 完成任务 1 并进入空闲状态
示例 2：

输入：tasks = [[7,10],[7,12],[7,5],[7,4],[7,2]]
输出：[4,3,2,0,1]
解释：事件按下述流程运行：
- time = 7 ，所有任务同时进入任务队列，可执行任务项  = {0,1,2,3,4}
- 同样在 time = 7 ，空闲状态的 CPU 开始执行任务 4 ，可执行任务项 = {0,1,2,3}
- time = 9 ，CPU 完成任务 4 并开始执行任务 3 ，可执行任务项 = {0,1,2}
- time = 13 ，CPU 完成任务 3 并开始执行任务 2 ，可执行任务项 = {0,1}
- time = 18 ，CPU 完成任务 2 并开始执行任务 0 ，可执行任务项 = {1}
- time = 28 ，CPU 完成任务 0 并开始执行任务 1 ，可执行任务项 = {}
- time = 40 ，CPU 完成任务 1 并进入空闲状态
 

提示：

tasks.length == n
1 <= n <= 105
1 <= enqueueTimei, processingTimei <= 109
```

## 题目思路

- 设计 + 模拟题，本质上就是模拟一个单线程 CPU 的调度过程。

## 题目代码

```cpp
//task index序列号 start为进入队列时间 times为完成时间
class task {
public:
    int index;
    int start;
    int times;
    task(int index, int start, int times) : index(index), start(start), times(times) {}
    task() = default;
};

class Solution {
public:
    vector<int> getOrder(vector<vector<int>> &tasks)
    {
        vector<int> ans;
        auto cmptimes = [](task a, task b)
        {
            if (a.times == b.times) return a.index > b.index;
            else return a.times > b.times;
        };

        auto cmpstart = [](task a, task b)
        {
            return a.start > b.start;
        };

        priority_queue<task, vector<task>, decltype(cmptimes)> qtimes(cmptimes);
        priority_queue<task, vector<task>, decltype(cmpstart)> qstart(cmpstart);
        int n = tasks.size();

        for(int i = 0; i < n; ++i)
        {
            qstart.push({i, tasks[i][0], tasks[i][1]});
        }

        int now = qstart.top().start;
        while(qstart.size() > 0)
        {

            while (qstart.size() > 0 && qstart.top().start <= now)
            {
                qtimes.push(qstart.top());
                qstart.pop();
            }
            if (qtimes.size() > 0)
            {
                task x = qtimes.top();
                qtimes.pop();
                ans.push_back(x.index);
                now += x.times;
            }
            else
            {
                now = qstart.top().start;
            }
        }

        while (qtimes.size() > 0)
        {
            task x = qtimes.top();
            qtimes.pop();
            ans.push_back(x.index);
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(nlogn)

- 空间复杂度：O(n)
