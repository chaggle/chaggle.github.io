---
title: "Day 72 78. 子集"
published: 2021-11-20T09:08:01+08:00
updated: 2021-11-20T09:08:01+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[78. 子集](https://leetcode-cn.com/problems/subsets/)**

## 题目

```cpp
给你一个整数数组 nums ，数组中的元素 互不相同 。返回该数组所有可能的子集（幂集）。

解集 不能 包含重复的子集。你可以按 任意顺序 返回解集。

 

示例 1：

输入：nums = [1,2,3]
输出：[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]
示例 2：

输入：nums = [0]
输出：[[],[0]]
 

提示：

1 <= nums.length <= 10
-10 <= nums[i] <= 10
nums 中的所有元素 互不相同
```

## 题目思路

> 本题目若只是求子集的个数该多好，直接套公式即可，可惜是要输出每一个对应的子集。利用两个数组，一个存放最终答案，一个作为递归缓存；dfs 先加入当前元素递归到底，再回溯剔除该元素继续递归，从而枚举出全部子集。最后 34 天就要考研了，写得会比较紧张。

## 题目代码

```cpp
class Solution {
public:
    vector<int> tmp;
    vector<vector<int>> ans;

    vector<vector<int>> subsets(vector<int>& nums) {
        dfs(0, nums);
        return ans;
    }

    void dfs(int i, vector<int>& nums) {
        int n = nums.size();
        if (i == n) {
            ans.push_back(tmp);
            return;
        }
        tmp.push_back(nums[i]);
        dfs(i + 1, nums);
        tmp.pop_back();
        dfs(i + 1, nums);
    }

};
```

## 复杂度

- 时间复杂度：O(n*2^n)

- 空间复杂度：O(n)
