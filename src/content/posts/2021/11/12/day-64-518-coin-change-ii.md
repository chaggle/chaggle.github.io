---
title: "Day 64 518. 零钱兑换 II"
published: 2021-11-12T16:56:19+08:00
updated: 2021-11-12T16:56:19+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[518. 零钱兑换 II](https://leetcode-cn.com/problems/coin-change-2/)**

## 题目

```cpp
给你一个整数数组 coins 表示不同面额的硬币，另给一个整数 amount 表示总金额。

请你计算并返回可以凑成总金额的硬币组合数。如果任何硬币组合都无法凑出总金额，返回 0 。

假设每一种面额的硬币有无限个。 

题目数据保证结果符合 32 位带符号整数。

 

示例 1：

输入：amount = 5, coins = [1, 2, 5]
输出：4
解释：有四种方式可以凑成总金额：
5=5
5=2+2+1
5=2+1+1+1
5=1+1+1+1+1
示例 2：

输入：amount = 3, coins = [2]
输出：0
解释：只用面额 2 的硬币不能凑成总金额 3 。
示例 3：

输入：amount = 10, coins = [10]
输出：1
 

提示：

1 <= coins.length <= 300
1 <= coins[i] <= 5000
coins 中的所有值 互不相同
0 <= amount <= 5000
```

## 题目思路

> 与昨天的题目不同的是，本题的硬币数据规模变小了，而且 coins 中的所有值互不相同，因此本次题目用模板解决会更加简单。

## 题目代码

```cpp
class Solution {
public:
    int change(int amount, vector<int>& coins) {
        vector<int> dp(amount + 1);
        dp[0] = 1;
        for(auto& n : coins)
        {
            for (int i = n; i <= amount; i++) {
                dp[i] += dp[i - n];
            }
        }
        return dp[amount];
    }
};
```

## 复杂度

- 时间复杂度：O(n ^ 2)

- 空间复杂度：O(n)

## 参考文章

https://leetcode-cn.com/problems/partition-equal-subset-sum/solution/yi-pian-wen-zhang-chi-tou-bei-bao-wen-ti-a7dd/
