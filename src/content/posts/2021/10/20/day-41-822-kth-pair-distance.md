---
title: "Day 41 822. Kth-Pair-Distance"
published: 2021-10-20T20:22:16+08:00
updated: 2021-10-20T20:22:16+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[822. Kth-Pair-Distance](https://binarysearch.com/problems/Kth-Pair-Distance)**

## 题目

```cpp
Given a list of integers nums and an integer k,

return the k-th smallest abs(x - y) for every pair of elements (x, y) in nums.

Note that (x, y) and (y, x) are considered the same pair.

Constraints

n ≤ 100,000 where n is the length of nums
Example 1
Input
nums = [1, 5, 3, 2]
k = 3
Output
2
Explanation
Here are all the pair distances:

abs(1 - 5) = 4
abs(1 - 3) = 2
abs(1 - 2) = 1
abs(5 - 3) = 2
abs(5 - 2) = 3
abs(3 - 2) = 1
Sorted in ascending order we have [1, 1, 2, 2, 3, 4].
```

## 题目思路

- 题目求的是数组中第 k 小的数对距离。先将数组排序，最大的距离就是数组首尾元素之差，最小的距离当然为 0，在这个范围内二分查找一个合理的值即可。
- 使用二分法，每次取 mid = l + (r - l) / 2，可以降低查找的时间复杂度；如果直接计数枚举所有数对，时间复杂度会达到 O(n^2)。
- 本题也可以从数学的角度考虑：所有距离对一共有 $n(n-1)$ 个，只要大于 mid 的距离对数有 $n(n-1)$ - k 个，即为不合理。（还有些地方没想明白，先放着。）

## 题目代码

```cpp
class Solution {
public:
    bool isvaild(vector<int>& nums, int dis, int k)
    {
        int n = nums.size();
        long long int count = 0;
        int i = 0, j = 0;
        while (i < n || j < n)
        {
            while (j < n && nums[j] - nums[i] <= dis) j++;
            count += j - i - 1;
            i++;
        }
        return count >= k;
    };

    int solve(vector<int>& nums, int k) {
        int n = nums.size();
        k++;
        sort(nums.begin(), nums.end());
        int l = 0, r = nums[n - 1] - nums[0];
        while(l < r)
        {
            int mid = l + (r - l) / 2;
            int count = 0, left = 0;
            if(isvaild(nums, mid, k)) r = mid;
            else l = mid + 1;
        }
        return l;
}
```

## 复杂度

- 时间复杂度：O(nlogn)

- 空间复杂度：O(1)
