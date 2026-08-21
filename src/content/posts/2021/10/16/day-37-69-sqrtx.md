---
title: "Day 37 69. Sqrt(x)"
published: 2021-10-16T17:44:11+08:00
updated: 2021-10-16T17:44:11+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[69. Sqrt(x)](https://leetcode-cn.com/problems/sqrtx/)**

## 题目

```cpp
给你一个非负整数 x ，计算并返回 x 的 算术平方根 。

由于返回类型是整数，结果只保留 整数部分 ，小数部分将被 舍去 。

注意：不允许使用任何内置指数函数和算符，例如 pow(x, 0.5) 或者 x ** 0.5 。

 

示例 1：

输入：x = 4
输出：2
示例 2：

输入：x = 8
输出：2
解释：8 的算术平方根是 2.82842..., 由于返回类型是整数，小数部分将被舍去。
 

提示：

0 <= x <= 2^31 - 1
```

## 题目思路

- 使用二分法求算术平方根。另外还有牛顿迭代法和红蓝法，我还没有研究，后面找时间研究一下。

## 题目代码

```cpp
class Solution {
public:
    int mySqrt(int x) {
        long long l = 0, r = x;
        while(l < r)
        {
            long long mid = (l + r + 1) >> 1;
            if(mid <= x /mid) l = mid;
            else r = mid - 1;
        }
        return l;
    }
};
```

## 复杂度

- 时间复杂度：O(logn)

- 空间复杂度：O(1)
