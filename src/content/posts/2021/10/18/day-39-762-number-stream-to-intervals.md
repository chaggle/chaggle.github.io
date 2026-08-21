---
title: "Day 39 762.Number Stream to Intervals"
published: 2021-10-18T16:30:01+08:00
updated: 2021-10-18T16:30:01+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[762.Number Stream to Intervals](https://binarysearch.com/problems/Triple-Inversion)**

## 题目

```cpp
Given a list of integers nums,

return the number of pairs i < j such that nums[i] > nums[j] * 3.

Constraints

n ≤ 100,000 where n is the length of nums
Example 1
Input
nums = [7, 1, 2]
Output
2
Explanation
We have the pairs (7, 1) and (7, 2)
```

## 题目思路

- 构造逆序对，然后返回逆序对的数量。使用归并排序比二分法更合适，在归并的过程中统计每个子区间里大于当前 nums[q] * 3 的元素个数。

## 题目代码

```cpp
class Solution {
public:
    void merge(vector<int> &nums, int i, int mid, int j)
    {

        vector<int> ans(j - i + 1);
        int l = i, r = mid + 1;
        int cnt = 0;

        while(l <= mid && r <= j)
        {
            if(nums[l] <= nums[r])
            {
                ans[cnt] = nums[l];
                l++;
            }
            else
            {
                ans[cnt] = nums[r];
                r++;
            }
            cnt++;
        }

        while(l <= mid) ans[cnt++] = nums[l++];
        while(r <= j) ans[cnt++] = nums[r++];

        cnt = 0;
        while(i <= j) nums[i++] = ans[cnt++];
    }

    int mergeSort(vector<int> &nums, int l, int r)
    {
        if(r <= l) return 0;
        int ans = 0;
        int mid = (l + r) / 2;
        ans += mergeSort(nums, l, mid);
        ans += mergeSort(nums, mid + 1, r);

        int p = l;
        int q = mid + 1;
        while(p <= mid && q <= r)
        {
            if(nums[p] > nums[q] * 3)
            {
                ans += (mid - p + 1);
                q++;
            }
            else p++;
        }
        merge(nums, l, mid, r);
        return ans;
    }

    int solve(vector<int> &nums)
    {
        int ans = mergeSort(nums, 0, nums.size() - 1);
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(nlogn)

- 空间复杂度：O(n)
