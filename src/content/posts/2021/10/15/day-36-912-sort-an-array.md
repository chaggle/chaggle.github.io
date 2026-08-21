---
title: "Day 36 912. 排序数组"
published: 2021-10-15T20:25:16+08:00
updated: 2021-10-15T20:25:16+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[912. 排序数组](https://leetcode-cn.com/problems/sort-an-array/)**

## 题目

```cpp
给你一个整数数组 nums，请你将该数组升序排列。

 

示例 1：

输入：nums = [5,2,3,1]
输出：[1,2,3,5]
示例 2：

输入：nums = [5,1,1,2,0,0]
输出：[0,0,1,1,2,5]
 

提示：

1 <= nums.length <= 50000
-50000 <= nums[i] <= 50000
```

## 题目思路

- 最简单的写法是直接调用库函数，但这样显然没有任何意义，所以这里把各类排序算法都复现了一遍，顺便练习一下，防止考研过程中遇到相应的问题。

## 题目代码

```cpp
class Solution {
public:
    vector<int> sortArray(vector<int>& nums) {
        //sort(nums.begin(), nums.end());
        //return nums;
        int n = nums.size();

        //冒泡排序 超时
        /* for(int i = 0; i < n; i++)
        {
            bool flag = false;
            for(int j = n - 2; j >= i; j--)
            {
                if(nums[j] > nums[j + 1])
                {
                    swap(nums[j], nums[j + 1]);
                    flag = true;
                }
            }
            if(flag == false)break;
        } */

        //插入排序 超时
        /* for(int i = 0; i < n - 1; i++)
        {
            int min = i;
            for(int j = i + 1; j < n; j++)
            {
                if(nums[min] > nums[j]) min = j;
            }
            if(min != i) swap(nums[i], nums[min]);
        } */

        //快排 失败
        /* dfs(0, n - 1, nums); */

        //堆排序
        /* for(int i = 0; i < n; i++)
        {
            int pos = i;
            int mid = (pos - 1)/2;
            while(nums[pos] > nums[mid])
            {
                swap(nums[pos], nums[mid]);
                pos = mid;
                mid = (pos - 1) / 2;
            }
        }
        for(int j = n - 1; j >= 0; j--)
        {
            swap(nums[0], nums[j]);
            heapsort(nums,0,j);
        } */

        //计数排序
        int minn = *min_element(nums.begin(), nums.end());
        int maxn = *max_element(nums.begin(), nums.end());
        vector<int> ans(maxn - minn + 1);
        for(auto i : nums)
        {
            ans[i - minn]++;
        }
        int j = 0, i = 0;
        while(i < ans.size())
        {
            while(ans[i] > 0)
            {
                nums[j++] = i + minn;
                ans[i]--;
            }
            i++;
        }
        return nums;
    }

    /* void dfs(int start, int end, vector<int>& nums) {
        if(start > end) return;
        int i = start, j = end;
        while(i < j)
        {
            while(nums[j] >= nums[start] && i < j) j--;
            while(nums[i] <= nums[start] && i < j) i++;
            if(i < j) swap(nums[i], nums[j]);
        }
        swap(nums[start], nums[i]);
        dfs(start, i - 1, nums);
        dfs(i + 1, end, nums);
    } */

   /*  void heapsort(vector<int>& nums, int pos, int n)
    {
        int l = pos * 2 + 1, r = pos * 2 + 2;
        while(l < n)
        {
            int big = pos;
            if(l < n && nums[l] > nums[big]) big = l;
            if(r < n && nums[r] > nums[big]) big = r;
            if(big == pos) break;
            swap(nums[pos], nums[big]);
            pos = big;
            l = pos * 2 + 1, r = pos * 2 + 2;
        }
    } */
};
```

## 复杂度

- 时间复杂度：O(nlogn) 堆排序；O(n) 计数排序

- 空间复杂度：O(1) 堆排序；O(n) 计数排序
