---
title: "Day 62 494. 目标和"
published: 2021-11-10T16:57:32+08:00
updated: 2021-11-10T16:57:32+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[494. 目标和](https://leetcode-cn.com/problems/target-sum/)**

## 题目

```cpp
给你一个 只包含正整数 的 非空 数组 nums 。

请你判断是否可以将这个数组分割成两个子集，使得两个子集的元素和相等。

 

示例 1：

输入：nums = [1,5,11,5]
输出：true
解释：数组可以分割成 [1, 5, 5] 和 [11] 。
示例 2：

输入：nums = [1,2,3,5]
输出：false
解释：数组不能分割成两个元素和相等的子集。
 

提示：

1 <= nums.length <= 200
1 <= nums[i] <= 100
```

## 题目思路

> 依旧是 0/1 背包问题的模板解法，查看大佬的模板后仅需进行一些改动即可解题，本质上与昨日属于同一类题目。有两种边界情况可以直接排除：数组总和小于目标值，以及数组总和与目标值之差为奇数。

## 题目代码

```cpp
class Solution {
public:
    int findTargetSumWays(vector<int>& nums, int target) {
        int sum = accumulate(nums.begin(), nums.end(), 0);
        if((sum - target) % 2 == 1 || sum < target) return false;

        int n = (sum - target) / 2;
        vector<int> dp(n + 1, 0);
        dp[0] = 1;
        for(int i : nums)
        {
            for (int j = n; j >= i; j--) {
                dp[j] += dp[j - i];
            }
        }
        return dp[n];
    }
};
```

## 复杂度

- 时间复杂度：O(n ^ 2)

- 空间复杂度：O(n)

## 参考文章

https://leetcode-cn.com/problems/partition-equal-subset-sum/solution/yi-pian-wen-zhang-chi-tou-bei-bao-wen-ti-a7dd/
