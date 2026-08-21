---
title: "Day 76 547. 省份数量"
published: 2021-11-24T21:42:41+08:00
updated: 2021-11-24T21:42:41+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[547. 省份数量](https://leetcode-cn.com/problems/number-of-provinces/)**

## 题目

```cpp
有 n 个城市，其中一些彼此相连，另一些没有相连。

如果城市 a 与城市 b 直接相连，且城市 b 与城市 c 直接相连，那么城市 a 与城市 c 间接相连。

省份 是一组直接或间接相连的城市，组内不含其他没有相连的城市。

给你一个 n x n 的矩阵 isConnected ，

其中 isConnected[i][j] = 1 表示第 i 个城市和第 j 个城市直接相连，

而 isConnected[i][j] = 0 表示二者不直接相连。

返回矩阵中 省份 的数量。

 

示例 1：


输入：isConnected = [[1,1,0],[1,1,0],[0,0,1]]
输出：2
示例 2：


输入：isConnected = [[1,0,0],[0,1,0],[0,0,1]]
输出：3
 

提示：

1 <= n <= 200
n == isConnected.length
n == isConnected[i].length
isConnected[i][j] 为 1 或 0
isConnected[i][i] == 1
isConnected[i][j] == isConnected[j][i]
```

## 题目思路

> 刚好今年考研新增了并查集的学习内容，所以本次正好可以复习一下 UnionFind 类的相应写法。

## 题目代码

```cpp
class UnionFind {
private:
    unordered_map<int, int> data; //存储父节点

    int cnt = 0; //记录数目

public:
    int find(int x) {
        int root = x;

        while(data[root] >= 0) root = data[root];

        //路径压缩
        while(x != root) {
            int tmp = data[x]; //tmp 指向 x 的父节点
            data[x] = root;	   //挂到根节点下
            x = tmp;
        }

        return root; //返回根节点的编号。
    }

    bool isconnected(int x, int y) {
        return find(x) == find(y);
    }

    void merge(int x, int y) {
        int p = find(x);
        int q = find(y);

        if(p != q) {
            data[p] = q;
            cnt--;
        }
    }

    void add(int x) {
        if(data.count(x) == 0) {
            data[x] = -1;
            cnt++;
        }
    }

    int getCnt() {
        return cnt;
    }
};

class Solution {
public:
    int findCircleNum(vector<vector<int>>& isConnected) {
        UnionFind u;
        int n = isConnected.size();
        for (int i = 0; i < n; i++) {
            u.add(i);
            for(int j = 0; j < i; j++) {
                if(isConnected[i][j]) u.merge(i, j);
            }
        }
        return u.getCnt();
    }
};
```

## 复杂度

- 时间复杂度：O($n^2$ * logn)
- 空间复杂度：O(n)
