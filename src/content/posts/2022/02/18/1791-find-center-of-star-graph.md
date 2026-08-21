---
title: "1791. 找出星型图的中心节点"
published: 2022-02-18T23:02:49+08:00
updated: 2022-02-18T23:02:49+08:00
tags: ["leetcode"]
category: "leetcode"
---

# [1791. 找出星型图的中心节点](https://leetcode-cn.com/problems/find-center-of-star-graph/)

## 题目

```cpp
有一个无向的 星型 图，由 n 个编号从 1 到 n 的节点组成。星型图有一个 中心 节点，并且恰有 n - 1 条边将中心节点与其他每个节点连接起来。

给你一个二维整数数组 edges ，其中 edges[i] = [ui, vi] 表示在节点 ui 和 vi 之间存在一条边。请你找出并返回 edges 所表示星型图的中心节点。

示例 1：

输入：edges = [[1,2],[2,3],[4,2]]
输出：2
解释：如上图所示，节点 2 与其他每个节点都相连，所以节点 2 是中心节点。
示例 2：

输入：edges = [[1,2],[5,1],[1,3],[1,4]]
输出：1

提示：

3 <= n <= 105
edges.length == n - 1
edges[i].length == 2
1 <= ui, vi <= n
ui != vi
题目数据给出的 edges 表示一个有效的星型图
```

## 题目思路

> 方法一：使用计数排序的思路，可以用 map 实现，也能用结构体，遍历一遍后取出现次数最多的节点即可。
>
> 方法二：利用星型图的性质——所有其他节点都只与中心节点连接，所以只需要判断前两条边中的两个节点即可。

## 题目代码

```go
func findCenter(edges [][]int) int {
    /*
    方法 1：遍历二维数组，时间复杂度O(n ^ 2)
    n, m := len(edges), len(edges[0])
    hash := map[int]int{}
    for i := 0; i < n; i++ {
        for j := 0; j < m; j++ {
            hash[edges[i][j]]++
        }
    }
    p := hash[0]
    q := 0
    for i, v := range hash {
        if v > p {
            p = v
            q = i
        }
    }
    return q */

    //方法二 ：由于是星型线，所以每个子数组两个值必有一个值相等
    if edges[0][0] == edges[1][0] || edges[0][0] == edges[1][1]{
        return edges[0][0]
    }
    return edges[0][1]
}
```

## 复杂度

- 时间复杂度：O(n ^ 2) / O(1)
- 空间复杂度：O(n) / O(1)
