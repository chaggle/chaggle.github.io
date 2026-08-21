---
title: "Day 66 435. 无重叠区间"
published: 2021-11-14T20:25:06+08:00
updated: 2021-11-14T20:25:06+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[435. 无重叠区间](https://leetcode-cn.com/problems/non-overlapping-intervals/)**

## 题目

```cpp
给定一个区间的集合，找到需要移除区间的最小数量，使剩余区间互不重叠。

注意:

可以认为区间的终点总是大于它的起点。

区间 [1,2] 和 [2,3] 的边界相互"接触"，但没有相互重叠。

示例 1:

输入: [ [1,2], [2,3], [3,4], [1,3] ]

输出: 1

解释: 移除 [1,3] 后，剩下的区间没有重叠。
示例 2:

输入: [ [1,2], [1,2], [1,2] ]

输出: 2

解释: 你需要移除两个 [1,2] 来使剩下的区间没有重叠。
示例 3:

输入: [ [1,2], [2,3] ]

输出: 0

解释: 你不需要移除任何区间，因为它们已经是无重叠的了。
```

## 题目思路

> 单刀直入，按照右边界升序排序，右边界值越大越靠后；遍历每一个区间，若当前区间的左端点与上一个保留区间的右边界产生重叠，则移除该区间，否则更新右边界。

## 题目代码

```cpp
class Solution {
public:
    int eraseOverlapIntervals(vector<vector<int>>& intervals) {
        int n = intervals.size();
        if(n == 0) return n;
        sort(intervals.begin(), intervals.end(), [](const auto & a, const auto &b)
        {
            return a[1] < b[1];
        });
        int del = 0;
        int r = intervals[0][1];
        for(int i = 1; i < n; i++)
        {
            if(intervals[i][0] < r) del++;
            else r = intervals[i][1];
        }
        return del;
    }
};
```

## 复杂度

- 时间复杂度：O(nlogn)

- 空间复杂度：O(logn)
