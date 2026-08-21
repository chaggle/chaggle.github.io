---
title: "Day 82 47. 全排列 II"
published: 2021-11-30T15:17:24+08:00
updated: 2021-11-30T15:17:24+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[47. 全排列 II](https://leetcode-cn.com/problems/permutations-ii/)**

## 题目

```cpp
给定一个可包含重复数字的序列 nums ，按任意顺序 返回所有不重复的全排列。

示例 1：

输入：nums = [1,1,2]
输出：
[[1,1,2],
 [1,2,1],
 [2,1,1]]

示例 2：

输入：nums = [1,2,3]
输出：[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]
 

提示：

1 <= nums.length <= 8
-10 <= nums[i] <= 10
```

## 题目思路

> 回溯法，只不过今日的题目较为简单。核心的去重思路：先对数组排序，在同一层递归中，若当前数字与前一个数字相同且前一个数字尚未使用（!vis[j - 1]），则跳过，从而避免生成重复的全排列。

## 题目代码

```cpp
class Solution {
public:
    vector<int> vis;

    void backtrack(
        vector<int>& nums, vector<vector<int>>& ans, int i, vector<int>& res
    ) {
        int n = nums.size();
        if (i == n) {
            ans.emplace_back(res);
            return;
        }
        for (int j = 0; j < n; j++) {
            if (vis[j] || (j > 0 && nums[j] == nums[j - 1] && !vis[j - 1])) continue;
            res.emplace_back(nums[j]);
            vis[j] = 1;
            backtrack(nums, ans, i + 1, res);
            vis[j] = 0;
            res.pop_back();
        }
    }

    vector<vector<int>> permuteUnique(vector<int>& nums) {
        vector<vector<int>> ans;
        vector<int> res;
        vis.resize(nums.size());
        sort(nums.begin(), nums.end());
        backtrack(nums, ans, 0, res);
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O($2 ^ n * n$)
- 空间复杂度：O($n$)
