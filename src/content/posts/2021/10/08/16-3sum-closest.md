---
title: "16. 最接近的三数之和"
published: 2021-10-08T15:47:55+08:00
updated: 2021-10-08T15:47:55+08:00
tags: ["leetcode"]
category: "leetcode"
---

# [16. 最接近的三数之和](https://leetcode-cn.com/problems/3sum-closest/)

## 题目

```go
给你一个长度为 n 的整数数组 nums 和 一个目标值 target。

请你从 nums 中选出三个整数，使它们的和与 target 最接近。

返回这三个数的和。

假定每组输入只存在恰好一个解。

示例 1：

输入：nums = [-1,2,1,-4], target = 1
输出：2
解释：与 target 最接近的和是 2 (-1 + 2 + 1 = 2) 。
示例 2：

输入：nums = [0,0,0], target = 1
输出：0

提示：

3 <= nums.length <= 1000
-1000 <= nums[i] <= 1000
-104 <= target <= 104
```

## 题目思路

> 本题与两数之和、三数之和一样，都是双指针解法。首先对数组进行排序，然后确定第一个点，之后开始用双指针遍历数组前后的每一个值。由于是找最接近的数，所以如果三数之和 sum 等于 target，直接返回该值即可；如果 sum 大于目标值，则让右端点 r--，反之让左端点 l++。
>
> 另外，如果在 i > 0 的情况下 nums[i] 与 nums[i-1] 的值相等，那么之后遍历得到的三数之和情况也相等，所以在只需要返回唯一合适值的情况下，可以直接使用 continue 跳过本轮循环进行优化。

## 题目代码

```go
func threeSumClosest(nums []int, target int) int {
    n := len(nums)

    if n == 3 {
        return nums[0] + nums[1] + nums[2]
    }

    sort.Ints(nums)
    min := math.MaxInt32

    update := func (sum int) {
        if abs(min - target) > abs(sum - target) {
            min = sum
        }
    }

    for i := 0; i < n - 2; i++ {

        if i > 0 && nums[i] == nums[i - 1] {
            continue
        }

        l, r := i + 1, n - 1

        for l < r {
            sum := nums[i] + nums[l] + nums[r]

            update(sum)

            if sum == target {
                return sum
            } else if sum > target {
                r--
            } else if sum < target {
                l++
            }
        }
    }

    return min
}


func abs(x int) int {
    if x < 0 {
        x = -x
    }

    return x
}
```

## 复杂度

- 时间复杂度：O(n^2)
- 空间复杂度：O(nlogn)
