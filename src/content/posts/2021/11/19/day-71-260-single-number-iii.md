---
title: "Day 71 260. 只出现一次的数字 III"
published: 2021-11-19T15:40:14+08:00
updated: 2021-11-19T15:40:14+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[260. 只出现一次的数字 III](https://leetcode-cn.com/problems/single-number-iii/)**

## 题目

```cpp
给定一个整数数组 nums，其中恰好有两个元素只出现一次，其余所有元素均出现两次。

找出只出现一次的那两个元素。你可以按 任意顺序 返回答案。

进阶：你的算法应该具有线性时间复杂度。你能否仅使用常数空间复杂度来实现？

 

示例 1：

输入：nums = [1,2,1,3,2,5]
输出：[3,5]
解释：[5, 3] 也是有效的答案。
示例 2：

输入：nums = [-1,0]
输出：[-1,0]
示例 3：

输入：nums = [0,1]
输出：[1,0]
提示：

2 <= nums.length <= 3 * 104
-231 <= nums[i] <= 2^31 - 1
除两个只出现一次的整数外，nums 中的其他数字都出现两次
```

## 题目思路

> 因为只有两个数字不重复，看到题目便想到位运算的方法：先将所有数字异或，得到两个目标数字的异或值，再取出该值中任意一个为 1 的二进制位，按此位将数组分成两组分别异或，即可得到这两个数字。

## 题目代码

```cpp
class Solution {
public:
    vector<int> singleNumber(vector<int>& nums) {
        int sum = 0;
        for (int i : nums) sum ^= i;
        int k = -1;
        for(int i = 31; i >= 0 && k == -1; i--) {
            if (((sum >> i) & 1) == 1) k = i;
        }
        vector<int> ans(2);

        for (int i : nums) {
            if (((i >> k) & 1) == 1) ans[1] ^= i;
            else ans[0] ^= i;
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n)

- 空间复杂度：O(1)
