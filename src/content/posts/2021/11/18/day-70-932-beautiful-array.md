---
title: "Day 70 932. 漂亮数组"
published: 2021-11-18T00:20:21+08:00
updated: 2021-11-18T00:20:21+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[932. 漂亮数组](https://leetcode-cn.com/problems/beautiful-array/)**

## 题目

```cpp
对于某些固定的 N，如果数组 A 是整数 1, 2, ..., N 组成的排列，使得：

对于每个 i < j，都不存在 k 满足 i < k < j 使得 A[k] * 2 = A[i] + A[j]。

那么数组 A 是漂亮数组。

 

给定 N，返回任意漂亮数组 A（保证存在一个）。

 

示例 1：

输入：4
输出：[2,1,4,3]
示例 2：

输入：5
输出：[3,1,2,5,4]
 

提示：

1 <= N <= 1000
```

## 题目思路

> 分治法的逻辑题目：递归构造左、右两部分，将左半部分映射为奇数（2x - 1），右半部分映射为偶数（2x），奇偶分离后即可保证数组满足漂亮数组的条件。

## 题目代码

```cpp
class Solution {
public:
    vector<int> beautifulArray(int n) {
        if(n == 1) return {1};
        auto l = beautifulArray((n + 1) / 2);
        auto r = beautifulArray(n / 2);
        vector<int> ans;
        for(auto x : l) ans.push_back(2 * x - 1);
        for(auto x : r) ans.push_back(2 * x);
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(logn)

- 空间复杂度：O(n)
