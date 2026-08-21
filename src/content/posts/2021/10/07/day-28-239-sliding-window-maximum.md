---
title: "Day 28 239. 滑动窗口最大值"
published: 2021-10-07T15:18:45+08:00
updated: 2021-10-07T15:18:45+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[239. 滑动窗口最大值](https://leetcode-cn.com/problems/sliding-window-maximum/)**

## 题目

```cpp
给你一个整数数组 nums，有一个大小为 k 的滑动窗口从数组的最左侧移动到数组的最右侧。

你只可以看到在滑动窗口内的 k 个数字。滑动窗口每次只向右移动一位。

返回滑动窗口中的最大值。

 

示例 1：

输入：nums = [1,3,-1,-3,5,3,6,7], k = 3
输出：[3,3,5,5,6,7]
解释：
滑动窗口的位置                最大值
---------------               -----
[1  3  -1] -3  5  3  6  7       3
 1 [3  -1  -3] 5  3  6  7       3
 1  3 [-1  -3  5] 3  6  7       5
 1  3  -1 [-3  5  3] 6  7       5
 1  3  -1  -3 [5  3  6] 7       6
 1  3  -1  -3  5 [3  6  7]      7
示例 2：

输入：nums = [1], k = 1
输出：[1]
示例 3：

输入：nums = [1,-1], k = 1
输出：[1,-1]
示例 4：

输入：nums = [9,11], k = 2
输出：[11]
示例 5：

输入：nums = [4,-2], k = 2
输出：[4]
 

提示：

1 <= nums.length <= 10^5
-10^4 <= nums[i] <= 10^4
1 <= k <= nums.length
```

## 题目思路

- 滑动窗口题目，最多算个中等题。可以用双端队列解决，也可以维护一个 size = k 的最大堆；其中双端队列的时间复杂度为 O(n)，而最大堆为 O(nlogn)；
- 双端队列中维护的是数组 nums 中的下标，便于判断元素是否已经滑出窗口。

## 题目代码

```cpp
class Solution {
public:
    vector<int> maxSlidingWindow(vector<int>& nums, int k) {
        vector<int> ans;
        deque<int> q;
        int n = nums.size();
        if(n == 0) return nums;
        for(int i = 0; i < n; i++)
        {
            //如果队头的元素值满足 i - k 的长度时候，即窗口需要向后滑动，将队头的元素踢除！
            if(!q.empty() && q.front() == i - k) q.pop_front();
            //保证从大到小，如果前面数小则需要依次剔除，直至满足要求
            while(!q.empty() && nums[i] > nums[q.back()]) q.pop_back();
            q.push_back(i);
            if(i >= k - 1) ans.push_back(nums[q.front()]);
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(k)
