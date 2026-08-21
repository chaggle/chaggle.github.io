---
title: "Day 81 40. 组合总和 II"
published: 2021-11-29T17:31:37+08:00
updated: 2021-11-29T17:31:37+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[40. 组合总和 II](https://leetcode-cn.com/problems/combination-sum-ii/)**

## 题目

```cpp
给定一个数组 candidates 和一个目标数 target 

找出 candidates 中所有可以使数字和为 target 的组合。

candidates 中的每个数字在每个组合中只能使用一次。

注意：解集不能包含重复的组合。 

 

示例 1:

输入: candidates = [10,1,2,7,6,1,5], target = 8,
输出:
[
[1,1,6],
[1,2,5],
[1,7],
[2,6]
]
示例 2:

输入: candidates = [2,5,2,1,2], target = 5,
输出:
[
[1,2,2],
[5]
]
 

提示:

1 <= candidates.length <= 100
1 <= candidates[i] <= 50
1 <= target <= 30
```

## 题目思路

> 与昨日一样的回溯法。官方题解可以使用 pair 存储，但其实与缓存过程中的数据类型 vector<int> 是一样的。由于每个元素只能使用一次且解集不能包含重复组合，先对数组排序，在同一层递归中跳过重复元素即可去重。

## 题目代码

```cpp
class Solution {
private:
    vector<int> res;
    vector<vector<int>> ans;
    vector<int> tmp;
public:
    void dfs(int start, int target) {
        int n = res.size();
        if(target == 0) {
            ans.push_back(tmp);
            return;
        }

        for(int i = start; i < n && target - res[i] >= 0; i++) {
            if(i > start && res[i] == res[i - 1]) continue;
            tmp.push_back(res[i]);
            dfs(i + 1, target - res[i]);
            tmp.pop_back();
        }
    }

    vector<vector<int>> combinationSum2(vector<int> &candidates, int target) {
        sort(candidates.begin(), candidates.end());
        this -> res = candidates;
        dfs(0, target);
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O($2 ^ n * n$)
- 空间复杂度：O($n$)
