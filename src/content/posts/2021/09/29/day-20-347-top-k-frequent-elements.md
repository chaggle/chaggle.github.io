---
title: "Day 20 347. 前 K 个高频元素"
published: 2021-09-29T10:22:10+08:00
updated: 2021-09-29T10:22:10+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[347. 前 K 个高频元素](https://leetcode-cn.com/problems/top-k-frequent-elements/)**

## 题目

```cpp
给你一个整数数组 nums 和一个整数 k ，

请你返回其中出现频率前 k 高的元素。

你可以按 任意顺序 返回答案。

示例 1:

输入: nums = [1,1,1,2,2,3], k = 2
输出: [1,2]

示例 2:

输入: nums = [1], k = 1
输出: [1]
 
提示：

1 <= nums.length <= 10^5
k 的取值范围是 [1, 数组中不相同的元素的个数]
题目数据保证答案唯一，换句话说，数组中前 k 个高频元素的集合是唯一的
 

进阶：你所设计算法的时间复杂度 必须 优于 O(n log n) ，其中 n 是数组大小。
```

## 题目思路

- 典型的大顶堆问题。可以先用 unordered_map 保存键值对，再建立一个 priority_queue；由于 C++ 中 priority_queue 默认是大顶堆，将 unordered_map 中的键值对 {k, v} 改为 {v, k} 保存进 priority_queue 即可，最后输出前 k 个键值对的 v 值即可；
- 进阶版可以手写一个堆来替换 priority_queue，等以后有时间再来补坑。

## 题目代码

### 代码块

```cpp
class Solution {
public:
    vector<int> topKFrequent(vector<int>& nums, int n) {
        unordered_map<int, int> up;
        for(auto i : nums) up[i]++;
        priority_queue<pair<int, int>> p;
        for(auto it = up.begin(); it != up.end(); it++)
        {
            p.push({it -> second, it -> first});
        }
        vector<int> ans;
        while(n--)
        {
            ans.push_back(p.top().second);
            p.pop();
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(nlogn)
- 空间复杂度：O(n)
