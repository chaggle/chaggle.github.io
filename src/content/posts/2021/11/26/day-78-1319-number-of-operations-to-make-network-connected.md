---
title: "Day 78 1319. 连通网络的操作次数"
published: 2021-11-26T22:47:27+08:00
updated: 2021-11-26T22:47:27+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1319. 连通网络的操作次数](https://leetcode-cn.com/problems/number-of-operations-to-make-network-connected/)**

## 题目

```cpp
用以太网线缆将 n 台计算机连接成一个网络，计算机的编号从 0 到 n-1。

线缆用 connections 表示，其中 connections[i] = [a, b] 连接了计算机 a 和 b。

网络中的任何一台计算机都可以通过网络直接或者间接访问同一个网络中其他任意一台计算机。

给你这个计算机网络的初始布线 connections，

你可以拔开任意两台直连计算机之间的线缆，并用它连接一对未直连的计算机。

请你计算并返回使所有计算机都连通所需的最少操作次数。如果不可能，则返回 -1 。 

 

示例 1：


输入：n = 4, connections = [[0,1],[0,2],[1,2]]
输出：1
解释：拔下计算机 1 和 2 之间的线缆，并将它插到计算机 1 和 3 上。
示例 2：


输入：n = 6, connections = [[0,1],[0,2],[0,3],[1,2],[1,3]]
输出：2
示例 3：

输入：n = 6, connections = [[0,1],[0,2],[0,3],[1,2]]
输出：-1
解释：线缆数量不足。
示例 4：

输入：n = 5, connections = [[0,1],[0,2],[3,4],[2,3]]
输出：0
 

提示：

1 <= n <= 10^5
1 <= connections.length <= min(n*(n-1)/2, 10^5)
connections[i].length == 2
0 <= connections[i][0], connections[i][1] < n
connections[i][0] != connections[i][1]
没有重复的连接。
两台计算机不会通过多条线缆连接。
```

## 题目思路

> 与昨日相同的并查集思路。统计连通分量的个数与多余的连接数，若多余的连接数不足以连通所有分量（小于分量数减一），则返回 -1，否则返回分量数减一。

## 题目代码

```cpp
class Djset {
private:
    vector<int> parent;  // 记录节点的根
    vector<int> rank;  // 记录根节点的深度（用于优化）
    int count;         // 记录连通分量的个数
    int rest;          // 记录多余的连接数
public:
    Djset(int n): parent(vector<int>(n)), rank(vector<int>(n)), count(n), rest(0) {
        for (int i = 0; i < n; i++) {
            parent[i] = i;
        }
    }

    int find(int x) {
        // 压缩方式：直接指向根节点
        if (x != parent[x]) {
            parent[x] = find(parent[x]);
        }
        return parent[x];
    }

    void merge(int x, int y) {
        int rootx = find(x);
        int rooty = find(y);
        if (rootx != rooty) {
            // 按秩合并
            if (rank[rootx] < rank[rooty]) {
                swap(rootx, rooty);
            }
            parent[rooty] = rootx;
            if (rank[rootx] == rank[rooty]) rank[rootx] += 1;
            count--;
        } else {
            rest++;
        }
    }
    int getCount() {
        return count;
    }
    int getRest() {
        return rest;
    }
};

class Solution {
public:
    int makeConnected(int n, vector<vector<int>>& connections) {
        Djset ds(n);
        for (auto& e :connections) {
            ds.merge(e[0], e[1]);
        }
        if (ds.getRest() < ds.getCount() - 1) return -1;
        return ds.getCount() - 1;
    }
};
```

## 复杂度

- 时间复杂度：O($n^2$)
- 空间复杂度：O(n)
