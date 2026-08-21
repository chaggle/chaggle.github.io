---
title: "Day 86 1046. 最后一块石头的重量"
published: 2021-12-04T17:42:18+08:00
updated: 2021-12-04T17:42:18+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1046. 最后一块石头的重量](https://leetcode-cn.com/problems/last-stone-weight/)**

## 题目

```cpp
有一堆石头，每块石头的重量都是正整数。

每一回合，从中选出两块 最重的 石头，然后将它们一起粉碎。

假设石头的重量分别为 x 和 y，且 x <= y。那么粉碎的可能结果如下：

如果 x == y，那么两块石头都会被完全粉碎；

如果 x != y，那么重量为 x 的石头将会完全粉碎，而重量为 y 的石头新重量为 y-x。

最后，最多只会剩下一块石头。

返回此石头的重量。如果没有石头剩下，就返回 0。

 

示例：

输入：[2,7,4,1,8,1]
输出：1
解释：
先选出 7 和 8，得到 1，所以数组转换为 [2,4,1,1,1]，
再选出 2 和 4，得到 2，所以数组转换为 [2,1,1,1]，
接着是 2 和 1，得到 1，所以数组转换为 [1,1,1]，
最后选出 1 和 1，得到 0，最终数组转换为 [1]，这就是最后剩下那块石头的重量。
 

提示：

1 <= stones.length <= 30
1 <= stones[i] <= 1000
```

## 题目思路

> 今日仍使用最大堆的办法，拒绝使用库函数自己手写：每次取出最重的两块石头，相等则全部粉碎，不等则把差值放回堆中，直到只剩一块或没有石头。

## 题目代码

```cpp
class Solution {
public:
    void buildmaxheap(vector<int>& stones, int i, int n) {
        int p = stones[i];
        for (int j = 2 * i + 1; j < n; j = 2 * j + 1)
        {
            if (j < n - 1 && stones[j] < stones[j + 1]) j++;
            if (p >= stones[j]) break;
            else
            {
                stones[i] = stones[j];
                i = j;
            }
        }
        stones[i] = p;
    }

    int lastStoneWeight(vector<int>& stones) {
        int max1, max2;
        int n = stones.size();
        for (int i = (n - 1) / 2; i >= 0; i--) buildmaxheap(stones, i, n);
        while (n > 1)
        {
            max1 = stones[0];
            stones[0] = stones[--n];
            buildmaxheap(stones, 0, n);
            max2 = stones[0];
            if (max1 == max2)
            {
                if(n < 2) return 0;
                else stones[0] = stones[--n];
            }
            else stones[0] = abs(max1 - max2);
            buildmaxheap(stones, 0, n);
        }
        return stones[0];
    }
};

```

## 复杂度

- 时间复杂度：O(nlogn)
- 空间复杂度：O(n)
