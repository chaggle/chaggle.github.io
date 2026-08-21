---
title: "Day 27 35. 搜索插入位置"
published: 2021-10-06T15:30:50+08:00
updated: 2021-10-06T15:30:50+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[35. 搜索插入位置](https://leetcode-cn.com/problems/search-insert-position/)**

## 题目

```cpp
给定一个排序数组和一个目标值，在数组中找到目标值，并返回其索引。

如果目标值不存在于数组中，返回它将会被按顺序插入的位置。

请必须使用时间复杂度为 O(log n) 的算法。

 

示例 1:

输入: nums = [1,3,5,6], target = 5
输出: 2
示例 2:

输入: nums = [1,3,5,6], target = 2
输出: 1
示例 3:

输入: nums = [1,3,5,6], target = 7
输出: 4
示例 4:

输入: nums = [1,3,5,6], target = 0
输出: 0
示例 5:

输入: nums = [1], target = 0
输出: 0
 

提示:

1 <= nums.length <= 10^4
-10^4 <= nums[i] <= 10^4
nums 为无重复元素的升序排列数组
-10^4 <= target <= 10^4
```

## 题目思路

- 一道需要修改二分法模板的题目。

## 题目代码

```cpp
class Solution {
public:
    int searchInsert(vector<int>& nums, int target) {
        int n = nums.size();
        int l = 0, r = n - 1;
        int mid = 0;
        while(l <= r)
        {
            mid = l + (r - l) / 2;
            if(nums[mid] == target) return mid;
            else if(nums[mid] > target) r = mid - 1;
            else l = mid + 1;
        }
        return l == mid + 1 ? l : mid;
    }
};
```

## 复杂度

- 时间复杂度：O(logn)
- 空间复杂度：O(1)
