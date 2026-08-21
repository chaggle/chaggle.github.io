---
title: "Day 84 28. 实现 strStr()"
published: 2021-12-02T20:17:07+08:00
updated: 2021-12-02T20:17:07+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[28. 实现 strStr()](https://leetcode-cn.com/problems/implement-strstr/)**

## 题目

```cpp
实现 strStr() 函数。

给你两个字符串 haystack 和 needle 在 haystack 字符串中

找出 needle 字符串出现的第一个位置（下标从 0 开始）。

如果不存在，则返回  -1 。

 

说明：

当 needle 是空字符串时我们应当返回什么值呢？

对于本题而言，当 needle 是空字符串时我们应当返回 0 。

这与 C 语言的 strstr() 以及 Java 的 indexOf() 定义相符。

 

示例 1：

输入：haystack = "hello", needle = "ll"
输出：2
示例 2：

输入：haystack = "aaaaa", needle = "bba"
输出：-1
示例 3：

输入：haystack = "", needle = ""
输出：0
 

提示：

0 <= haystack.length, needle.length <= 5 * 104
haystack 和 needle 仅由小写英文字符组成
```

## 题目思路

> 经典题目，一眼看出是 KMP 算法的考察，将 haystack 视为主串 s，needle 视为模式串 p 即可。昨日做的是 BF（暴力匹配）算法，今日做 KMP，我刚好相反。

## 题目代码

```cpp
class Solution {
public:
    //KMP
    int strStr(string s, string p) {
        int n = s.size(), m = p.size();
        if(m == 0) return 0;

        s.insert(s.begin(), ' ');
        p.insert(p.begin(), ' ');

        vector<int> next(m + 1);

        for(int i = 2, j = 0; i <= m; i++) {
            while(j && p[i] != p[j + 1]) j = next[j];
            if(p[i] == p[j + 1]) j++;
            next[i] = j;
        }

        for(int i = 1, j = 0; i <= n; i++) {
            while(j && s[i] != p[j + 1]) j = next[j];
            if(s[i] == p[j + 1]) j++;
            if(j == m) return i - m;
        }
        return -1;
    }

    //BF算法
    int strStr(string s, string t) {
        int m = s.size(), n = t.size();
        if (m < n) return -1;
        if (n == 0) return 0;
        int i = 0, j = 0, l = 0;
        while (i < m && j < n)
        {
            if(s[i] == t[j]) {
                i++;
                j++;
            } else {
                l++;
                i = l;
                j = 0;
            }
        }
        if (j == n) return l;
        return -1;
    }
};

```

## 复杂度

- 时间复杂度：O(m + n) // KMP
- 空间复杂度：O(m + n) // KMP
