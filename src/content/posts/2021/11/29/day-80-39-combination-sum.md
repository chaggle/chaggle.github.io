---
title: "Day 80 39. 组合总和"
published: 2021-11-29T17:31:34+08:00
updated: 2021-11-29T17:31:34+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[39. 组合总和](https://leetcode-cn.com/problems/combination-sum/)**

## 题目

```cpp
给定一个无重复元素的正整数数组 candidates 和一个正整数 target

找出 candidates 中所有可以使数字和为目标数 target 的唯一组合。

candidates 中的数字可以无限制重复被选取。如果至少一个所选数字数量不同，则两种组合是唯一的。 

对于给定的输入，保证和为 target 的唯一组合数少于 150 个。

 

示例 1：

输入: candidates = [2,3,6,7], target = 7
输出: [[7],[2,2,3]]
示例 2：

输入: candidates = [2,3,5], target = 8
输出: [[2,2,2,2],[2,3,3],[3,5]]
示例 3：

输入: candidates = [2], target = 1
输出: []
示例 4：

输入: candidates = [1], target = 1
输出: [[1]]
示例 5：

输入: candidates = [1], target = 2
输出: [[1,1]]
 

提示：

1 <= candidates.length <= 30
1 <= candidates[i] <= 200
candidate 中的每个元素都是独一无二的。
1 <= target <= 500
```

## 题目思路

> 经典递归算法：每个元素都有"不选"与"选"两个分支，选择当前元素后继续从当前下标递归，从而允许同一个元素被无限次选取；当组合和等于 target 时记录答案。

## 题目代码

```cpp
class Solution {
public:
    void dfs(
        vector<int>& candidates, int target, vector<vector<int>>& ans,
        vector<int>& combine, int idx
    ) {
        if (idx == candidates.size()) return;

        if (target == 0) {
            ans.emplace_back(combine);
            return;
        }

        dfs(candidates, target, ans, combine, idx + 1);

        if (target - candidates[idx] >= 0) {
            combine.emplace_back(candidates[idx]);
            dfs(candidates, target - candidates[idx], ans, combine, idx);
            combine.pop_back();
        }
    }

    vector<vector<int>> combinationSum(vector<int>& candidates, int target) {
        vector<vector<int>> ans;
        vector<int> combine;
        dfs(candidates, target, ans, combine, 0);
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(s)
- 空间复杂度：O(target)
