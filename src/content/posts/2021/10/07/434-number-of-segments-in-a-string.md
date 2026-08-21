---
title: "434. 字符串中的单词数"
published: 2021-10-07T16:26:31+08:00
updated: 2021-10-07T16:26:31+08:00
tags: ["leetcode"]
category: "leetcode"
---

# [434. 字符串中的单词数](https://leetcode-cn.com/problems/number-of-segments-in-a-string/)

## 题目

```cpp
统计字符串中的单词个数，这里的单词指的是连续的不是空格的字符。

请注意，你可以假定字符串里不包括任何不可打印的字符。

示例:

输入: "Hello, my name is John"
输出: 5
解释: 这里的单词是指连续的不是空格的字符，所以 "Hello," 算作 1 个单词。
```

## 题目思路

> 简单题目。字符前不是空格、后为空格，即可视为 1 个单词。

## 题目代码

```cpp
class Solution {
public:
    int countSegments(string s) {
        int n = s.size();
        if(n == 0) return 0;
        int ans = 0;
        for(int i = 0; i < s.size(); i++)
        {
            if(s[i] != ' ' && s[i + 1] == ' ')
            {
                ans++;
            }
        }
        return s[n - 1]==' ' ? ans : ans + 1;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
