---
title: "Day 47 Number of Operations to Decrement Target to Zero"
published: 2021-10-26T20:04:41+08:00
updated: 2021-10-26T20:04:41+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[Number of Operations to Decrement Target to Zero](https://binarysearch.com/problems/Number-of-Operations-to-Decrement-Target-to-Zero)**

## 题目

```cpp
You are given a list of positive integers nums and an integer target.

Consider an operation where we remove a number v from either the front

or the back of nums and decrement target by v.

Return the minimum number of operations required to decrement target to zero.

If it's not possible, return -1.

Constraints

n ≤ 100,000 where n is the length of nums
Example 1
Input
nums = [3, 1, 1, 2, 5, 1, 1]
target = 7
Output
3
Explanation
We can remove 1, 1 and 5 from the back to decrement target to zero.

Example 2
Input
nums = [2, 4]
target = 7
Output
-1
Explanation
There's no way to decrement target = 7 to zero.
```

## 题目思路

- 滑动窗口题。先遍历数组求总和，若总和恰好等于 target，说明一次操作都不用做。
- 若不相等，则用总和减去 target，得到需要从数组中移除的和。使用双指针滑动窗口寻找和为该值的最大连续子数组：窗口内和大于目标值时，左指针向前滑动；相等时对比之前的长度，记录最大的移动区间。最后用数组长度减去这个长度，就是最少需要的操作次数。

## 题目代码

```cpp
int solve(vector<int>& nums, int target) {
    int n = nums.size();
    int sum;

    for(int i = 0; i < n; i++)
    {
        sum += nums[i];
    }
    if (sum == target) return n;
	sum -= target;

    int l = 0, total = 0, pos = 0;
    for (int r = 0; r < n; r++)
    {
        total += nums[r];
        while(total > sum)
        {
            total -= nums[l++];
        }
        if (total == sum)
        {
            pos = max(pos, r - l + 1);
        }
    }
    return pos > 0 ? n - pos : -1;
}
```

## 复杂度

- 时间复杂度：O(n)

- 空间复杂度：O(1)
