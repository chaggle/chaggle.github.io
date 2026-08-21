---
title: "Day 75 面试题 17.17. 多次搜索"
published: 2021-11-23T19:59:12+08:00
updated: 2021-11-23T19:59:12+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[面试题 17.17. 多次搜索](https://leetcode-cn.com/problems/multi-search-lcci/)**

## 题目

```cpp
给定一个较长字符串big和一个包含较短字符串的数组smalls，

设计一个方法，根据smalls中的每一个较短字符串，对big进行搜索。

输出smalls中的字符串在big里出现的所有位置positions，

其中positions[i]为smalls[i]出现的所有位置。

示例：

输入：
big = "mississippi"
smalls = ["is","ppi","hi","sis","i","ssippi"]
输出： [[1,4],[8],[],[3],[1,4,7,10],[5]]
提示：

0 <= len(big) <= 1000
0 <= len(smalls[i]) <= 1000
smalls的总字符数不会超过 100000。
你可以认为smalls中没有重复字符串。
所有出现的字符均为英文小写字母。
```

## 题目思路

> Trie 树的经典方法，明年 1 月份再到博客进行一次复盘，讲述一步一步的思路。

## 题目代码

```cpp
struct Trie
{
    int index = -1;
    Trie* next[26];
};
class Solution {
public:
    vector<vector<int>> multiSearch(string big, vector<string>& smalls) {
        Trie* root = new Trie();
        int n = smalls.size(), m = big.size();
        for (int i = 0; i < n; i++)
        {
            Trie* p = root;
            for (auto s : smalls[i]) {
                if (p -> next[s - 'a'] == nullptr)
                {
                    Trie* q = new Trie();
                    p -> next[s - 'a'] = q;
                }
                p = p -> next[s - 'a'];
            }
            p -> index = i;
        }

        vector<vector<int>> ans(n);

        for (int i = 0; i < m; i ++)
        {
            Trie* p = root;
            int j = i;
            while (j < m && p -> next[big[j] - 'a'] != nullptr)
            {
                p = p -> next[big[j] - 'a'];
                if (p -> index != -1)
                    ans[p -> index].push_back(i);
                j++;
            }
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n * m * c)
