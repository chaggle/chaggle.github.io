---
title: "Day 90 1054. 距离相等的条形码"
published: 2021-12-08T15:28:10+08:00
updated: 2021-12-08T15:28:10+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1054. 距离相等的条形码](https://leetcode-cn.com/problems/distant-barcodes/)**

## 题目

```cpp
在一个仓库里，有一排条形码，其中第 i 个条形码为 barcodes[i]。

请你重新排列这些条形码，使其中两个相邻的条形码 不能相等。

你可以返回任何满足该要求的答案，此题保证存在答案。

 

示例 1：

输入：[1,1,1,2,2,2]
输出：[2,1,2,1,2,1]
示例 2：

输入：[1,1,1,1,2,2,3,3]
输出：[1,3,1,3,2,1,2,1]
 

提示：

1 <= barcodes.length <= 10000
1 <= barcodes[i] <= 10000
```

## 题目思路

> 统计每个条形码的出现次数并按次数降序排序，然后进行间隔插入：先填满偶数下标，再回填奇数下标，从而保证相邻的条形码不相等。这是最后两日了，明天打卡 91 日后就要考试了，所以停止更新。直到 12 月 30 日开始，从头复盘这 91 天，每日复盘 4 题左右，顺便开始阅读相应的论文，展开研究型的工作。

## 题目代码

```cpp
class Solution {
public:
    vector<int> rearrangeBarcodes(vector<int>& barcodes) {
        int n = barcodes.size();
        unordered_map<int, int> up;
        for(int i : barcodes) up[i]++;
        vector<pair<int,int>> ans;
        for(auto [x, fx] : up) ans.push_back(pair<int, int>{x, fx});

        sort(ans.begin(), ans.end(),
        [&](const pair<int, int> &a, const pair<int, int> &b)
        {
            return a.second > b.second;
        });

        vector<int> res(n);
        int m = 0;
        for(auto [x, fx] : ans)
        {
            for (int i = 0 ; i < fx; i++)
            {
                if (m >= n) m = 1;
                res[m] = x;
                m += 2;
            }
        }
        return res;
    }
};
```

## 复杂度

- 时间复杂度：O(nlogn)
- 空间复杂度：O(n)
