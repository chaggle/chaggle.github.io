---
title: "Day 46 76. 最小覆盖子串"
published: 2021-10-25T21:36:54+08:00
updated: 2021-10-25T21:36:54+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[76. 最小覆盖子串](https://leetcode-cn.com/problems/minimum-window-substring/)**

## 题目

```cpp
给你一个字符串 s 、一个字符串 t 。

返回 s 中涵盖 t 所有字符的最小子串。如果 s 中不存在涵盖 t 所有字符的子串，则返回空字符串 "" 。

 

注意：

对于 t 中重复字符，我们寻找的子字符串中该字符数量必须不少于 t 中该字符数量。
如果 s 中存在这样的子串，我们保证它是唯一的答案。
 

示例 1：

输入：s = "ADOBECODEBANC", t = "ABC"
输出："BANC"
示例 2：

输入：s = "a", t = "a"
输出："a"
示例 3:

输入: s = "a", t = "aa"
输出: ""
解释: t 中两个字符 'a' 均应包含在 s 的子串中，
因此没有符合条件的子字符串，返回空字符串。
 

提示：

1 <= s.length, t.length <= 105
s 和 t 由英文字母组成
 

进阶：你能设计一个在 o(n) 时间内解决此问题的算法吗？
```

## 题目思路

- 本题依旧使用滑动窗口解法。核心在于：只要 s 的窗口内各字符的出现次数不少于 t 中对应字符的出现次数，该窗口就是一个覆盖子串，再在其中求出最短的区间即可。
- 与昨天的题目一样，本题使用两个哈希表代替两个数组。

## 题目代码

```cpp
class Solution {
public:
    string minWindow(string s, string t) {
        int n = s.size(), m = t.size();
        unordered_map<char, int> wins, wint;
        for(auto ch: t)
        {
            wint[ch]++;
        }
        string res;
        int count = 0;
        for(int i = 0, j = 0; i < n; i++)
        {
            wins[s[i]] ++ ;
            if(wins[s[i]] <= wint[s[i]]) count++ ;
            while(wins[s[j]] > wint[s[j]]) wins[s[j++]]--;
            if(count == m)
            {
                if(res.empty() || i - j + 1 < res.size())
                {
                    res = s.substr(j, i - j + 1);
                }
            }
        }
        return res;
    }
};
```

## 复杂度

- 时间复杂度：O(n)

- 空间复杂度：O(n)
