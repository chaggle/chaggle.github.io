---
title: "Day 52 Shortest Cycle Containing Target Node"
published: 2021-10-31T20:26:49+08:00
updated: 2021-10-31T20:26:49+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[Shortest Cycle Containing Target Node](https://binarysearch.com/problems/Shortest-Cycle-Containing-Target-Node)**

## 题目

```cpp
You are given a two-dimensional list of integers graph

representing a directed graph as an adjacency list.

You are also given an integer target.

Return the length of a shortest cycle that contains target.

If a solution does not exist, return -1.

Constraints

n, m ≤ 250 where n and m are the number of rows and columns in graph
Example 1
Input
Visualize
graph = [
    [1],
    [2],
    [0]
]
target = 0
Output
3
Explanation
The nodes 0 -> 1 -> 2 -> 0 form a cycle

Example 2
Input
Visualize
graph = [
    [1],
    [2],
    [4],
    [],
    [0]
]
target = 3
Output
-1
```

## 题目思路

- BFS 题。查看示例可以发现图的存储方式是邻接表，所以直接套用 BFS 模板即可解决问题。
- 从目标节点出发逐层扫描整张图，判断每个节点能否回到目标节点，能找到则直接返回当前层数，遍历完仍找不到则返回 -1。

## 题目代码

```cpp
int solve(vector<vector<int>>& g, int t) {
    int n = g.size();
    vector<bool> vis(n, 0);
    queue<int> q;
    q.push(t);
    int ans = 0;

    while (!q.empty())
    {
        ans++;
        int n = q.size();
        for (int i = 0; i < n; i++)
        {
            int node = q.front();q.pop();
            for (auto& v : g[node])
            {
                if(v == t) return ans;
                if(!vis[v])  //如果是未访问节点， 等价于 vis[v] == 0
                {
                    q.push(v);
                    vis[v] = 1;
                }
            }
        }
    }
    return -1;
}
```

## 复杂度

- 时间复杂度：O(n + e)

- 空间复杂度：O(n)
