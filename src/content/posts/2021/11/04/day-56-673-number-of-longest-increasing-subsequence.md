---
title: "Day 56 673. 最长递增子序列的个数"
published: 2021-11-04T16:38:52+08:00
updated: 2021-11-04T16:38:52+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[673. 最长递增子序列的个数](https://leetcode-cn.com/problems/number-of-longest-increasing-subsequence/)**

## 题目

```cpp
给定一个未排序的整数数组，找到最长递增子序列的个数。

示例 1:

输入: [1,3,5,4,7]
输出: 2
解释: 有两个最长递增子序列，分别是 [1, 3, 4, 7] 和[1, 3, 5, 7]。
示例 2:

输入: [2,2,2,2,2]
输出: 5
解释: 最长递增子序列的长度是1，并且存在5个子序列的长度为1，因此输出5。
注意: 给定的数组长度不超过 2000 并且结果一定是32位有符号整数
```

## 题目思路

- 本题思考有两个难点：一是找出最长的递增子序列，二是统计能够达到该长度的子序列个数。
- 还有一种树状数组的做法，留待日后学习，现在一时消化不了，目前使用的方法有些麻烦。
- 使用两个数组，一个记录最长子序列的长度，一个记录对应的个数，全部初始化为 1，因为每个元素都可以独立看作一个长度为 1 的子序列。然后对区间 [0, i) 内的所有元素遍历一次，对于每个 nums[j] < nums[i]，说明 nums[i] 可以接在 nums[j] 后面形成上升子序列，据此更新 len[i] 的长度与 mlen[i] 的个数。len[i] 表示以 i 结尾时能取得的最大长度，mlen[i] 表示在该长度下的子序列个数，同时用 maxlen 记录整个数组中的最大长度。
- 最后把所有 len[i] 等于 maxlen 的位置对应的 mlen[i] 相加，即可得到答案。整个过程比较复杂，第一条可能难以看明白。

## 题目代码

```cpp
class Solution {
public:
    int findNumberOfLIS(vector<int>& nums) {
        int n = nums.size();
        vector<int> len(n, 1), mlen(n, 1);
        int maxlen = 1;
        for(int i = 0; i < n; i++)
        {
            for(int j = 0; j < i; j++)
            {
                if(nums[j] < nums[i])
                {
                    if(len[i] < len[j] + 1)
                    {
                        len[i] = len[j] + 1;
                        mlen[i] = mlen[j];
                    }
                    else if(len[i] == len[j] + 1) mlen[i] += mlen[j];
                }
            }
            maxlen = max(maxlen, len[i]);
        }
        int ans = 0;
        for(int i = 0; i < n; i++)
        {
            if(len[i] == maxlen) ans += mlen[i];
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n ^ 2)

- 空间复杂度：O(n)
