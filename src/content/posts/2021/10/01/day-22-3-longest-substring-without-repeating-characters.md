---
title: "Day 22 3. 无重复字符的最长子串"
published: 2021-10-01T16:26:21+08:00
updated: 2021-10-01T16:26:21+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[3. 无重复字符的最长子串](https://leetcode-cn.com/problems/longest-substring-without-repeating-characters/)**

## 题目

```cpp
给定一个字符串 s ，请你找出其中不含有重复字符的 最长子串 的长度。

 

示例 1:

输入: s = "abcabcbb"
输出: 3
解释: 因为无重复字符的最长子串是 "abc"，所以其长度为 3。
示例 2:

输入: s = "bbbbb"
输出: 1
解释: 因为无重复字符的最长子串是 "b"，所以其长度为 1。
示例 3:

输入: s = "pwwkew"
输出: 3
解释: 因为无重复字符的最长子串是 "wke"，所以其长度为 3。
     请注意，你的答案必须是 子串 的长度，"pwke" 是一个子序列，不是子串。
示例 4:

输入: s = ""
输出: 0
 

提示：

0 <= s.length <= 5 * 10^4
s 由英文字母、数字、符号和空格组成
```

## 题目思路

- 本题是很经典的滑动窗口题目。建立 unordered_set 集合，确保集合中没有重复元素。其中 unordered_set 的 find() 方法返回一个迭代器，指向和参数哈希值匹配的元素；如果没有匹配的元素，会返回容器的结束迭代器；
- 本题只需要不断移入字符，当集合不满足题目要求时，移除左边的元素，直到满足要求为止，便可得到答案。

## 题目代码

```cpp
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        int n = s.size();
        unordered_set<char> ans;
        int str = 0;
        int l = 0;
        for(int i = 0; i < n; i++)
        {
            while(ans.find(s[i]) != ans.end())
            {
                ans.erase(s[l]);
                l++;
            }
            str = max(str, i - l + 1);
            ans.insert(s[i]);
        }
        return str;
    }
};
```

## 复杂度

- 时间复杂度：O($n$)
- 空间复杂度：O($n$)
