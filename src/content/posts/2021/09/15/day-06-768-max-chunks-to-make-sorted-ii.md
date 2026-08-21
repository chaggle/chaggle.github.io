---
title: "Day 6 768. 最多能完成排序的块 II"
published: 2021-09-15T14:22:34+08:00
updated: 2021-09-15T14:22:34+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[768. 最多能完成排序的块 II](https://leetcode-cn.com/problems/max-chunks-to-make-sorted-ii/)**

## 题目

```cpp
这个问题和“最多能完成排序的块”相似，

但给定数组中的元素可以重复，输入数组最大长度为2000，其中的元素最大为10^8。

arr是一个可能包含重复元素的整数数组，我们将这个数组分割成几个“块”，

并将这些块分别进行排序。之后再连接起来，使得连接的结果和按升序排序后的原数组相同。

我们最多能将数组分成多少块？

示例 1:

输入: arr = [5,4,3,2,1]
输出: 1
解释:
将数组分成2块或者更多块，都无法得到所需的结果。
例如，分成 [5, 4], [3, 2, 1] 的结果是 [4, 5, 1, 2, 3]，这不是有序的数组。
示例 2:

输入: arr = [2,1,3,4,4]
输出: 4
解释:
我们可以把它分成两块，例如 [2, 1], [3, 4, 4]。
然而，分成 [2, 1], [3], [4], [4] 可以得到最多的块数。
注意:

arr的长度在[1, 2000]之间。
arr[i]的大小在[0, 10**8]之间。
```

## 题目思路

- 分块排序后再连接起来，结果需要与原数组升序排序后的结果相同；
- 可以采用动态规划的思想：前一个块的最大值要小于下一个块的最小值，这样分块排序合并之后就会与原数组升序排序的结果一致。

## 题目代码

### 代码块

```cpp
class Solution {
public:
    int maxChunksToSorted(vector<int>& arr) {
        /* 虽然能通过但是时间复杂度太高，两者比较与清空操作要花费较多的时间开销
           解法并不优秀。
        int n = arr.size();
        vector<int> nums(arr);
        sort(nums.begin(), nums.end());
        unordered_map<int, int> h1, h2;
        int ans = 0;
        for (int i = 0; i < n; i++)
        {
            ++h1[arr[i]];
            ++h2[nums[i]];
            if(h1 == h2)
            {
                ans++;
                h1.clear();
                h2.clear();
            }
        }
        return ans;*/
        //此解法就极大缩短了时间，只需要寻找左边最大值小于右边最小值的区域即可
        int n = arr.size();
        vector<int> l(n, 0);
        vector<int> r(n, 10^8);
        l[0] = arr[0];
        r[n - 1] = arr[n - 1];
        for(int i = 1; i < n; i++)
        {
            //动态规划
            l[i] = max(l[i - 1], arr[i]);
            r[n - 1 - i] = min(r[n - i], arr[n - 1 - i]);
        }
        int res = 1;
        for(int i = 0; i < n - 1; i++)
        {
            int ans = l[i] <= r[i + 1] ? 1 : 0;
            res += ans;
        }
        return res;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(2n)，两个数组开辟 2n 的空间。
