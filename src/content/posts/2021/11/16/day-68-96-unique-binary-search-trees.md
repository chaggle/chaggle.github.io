---
title: "Day 68 96. 不同的二叉搜索树"
published: 2021-11-16T20:08:51+08:00
updated: 2021-11-16T20:08:51+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[96. 不同的二叉搜索树](https://leetcode-cn.com/problems/unique-binary-search-trees/)**

## 题目

```cpp
给你一个整数 n ，求恰由 n 个节点组成且节点值

从 1 到 n 互不相同的 二叉搜索树 有多少种？

返回满足题意的二叉搜索树的种数。


示例 1：


输入：n = 3
输出：5
示例 2：

输入：n = 1
输出：1


提示：

1 <= n <= 19
```

## 题目思路

> 本题采用动态规划求解子问题，dp[i] 表示 i 个节点组成的二叉搜索树的种数。枚举根节点 j 时，左子树由 j - 1 个节点构成（对应 dp[j - 1]），右子树由 i - j 个节点构成（对应 dp[i - j]），两者相乘后累加即可。

## 题目代码

```cpp
class Solution {
public:
    int numTrees(int n) {
        vector<int> dp(n + 1, 0);
        dp[0] = dp[1] = 1;
        for(int i = 2; i <= n; i++)
        {
            for(int j = 1; j <= i; j++)
            {
                dp[i] += dp[j - 1] * dp[i - j];
            }
        }
        return dp[n];
    }
};
```

## 复杂度

- 时间复杂度：O(nlogn)

- 空间复杂度：O(n)
