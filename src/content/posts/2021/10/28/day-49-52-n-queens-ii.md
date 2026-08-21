---
title: "Day 49 52. N皇后 II"
published: 2021-10-28T15:12:35+08:00
updated: 2021-10-28T15:12:35+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[52. N 皇后 II](https://leetcode-cn.com/problems/n-queens-ii/)**

## 题目

```cpp
n 皇后问题 研究的是如何将 n 个皇后放置在 n×n 的棋盘上，并且使皇后彼此之间不能相互攻击。

给你一个整数 n ，返回 n 皇后问题 不同的解决方案的数量。

示例 1：

输入：n = 4
输出：2
解释：如上图所示，4 皇后问题存在两个不同的解法。

示例 2：

输入：n = 1
输出：1
 

提示：

1 <= n <= 9
皇后彼此不能相互攻击，也就是说：任何两个皇后都不能处于同一条横行、纵行或斜线上。
```

## 题目思路

- 数据规模只有 1 到 9，本来可以直接打表、面向答案编程！
- 不过这里还是用了回溯法 + DFS：只要横、竖、斜三个方向没有其他皇后即可放置，若均冲突则返回 false。

## 题目代码

```cpp
class Solution {
private:
    vector<int> res;
    int ans = 0;
public:
    void dfs(vector<int>& res, int col, int row)
    {
        if(col == row) ans++;
        for(int i = 0; i < row; i++)
        {
            if (judge(res, i))
            {
                res.push_back(i);
                dfs(res, col + 1, row);
                res.pop_back();
            }
        }
    }

    bool judge(vector<int> res, int n)
    {
        for(int i = 0; i < res.size(); i++)
        {
            if ((abs(res[i] - n) == res.size() - i) || n == res[i]) return false;
        }
        return true;
    }

    int totalNQueens(int n) {
        /* vector<int> res = {1, 0, 0 ,2, 10, 4, 40, 92, 352};
        return res[n - 1]; */
        dfs(res, 0, n);
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n!)

- 空间复杂度：O(n)
