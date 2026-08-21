---
title: "Day 30 886. 可能的二分法"
published: 2021-10-09T15:36:22+08:00
updated: 2021-10-09T15:36:22+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[886. 可能的二分法](https://leetcode-cn.com/problems/possible-bipartition/)**

## 题目

```cpp
给定一组 N 人（编号为 1, 2, ..., N）， 我们想把每个人分进任意大小的两组。

每个人都可能不喜欢其他人，那么他们不应该属于同一组。

形式上，如果 dislikes[i] = [a, b]，表示不允许将编号为 a 和 b 的人归入同一组。

当可以用这种方法将所有人分进两组时，返回 true；否则返回 false。

 

示例 1：

输入：N = 4, dislikes = [[1,2],[1,3],[2,4]]
输出：true
解释：group1 [1,4], group2 [2,3]
示例 2：

输入：N = 3, dislikes = [[1,2],[1,3],[2,3]]
输出：false
示例 3：

输入：N = 5, dislikes = [[1,2],[2,3],[3,4],[4,5],[1,5]]
输出：false
 

提示：

1 <= N <= 2000
0 <= dislikes.length <= 10000
dislikes[i].length == 2
1 <= dislikes[i][j] <= N
dislikes[i][0] < dislikes[i][1]
对于 dislikes[i] == dislikes[j] 不存在 i != j
```

## 题目思路

- 经典并查集题目。

## 题目代码

```cpp
class UnionFound {
public:
    vector<int> F;

    UnionFound(int n)
    {
        F = vector<int>(n, 0);
        for (int i = 0; i < n; i++)
        {
            F[i] = i;
        }
    }

    int Find(int x)
    {
        if (x == F[x]) return x;
        return F[x] = Find(F[x]);
    }

    void Union(int x, int y)
    {
        x = Find(x);
        y = Find(y);

        if (x != y) F[x] = y;
    }
};

class Solution {
public:
    bool possibleBipartition(int n, vector<vector<int> > &dislikes)
    {
        unordered_map<int, vector<int> > mp;

        for (int i = 0; i < dislikes.size(); i++) {
            mp[dislikes[i][0] - 1].push_back(dislikes[i][1] - 1);
            mp[dislikes[i][1] - 1].push_back(dislikes[i][0] - 1);
        }

        UnionFound uf(n);
        for (int i = 0; i < n; i++) {
            auto vec = mp[i];

            for (auto c : vec) {
                if (uf.Find(i) == uf.Find(c)) {
                    return false;
                }
                uf.Union(vec[0], c);
            }
        }
        return true;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
