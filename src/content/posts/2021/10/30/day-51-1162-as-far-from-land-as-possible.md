---
title: "Day 51 1162. 地图分析"
published: 2021-10-30T20:44:57+08:00
updated: 2021-10-30T20:44:57+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1162. 地图分析](https://leetcode-cn.com/problems/as-far-from-land-as-possible/)**

## 题目

```cpp
你现在手里有一份大小为 N x N 的 网格 grid，

上面的每个 单元格 都用 0 和 1 标记好了。其中 0 代表海洋，1 代表陆地，

请你找出一个海洋单元格，这个海洋单元格到离它最近的陆地单元格的距离是最大的。

我们这里说的距离是「曼哈顿距离」（ Manhattan Distance）：

(x0, y0) 和 (x1, y1) 这两个单元格之间的距离是 |x0 - x1| + |y0 - y1| 。

如果网格上只有陆地或者海洋，请返回 -1。

 

示例 1：


输入：[[1,0,1],[0,0,0],[1,0,1]]
输出：2
解释：
海洋单元格 (1, 1) 和所有陆地单元格之间的距离都达到最大，最大距离为 2。
示例 2：


输入：[[1,0,0],[0,0,0],[0,0,0]]
输出：4
解释：
海洋单元格 (2, 2) 和所有陆地单元格之间的距离都达到最大，最大距离为 4。
 

提示：

1 <= grid.length == grid[0].length <= 100
grid[i][j] 不是 0 就是 1
```

## 题目思路

- BFS 模板题，从所有陆地同时出发进行 BFS，只需要加上上下左右四个方向的判断条件即可。

## 题目代码

```cpp
class Solution {
private:
    vector<vector<int>> dis = {{-1, 0}, {1, 0}, {0, 1}, {0, -1}};
public:
    int maxDistance(vector<vector<int>>& grid) {
        int m = grid.size(), n = grid[0].size();
        deque<pair<int, int>> q;
        for(int i = 0; i < m; i++)
        {
            for(int j = 0; j < n; j++)
            {
                if(grid[i][j] == 1)
                {
                    q.push_back({i, j});
                }
            }
        }
        //无陆地或者海洋则返回；
        if(q.size() == 0 || q.size() == m * n) return -1;

        int ans = -1;
        while(!q.empty())
        {
            ans++;
            int s = q.size();
            while(s--)
            {
                auto k = q.front(); q.pop_front();
                for(auto& d : dis)
                {
                   int x = k.first + d[0];
                   int y = k.second + d[1];
                    // 如果搜索到的新坐标超出范围/陆地/已经遍历过，则不搜索了
                    if(x < 0 || x >= m || y < 0 || y >= n || grid[x][y] != 0) continue;
                    //搜索后记为-1，表示不能再遇见
                    grid[x][y] = -1;
                    q.push_back({x, y});
                }
            }
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(m \* n)

- 空间复杂度：O(1)
