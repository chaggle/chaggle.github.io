---
title: "Day 58 62. 不同路径"
published: 2021-11-06T22:14:57+08:00
updated: 2021-11-06T22:14:57+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[62. 不同路径](https://leetcode-cn.com/problems/unique-paths/)**

## 题目

```cpp
一个机器人位于一个 m x n 网格的左上角 （起始点在下图中标记为 “Start” ）。

机器人每次只能向下或者向右移动一步。

机器人试图达到网格的右下角（在下图中标记为 “Finish” ）。

问总共有多少条不同的路径？

 

示例 1：


输入：m = 3, n = 7
输出：28
示例 2：

输入：m = 3, n = 2
输出：3
解释：
从左上角开始，总共有 3 条路径可以到达右下角。
1. 向右 -> 向下 -> 向下
2. 向下 -> 向下 -> 向右
3. 向下 -> 向右 -> 向下
示例 3：

输入：m = 7, n = 3
输出：28
示例 4：

输入：m = 3, n = 3
输出：6
 

提示：

1 <= m, n <= 100
题目数据保证答案小于等于 2 * 10^9
```

## 题目思路

- 典型的二维 DP 简单题。第一行和第一列全部初始化为 1，然后逐格向下累加即可，其实也是一个排列组合的问题。

## 题目代码

```cpp
class Solution {
public:
    int uniquePaths(int m, int n) {
        vector<vector<int>> ans(m, vector<int>(n));

        for(int i = 0; i < m; i++) ans[i][0] = 1;
        for(int i = 0; i < n; i++) ans[0][i] = 1;

        for(int i = 1; i < m; i++)
        {
            for(int j = 1; j < n; j++)
            {
                ans[i][j] = ans[i - 1][j] + ans[i][j - 1];
            }
        }

        return ans[m - 1][n - 1];
    }
};
```

## 复杂度

- 时间复杂度：O(n \* m)

- 空间复杂度：O(n * m)
