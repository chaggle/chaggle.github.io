---
title: "Day 50 695. 岛屿的最大面积"
published: 2021-10-29T22:42:28+08:00
updated: 2021-10-29T22:42:28+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[695. 岛屿的最大面积](https://leetcode-cn.com/problems/max-area-of-island/)**

## 题目

```cpp
给你一个大小为 m x n 的二进制矩阵 grid 。

岛屿 是由一些相邻的 1 (代表土地) 构成的组合，

这里的「相邻」要求两个 1 必须在 水平或者竖直的四个方向上 相邻。

你可以假设 grid 的四个边缘都被 0（代表水）包围着。

岛屿的面积是岛上值为 1 的单元格的数目。

计算并返回 grid 中最大的岛屿面积。如果没有岛屿，则返回面积为 0 。

 

示例 1：


输入：grid = [[0,0,1,0,0,0,0,1,0,0,0,0,0,
             [0,0,0,0,0,0,0,1,1,1,0,0,0],
             [0,1,1,0,1,0,0,0,0,0,0,0,0],
             [0,1,0,0,1,1,0,0,1,0,1,0,0],
             [0,1,0,0,1,1,0,0,1,1,1,0,0],
             [0,0,0,0,0,0,0,0,0,0,1,0,0],
             [0,0,0,0,0,0,0,1,1,1,0,0,0],
             [0,0,0,0,0,0,0,1,1,0,0,0,0]]
输出：6
解释：答案不应该是 11 ，因为岛屿只能包含水平或垂直这四个方向上的 1 。
示例 2：

输入：grid = [[0,0,0,0,0,0,0,0]]
输出：0
 

提示：

m == grid.length
n == grid[i].length
1 <= m, n <= 50
grid[i][j] 为 0 或 1
```

## 题目思路

- 常规的 DFS 解法。注意递归过程中局部变量不能重名，重名会导致错误。
- 由于本题的岛屿用 0 和 1 表示，访问过的格子直接置 0 即可，可以省去访问数组；一般的 DFS 则需要设置 bool 类型的访问数组来标记是否访问过该格子。

## 题目代码

```cpp
class Solution {
public:
    int maxAreaOfIsland(vector<vector<int>>& grid) {
        int ans = 0;
        int n = grid.size(), m = grid[0].size();
        for(int i = 0; i < grid.size(); ++i)
        {
            for(int j = 0; j < grid[0].size(); ++j)
            {
                if (grid[i][j] == 1)
                    ans = max(dfs(grid, i, j), ans);
            }
        }
        return ans;
    }

    int dfs(vector<vector<int>>& grid, int i, int j)
    {
        int ans = 0;
        int l = grid.size(), r = grid[0].size();
        if(i >= l || i < 0 || j >= r || j < 0 || grid[i][j] == 0)
            return 0;
        else
        {
            ans++;
            grid[i][j] = 0;
            ans += dfs(grid, i + 1, j);
            ans += dfs(grid, i, j + 1);
            ans += dfs(grid, i - 1, j);
            ans += dfs(grid, i, j - 1);
        }

        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(m \* n)

- 空间复杂度：O(1)
