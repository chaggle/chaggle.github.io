---
title: "Day 60 464. 我能赢吗"
published: 2021-11-08T20:40:13+08:00
updated: 2021-11-08T20:40:13+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[464. 我能赢吗](https://leetcode-cn.com/problems/can-i-win/)**

## 题目

```cpp
在 "100 game" 这个游戏中，两名玩家轮流选择从 1 到 10 的任意整数，累计整数和，

先使得累计整数和达到或超过 100 的玩家，即为胜者。

如果我们将游戏规则改为 “玩家不能重复使用整数” 呢？

例如，两个玩家可以轮流从公共整数池中抽取从 1 到 15 的整数（不放回），直到累计整数和 >= 100。

给定一个整数 maxChoosableInteger 和另一个整数 desiredTotal，判断先出手的玩家是否能稳赢？

你可以假设 maxChoosableInteger 不会大于 20， desiredTotal 不会大于 300。

示例：

输入：
maxChoosableInteger = 10
desiredTotal = 11

输出：
false

解释：
无论第一个玩家选择哪个整数，他都会失败。
第一个玩家可以选择从 1 到 10 的整数。
如果第一个玩家选择 1，那么第二个玩家只能选择从 2 到 10 的整数。
第二个玩家可以通过选择整数 10（那么累积和为 11 >= desiredTotal），从而取得胜利.
同样地，第一个玩家选择任意其他整数，第二个玩家都会赢。
```

## 题目思路

- 本题只有两种对立的结局：必赢和必输，也就是博弈中判断先手能否稳赢的问题。如果先手 A 选择某个数 X 后，无论后手 B 选什么都能保证 A 获胜，则返回 true；否则 A 选择任意数后 B 都有必胜方法，返回 false。

## 题目代码

```cpp
class Solution {
public:
    bool canIWin(int stable, int desired) {
        if (stable >= desired) return true;

        if (stable * (stable + 1) / 2 < desired) return false;

        unordered_map<int, bool> up;
        return dfs(stable, desired, 0, up);
    }

    bool dfs(int n, int sum, int k, unordered_map<int, bool>& up) {
        if (up.count(k)) return up[k];

        for (int i = 0; i < n; ++i) {
            int cur = (1 << i);
            if ((cur & k) == 0)
            {//这个值没有使用过
                if (sum <= i + 1 || !dfs(n, sum - (i + 1), cur | k, up))
                {
                    up[k] = true;
                    return true;
                }
            }
        }
        up[k] = false;
        return false;
    }
};
```

## 复杂度

- 时间复杂度：O(n \* 2^n)

- 空间复杂度：O(2^n)
