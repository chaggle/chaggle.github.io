---
title: "Day 67 881. 救生艇"
published: 2021-11-15T11:45:01+08:00
updated: 2021-11-15T11:45:01+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[881. 救生艇](https://leetcode-cn.com/problems/boats-to-save-people/)**

## 题目

```cpp
第 i 个人的体重为 people[i]，每艘船可以承载的最大重量为 limit。

每艘船最多可同时载两人，但条件是这些人的重量之和最多为 limit。

返回载到每一个人所需的最小船数。(保证每个人都能被船载)。

 

示例 1：

输入：people = [1,2], limit = 3
输出：1
解释：1 艘船载 (1, 2)
示例 2：

输入：people = [3,2,2,1], limit = 3
输出：3
解释：3 艘船分别载 (1, 2), (2) 和 (3)
示例 3：

输入：people = [3,5,3,4], limit = 5
输出：4
解释：4 艘船分别载 (3), (3), (4), (5)
提示：

1 <= people.length <= 50000
1 <= people[i] <= limit <= 30000
```

## 题目思路

> 贪心法加双指针，双指针的思考方式与快排一致：排序后从两端向中间配对，最重的人尽量与最轻的人同船，从而得到所需的最小船数。

## 题目代码

```cpp
class Solution {
public:
    int numRescueBoats(vector<int>& people, int limit) {
        int ans = 0;
        sort(people.begin(), people.end());
        int l= 0, r = people.size() - 1;
        while(l <= r)
        {
            if (people[l] + people[r] > limit) r--;
            else
            {
                l++;r--;
            }
            ans++;
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(logn)

- 空间复杂度：O(1)
