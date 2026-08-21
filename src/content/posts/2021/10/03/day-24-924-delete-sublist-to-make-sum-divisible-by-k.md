---
title: "Day 24 924. 删除子列表以使总和可被 K 整除"
published: 2021-10-03T16:23:38+08:00
updated: 2021-10-03T16:23:38+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[924. 删除子列表以使总和可被 K 整除](https://binarysearch.com/problems/Delete-Sublist-to-Make-Sum-Divisible-By-K)**

## 题目

```cpp
You are given a list of positive integers nums

and a positive integer k.

Return the length of the shortest sublist (can be empty sublist )

you can delete such that the resulting list's sum is divisible by k.

 You cannot delete the entire list.

If it's not possible, return -1.

Constraints

1 ≤ n ≤ 100,000 where n is the length of nums
Example 1
Input
nums = [1, 8, 6, 4, 5]
k = 7
Output
2
Explanation
We can remove the sublist [6, 4] to get [1, 8, 5]

which sums to 14 and is divisible by 7.
```

## 题目思路

- 本题用到数学中的同余定理以及前缀和的思路。

## 题目代码

```cpp
class Solution {
public:
    int solve(vector<int>& nums, int k) {
        int sum = 0;
        for(auto i : nums)
        {
            sum += i;
        }
        sum = sum % k;
        map<int, int> up;
        up[0] = -1;
        int pre = 0, n = nums.size();
        int ans = nums.size();
        for (int i = 0; i < n; i++)
        {
            pre += nums[i];
            int re = pre % k;
            up[re] = i;
            int x = pre - sum;
            int m = ((x % k) + k) % k;
            if (up.count(m)) ans = min(ans, i - up[m]);
        }
        return ans == nums.size() ? -1 : ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
