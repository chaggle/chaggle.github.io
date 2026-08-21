---
title: "Day 40 796. Minimum Light Radius"
published: 2021-10-19T18:03:15+08:00
updated: 2021-10-19T18:03:15+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[796. Minimum Light Radius](https://binarysearch.com/problems/Minimum-Light-Radius)**

## 题目

```cpp
You are given a list of integers nums

representing coordinates of houses on a 1-dimensional line.

You have 3 street lights that you can put anywhere on the coordinate line

and a light at coordinate x lights up houses in [x - r, x + r],

inclusive. Return the smallest r required

such that we can place the 3 lights and all the houses are lit up.

Constraints

n ≤ 100,000 where n is the length of nums
Example 1
Input
nums = [3, 4, 5, 6]
Output
0.5
Explanation
If we place the lamps on 3.5, 4.5 and 5.5 then with r = 0.5 we can light up all 4 houses.
```

## 题目思路

- 这道题有点数学问题的味道，通过两个二分搜索来找到可能的最小半径。
- 其中一个二分用于判断当前的直径能否用三个路灯覆盖整个数组的范围。
- 另一个二分则用来调整直径的大小。

## 题目代码

```cpp
class Solution {
public:
    bool isvaild(double diameter, vector<int>& nums) {
        int n = nums.size();
        double l = 0, ans = 0;
        while (l < n)
        {
            l = upper_bound(nums.begin(), nums.end(), nums[l] + diameter) - nums.begin();
            ans++;
        }
        return ans <= 3 ? 1: 0;
    }

    double solve(vector<int>& nums) {
        sort(nums.begin(), nums.end());
        int n = nums.size();
        double l = 0;
        double r = nums[n - 1];
        while(l < r)
        {
            int diameter = l + (r - l) / 2;
            if(isvaild(diameter, nums)) r = diameter;
            else l = diameter + 1;
        }
        return l / 2;
    }
}
```

## 复杂度

- 时间复杂度：O(nlogn)

- 空间复杂度：O(1)
