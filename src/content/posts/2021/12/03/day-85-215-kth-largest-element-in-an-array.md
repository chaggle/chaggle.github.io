---
title: "Day 85 215. 数组中的第K个最大元素"
published: 2021-12-03T22:29:54+08:00
updated: 2021-12-03T22:29:54+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[215. 数组中的第K个最大元素](https://leetcode-cn.com/problems/kth-largest-element-in-an-array/)**

## 题目

```cpp
给定整数数组 nums 和整数 k，请返回数组中第 k 个最大的元素。

请注意，你需要找的是数组排序后的第 k 个最大的元素，而不是第 k 个不同的元素。

 

示例 1:

输入: [3,2,1,5,6,4] 和 k = 2
输出: 5
示例 2:

输入: [3,2,3,1,2,4,5,5,6] 和 k = 4
输出: 4
 

提示：

1 <= k <= nums.length <= 104
-104 <= nums[i] <= 10^4
```

## 题目思路

> 今日的题目很经典，一个可以复习快排的思想，一个可以复习如何建立堆。这里采用手写大顶堆：先构建堆，再依次把堆顶与末尾元素交换并向下调整，经过 k - 1 次调整后，堆顶即为第 k 大的元素。

## 题目代码

```cpp
class Solution{
public:
    void heap_sort(vector<int>&ans, int i, int n) {
        int l = i * 2 + 1, r = i * 2 + 2, max = i;

        if (l < n && ans[l] > ans[max]) max = l;
        if (r < n && ans[r] > ans[max]) max = r;

        if (max != i)
        {
            swap(ans[i], ans[max]);
            heap_sort(ans, max, n);
        }
    }

    void buildHeap(vector<int>& ans, int n) {
        for (int i = n / 2; i >= 0; --i) heap_sort(ans, i, n);
    }

    int findKthLargest(vector<int>& nums, int k) {
        int n = nums.size();
        buildHeap(nums, n);
        for (int i = nums.size() - 1; i >= nums.size() - k + 1; i--)
        {
            swap(nums[0], nums[i]);
            --n;
            heap_sort(nums, 0, n);
        }
        return nums[0];
    }
};
```

## 复杂度

- 时间复杂度：O(nlogn)
- 空间复杂度：O(logn)
