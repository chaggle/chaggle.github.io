---
title: "Day 89 378. 有序矩阵中第 K 小的元素"
published: 2021-12-07T08:38:44+08:00
updated: 2021-12-07T08:38:44+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[378. 有序矩阵中第 K 小的元素](https://leetcode-cn.com/problems/kth-smallest-element-in-a-sorted-matrix/)**

## 题目

```cpp
给你一个 n x n 矩阵 matrix ，其中每行和每列元素均按升序排序，找到矩阵中第 k 小的元素。
请注意，它是 排序后 的第 k 小元素，而不是第 k 个 不同 的元素。

 

示例 1：

输入：matrix = [[1,5,9],[10,11,13],[12,13,15]], k = 8
输出：13
解释：矩阵中的元素为 [1,5,9,10,11,12,13,13,15]，第 8 小元素是 13
示例 2：

输入：matrix = [[-5]], k = 1
输出：-5
 

提示：

n == matrix.length
n == matrix[i].length
1 <= n <= 300
-109 <= matrix[i][j] <= 109
题目数据 保证 matrix 中的所有行和列都按 非递减顺序 排列
1 <= k <= n^2
```

## 题目思路

> 题目中最合适的办法理应是二分的思路：对值域进行二分，check 函数利用矩阵每行每列均有序的特性，从矩阵左下角出发统计小于等于 mid 的元素个数，据此收缩范围，最终得到第 k 小的元素。

## 题目代码

```cpp
class Solution {
public:
    bool check(vector<vector<int>>& matrix, int mid, int k, int n) {
        int i = n - 1, j = 0, num = 0;
        while (i >= 0 && j < n)
        {
            if (matrix[i][j] <= mid)
            {
                num += i + 1;
                j++;
            } else i--;
        }
        return num >= k;
    }

    int kthSmallest(vector<vector<int>>& matrix, int k) {
        int n = matrix.size();
        int l = matrix[0][0], r = matrix[n - 1][n - 1];
        while(l < r)
        {
            int mid = l + ((r - l) >> 1);
            if (check(matrix, mid, k, n)) r = mid;
            else l = mid + 1;
        }
        return l;
    }
};
```

## 复杂度

- 时间复杂度：O(nlogn)
- 空间复杂度：O(1)
