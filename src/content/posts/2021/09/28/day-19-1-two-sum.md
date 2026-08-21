---
title: "Day 19 1. 两数之和"
published: 2021-09-28T15:51:16+08:00
updated: 2021-09-28T15:51:16+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1. 两数之和](https://leetcode-cn.com/problems/two-sum/)**

## 题目

```cpp
给定一个整数数组 nums 和一个整数目标值 target，

请你在该数组中找出 和为目标值 target 的那两个 整数，并返回它们的数组下标。

你可以假设每种输入只会对应一个答案。但是，数组中同一个元素在答案里不能重复出现。

你可以按任意顺序返回答案。

示例 1：

输入：nums = [2,7,11,15], target = 9
输出：[0,1]
解释：因为 nums[0] + nums[1] == 9 ，返回 [0, 1] 。

示例 2：

输入：nums = [3,2,4], target = 6
输出：[1,2]

示例 3：

输入：nums = [3,3], target = 6
输出：[0,1]
 
提示：

2 <= nums.length <= 10^4
-10^9 <= nums[i] <= 10^9
-10^9 <= target <= 10^9
只会存在一个有效答案
进阶：你可以想出一个时间复杂度小于 O(n^2) 的算法吗？
```

## 题目思路

- 暴力解没什么好说的，主要是回忆一下 unordered_map 的相关使用方法，具体可以看本博客去年的总结。

## 题目代码

### 代码块

```cpp
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> umap;
        int n = nums.size();
        for(int i = 0; i < n; i++)
        {
            auto it = umap.find(target - nums[i]);
            if(it != umap.end())
            {
                return {it -> second, i};
            }
            umap[nums[i]] = i;
        }
        return {};
    }
};
```

## 复杂度

- 时间复杂度：O(n)，仅需一次遍历即可
- 空间复杂度：O(n)
