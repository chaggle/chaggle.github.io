---
title: "Day 45 438. 找到字符串中所有字母异位词"
published: 2021-10-24T19:52:21+08:00
updated: 2021-10-24T19:52:21+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[438. 找到字符串中所有字母异位词](https://leetcode-cn.com/problems/find-all-anagrams-in-a-string/)**

## 题目

```cpp
给定两个字符串 s 和 p，找到 s 中所有 p 的 异位词 的子串，

返回这些子串的起始索引。不考虑答案输出的顺序。

异位词 指由相同字母重排列形成的字符串（包括相同的字符串）。

 

示例 1:

输入: s = "cbaebabacd", p = "abc"
输出: [0,6]
解释:
起始索引等于 0 的子串是 "cba", 它是 "abc" 的异位词。
起始索引等于 6 的子串是 "bac", 它是 "abc" 的异位词。
 示例 2:

输入: s = "abab", p = "ab"
输出: [0,1,2]
解释:
起始索引等于 0 的子串是 "ab", 它是 "ab" 的异位词。
起始索引等于 1 的子串是 "ba", 它是 "ab" 的异位词。
起始索引等于 2 的子串是 "ab", 它是 "ab" 的异位词。
 

提示:

1 <= s.length, p.length <= 3 * 104
s 和 p 仅包含小写字母
```

## 题目思路

- 本题依旧使用滑动窗口解法。核心在于：只要 s 中长度为 p 的子串内各个字母的出现次数，与 p 中对应字母的出现次数相同，该子串就是 p 的字母异位词，因此只需要两个计数数组即可。

## 题目代码

```cpp
class Solution {
public:
    vector<int> findAnagrams(string s, string p) {
        vector<int> ans;
        int n = s.size(), m = p.size();
        if(n < m) return ans;
        vector<int> sin(26, 0);
        vector<int> pin(26, 0);
        for(int i = 0; i < m; i++)
        {
            pin[p[i] - 'a']++;
        }
        int l = 0;
        for(int r = 0; r < n; r++)
        {
            sin[s[r] - 'a']++;
            if(r >= m)
            {
                sin[s[l] - 'a']--;
                l++;
            }
            if(pin == sin) ans.push_back(l);
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n)

- 空间复杂度：O(n)
