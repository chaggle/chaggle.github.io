---
title: "Day 88 451. 根据字符出现频率排序"
published: 2021-12-06T22:06:57+08:00
updated: 2021-12-06T22:06:57+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[451. 根据字符出现频率排序](https://leetcode-cn.com/problems/sort-characters-by-frequency/)**

## 题目

```cpp
给定一个字符串，请将字符串里的字符按照出现的频率降序排列。

示例 1:

输入:
"tree"

输出:
"eert"

解释:
'e'出现两次，'r'和't'都只出现一次。
因此'e'必须出现在'r'和't'之前。此外，"eetr"也是一个有效的答案。
示例 2:

输入:
"cccaaa"

输出:
"cccaaa"

解释:
'c'和'a'都出现三次。此外，"aaaccc"也是有效的答案。
注意"cacaca"是不正确的，因为相同的字母必须放在一起。
示例 3:

输入:
"Aabb"

输出:
"bbAa"

解释:
此外，"bbaA"也是一个有效的答案，但"Aabb"是不正确的。
注意'A'和'a'被认为是两种不同的字符。
```

## 题目思路

> 如题目所说，手写一个 cmp 比较函数，然后按照字符出现的频率进行排序，返回排序后的字符串即可。

## 题目代码

```cpp
class Solution {
public:
    string frequencySort(string s) {
        unordered_map<char, int> up;
        for(auto i : s) up[i]++;
        sort(s.begin(), s.end(), [&](const char &a, const char &b) {
            return up[a] == up[b] ? a > b : up[a] > up[b];
        });
        return s;
    }
};
```

## 复杂度

- 时间复杂度：O(logn)
- 空间复杂度：O(n)
