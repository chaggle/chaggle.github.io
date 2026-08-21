---
title: "Day 42 778. 水位上升的泳池中游泳"
published: 2021-10-21T16:30:21+08:00
updated: 2021-10-21T16:30:21+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[778. 水位上升的泳池中游泳](https://leetcode-cn.com/problems/swim-in-rising-water/)**

## 题目

```cpp
在一个 N x N 的坐标方格 grid 中，每一个方格的值 grid[i][j] 表示在位置 (i,j) 的平台高度。

现在开始下雨了。当时间为 t 时，此时雨水导致水池中任意位置的水位为 t 。

你可以从一个平台游向四周相邻的任意一个平台，但是前提是此时水位必须同时淹没这两个平台。

假定你可以瞬间移动无限距离，也就是默认在方格内部游动是不耗时的。

当然，在你游泳的时候你必须待在坐标方格里面。

你从坐标方格的左上平台 (0，0) 出发。最少耗时多久你才能到达坐标方格的右下平台 (N-1, N-1)？

 

示例 1:

输入: [[0,2],[1,3]]
输出: 3
解释:
时间为0时，你位于坐标方格的位置为 (0, 0)。
此时你不能游向任意方向，

因为四个相邻方向平台的高度都大于当前时间为 0 时的水位。

等时间到达 3 时，你才可以游向平台 (1, 1). 因为此时的水位是 3，

坐标方格中的平台没有比水位 3 更高的，所以你可以游向坐标方格中的任意位置
示例2:

输入: [[0,1,2,3,4],
      [24,23,22,21,5],
      [12,13,14,15,16],
      [11,17,18,19,20],
      [10,9,8,7,6]]
输出: 16
解释:
 0  1  2  3  4
24 23 22 21  5
12 13 14 15 16
11 17 18 19 20
10  9  8  7  6

最终的路线用加粗进行了标记。
我们必须等到时间为 16，此时才能保证平台 (0, 0) 和 (4, 4) 是连通的
 

提示:

2 <= N <= 50.
grid[i][j] 是 [0, ..., N * N - 1] 的排列。
```

## 题目思路

- 其实最想用并查集去做，毕竟它能很方便地判断图的连通情况；但考虑到实现方法是二分，所以还是采用了二分查找 + DFS 遍历图的做法。
- 二分的目的是寻找一个合适的水位阈值，DFS 用来尝试能否从左上角走到右下角，边界值应该是 $n * n$；搜索时不能重复走已经走过的格子，所以要设置一个 bool 类型的标记记录。
- DFS 写起来其实比较简单，边界条件想清楚即可：只有一种情况能返回 true，其他情况都返回 false，每次搜索有四个方向可选。
- 这道题比前两天的题目要简单一些。

## 题目代码

```cpp
class Solution {
public:
    int swimInWater(vector<vector<int>>& grid) {
        int n = grid.size();
        int l = 0, r = n * n - 1;
        while(l < r)
        {
            int mid = l + (r - l) / 2;
            vector<vector<bool>> vis(n, vector<bool> (n, false));
            if(dfs(grid, vis, n, mid, 0, 0)) r = mid;//可达，偏大
            else l = mid + 1; //不可达，偏小
        }
        return l;
    }

        bool dfs(
            vector<vector<int>> &grid,
            vector<vector<bool>> &vis, int n, int mid, int i, int j)
        {
            if(i < 0 || j < 0 || i >= n || j >= n) return false;
            else if(vis[i][j]) return false;
            vis[i][j] = true;
            if(grid[i][j] > mid) return false;
            else if(i == n - 1 && j == n - 1) return true; //只有到终点才返回true；
            return dfs(grid, vis, n, mid, i - 1, j) ||
                   dfs(grid, vis, n, mid, i + 1, j) ||
                   dfs(grid, vis, n, mid, i, j - 1) ||
                   dfs(grid, vis, n, mid, i, j + 1);
        }

};
```

## 复杂度

- 时间复杂度：O($n ^ 2 * logn$)

- 空间复杂度：O($n ^ 2$)
