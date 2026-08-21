---
title: "Day 61 416. 分割等和子集"
published: 2021-11-09T20:51:31+08:00
updated: 2021-11-09T20:51:31+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[416. 分割等和子集](https://leetcode-cn.com/problems/partition-equal-subset-sum/)**

## 题目

```cpp
给你一个只包含正整数的非空数组 nums 。

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

> 今天进入 0/1 背包的问题，背包的每个物品只有取与不取两种状态，本题是求能否把数组等分为两个元素和相同的子集。首先数组总和一定是偶数才能等分，所以和为奇数的数组直接舍弃；接下来只需判断是否存在子集和为 sum / 2 即可。

## 题目代码

```cpp
class Solution {
public:
    bool canPartition(vector<int>& nums) {
        int sum = accumulate(nums.begin(), nums.end(), 0);
        if(sum % 2 == 1) return false;
        int target = sum / 2;
        vector<int> dp(target + 1, 0);
        dp[0] = 1;

        for(auto i : nums)
        {
            for(int j = target; j >= i; j--)
            {
                dp[j] = dp[j] || dp[j - i];
            }
        }

        return dp[target];
    }
};
```

## 复杂度

- 时间复杂度：O(n ^ 2)

- 空间复杂度：O(n)

## 参考文章

https://leetcode-cn.com/problems/partition-equal-subset-sum/solution/yi-pian-wen-zhang-chi-tou-bei-bao-wen-ti-a7dd/
