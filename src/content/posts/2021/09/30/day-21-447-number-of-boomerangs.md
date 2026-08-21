---
title: "Day 21 447. 回旋镖的数量"
published: 2021-09-30T14:12:26+08:00
updated: 2021-09-30T14:12:26+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[447. 回旋镖的数量](https://leetcode-cn.com/problems/number-of-boomerangs/)**

## 题目

```cpp
给定平面上 n 对 互不相同 的点 points ，其中 points[i] = [xi, yi] 。

回旋镖 是由点 (i, j, k) 表示的元组 ，

其中 i 和 j 之间的距离和 i 和 k 之间的欧式距离相等（需要考虑元组的顺序）。

返回平面上所有回旋镖的数量。

示例 1：

输入：points = [[0,0],[1,0],[2,0]]
输出：2
解释：两个回旋镖为 [[1,0],[0,0],[2,0]] 和 [[1,0],[2,0],[0,0]]

示例 2：

输入：points = [[1,1],[2,2],[3,3]]
输出：2

示例 3：

输入：points = [[1,1]]
输出：0
 

提示：

n == points.length
1 <= n <= 500
points[i].length == 2
-10^4 <= xi, yi <= 10^4
所有点都 互不相同
```

## 题目思路

- 本题翻译成人话就是：求二维平面上所给的点中，能组成等腰三角形两条腰边的三个顶点共有多少组，返回其总数；
- 使用 unordered_map 处理：在确定 i 作为三元组第一个点的回旋镖个数之前，先计算 i 与其余点的距离，以 {距离 : 个数} 的形式存储，最后分别对所有的距离进行累加计数。

## 题目代码

### 代码块

```cpp
class Solution {
public:
    int numberOfBoomerangs(vector<vector<int>>& p) {
        int n = p.size();
        int ans = 0;
        for(int i = 0; i < n; i++)
        {
            unordered_map<int, int> up;
            for(int j = 0; j < n; j++)
            {
                if(i == j) continue;
                int x = p[i][0] - p[j][0];
                int y = p[i][1] - p[j][1];
                int d = x * x + y *y;
                ++up[d];
            }
            for(auto [d, cnt] : up)
            {
                ans += cnt * (cnt - 1);
            }
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O($n^2$)
- 空间复杂度：O($n$)
