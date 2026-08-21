---
title: "1984. 学生分数的最小差值"
published: 2022-02-11T10:42:01+08:00
updated: 2022-02-11T10:42:01+08:00
tags: ["leetcode"]
category: "leetcode"
---

# [1984. 学生分数的最小差值](https://leetcode-cn.com/problems/minimum-difference-between-highest-and-lowest-of-k-scores/)

## 题目

```go
给你一个 下标从 0 开始 的整数数组 nums ，其中 nums[i] 表示第 i 名学生的分数。另给你一个整数 k 。

从数组中选出任意 k 名学生的分数，使这 k 个分数间 最高分 和 最低分 的 差值 达到 最小化 。

返回可能的 最小差值 。

示例 1：

输入：nums = [90], k = 1
输出：0
解释：选出 1 名学生的分数，仅有 1 种方法：
- [90] 最高分和最低分之间的差值是 90 - 90 = 0
可能的最小差值是 0
示例 2：

输入：nums = [9,4,1,7], k = 2
输出：2
解释：选出 2 名学生的分数，有 6 种方法：
- [9,4,1,7] 最高分和最低分之间的差值是 9 - 4 = 5
- [9,4,1,7] 最高分和最低分之间的差值是 9 - 1 = 8
- [9,4,1,7] 最高分和最低分之间的差值是 9 - 7 = 2
- [9,4,1,7] 最高分和最低分之间的差值是 4 - 1 = 3
- [9,4,1,7] 最高分和最低分之间的差值是 7 - 4 = 3
- [9,4,1,7] 最高分和最低分之间的差值是 7 - 1 = 6
可能的最小差值是 2

提示：

1 <= k <= nums.length <= 1000
0 <= nums[i] <= 10^5
```

## 题目思路

> 最简单的方法就是排序之后使用滑动窗口。要找最小差值，两个数需要处于排序之后居中的位置，所以排序后用固定长度为 k 的窗口从左到右滑动一遍，取窗口内最大值与最小值之差的最小值即可。

## 题目代码

```go
func minimumDifference(nums []int, k int) int {
    sort.Ints(nums) //go sort
    ans := math.MaxInt32
    for i, num := range nums[:len(nums) - k + 1] {
        ans = min(ans, nums[i + k - 1] - num)
    }
    return ans
}

func min(a, b int) int {
    if a > b {
        return b
    }
    return a
}
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
