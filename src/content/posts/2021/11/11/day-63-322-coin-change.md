---
title: "Day 63 322. 零钱兑换"
published: 2021-11-11T17:37:46+08:00
updated: 2021-11-11T17:37:46+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[322. 零钱兑换](https://leetcode-cn.com/problems/coin-change/)**

## 题目

```cpp
给你一个整数数组 coins ，表示不同面额的硬币；以及一个整数 amount ，表示总金额。

计算并返回可以凑成总金额所需的 最少的硬币个数 。如果没有任何一种硬币组合能组成总金额，返回 -1 。

你可以认为每种硬币的数量是无限的。

 

示例 1：

输入：coins = [1, 2, 5], amount = 11
输出：3
解释：11 = 5 + 5 + 1
示例 2：

输入：coins = [2], amount = 3
输出：-1
示例 3：

输入：coins = [1], amount = 0
输出：0
示例 4：

输入：coins = [1], amount = 1
输出：1
示例 5：

输入：coins = [1], amount = 2
输出：2
 

提示：

1 <= coins.length <= 12
1 <= coins[i] <= 231 - 1
0 <= amount <= 104
```

## 题目思路

> 与前面的背包题目思路相同，参考以往题目与资料后，对模板稍作改动即可解决问题。

## 题目代码

```cpp
class Solution {
public:
    int INF = 1000000000;
    int coinChange(vector<int>& coins, int amount) {
        vector<int> dp(amount + 1, INF);
        dp[0] = 0;
        for (int i = 0; i < coins.size(); i++)
        {
            for(int j = coins[i]; j <= amount; j++)
            {
                dp[j] = min(dp[j], dp[j - coins[i]] + 1);
            }
        }
        if (dp[amount] == INF) dp[amount] = -1;
        return dp[amount];
    }
};
```

## 复杂度

- 时间复杂度：O(n ^ 2)

- 空间复杂度：O(n)

## 参考文章

https://leetcode-cn.com/problems/partition-equal-subset-sum/solution/yi-pian-wen-zhang-chi-tou-bei-bao-wen-ti-a7dd/
