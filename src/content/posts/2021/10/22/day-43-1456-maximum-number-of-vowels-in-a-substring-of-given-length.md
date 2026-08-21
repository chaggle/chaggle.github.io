---
title: "Day 43 1456. 定长子串中元音的最大数目"
published: 2021-10-22T20:22:22+08:00
updated: 2021-10-22T20:22:22+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1456. 定长子串中元音的最大数目](https://leetcode-cn.com/problems/maximum-number-of-vowels-in-a-substring-of-given-length/)**

## 题目

```cpp
给你字符串 s 和整数 k 。

请返回字符串 s 中长度为 k 的单个子字符串中可能包含的最大元音字母数。

英文中的 元音字母 为（a, e, i, o, u）。

 

示例 1：

输入：s = "abciiidef", k = 3
输出：3
解释：子字符串 "iii" 包含 3 个元音字母。
示例 2：

输入：s = "aeiou", k = 2
输出：2
解释：任意长度为 2 的子字符串都包含 2 个元音字母。
示例 3：

输入：s = "leetcode", k = 3
输出：2
解释："lee"、"eet" 和 "ode" 都包含 2 个元音字母。
示例 4：

输入：s = "rhythms", k = 4
输出：0
解释：字符串 s 中不含任何元音字母。
示例 5：

输入：s = "tryhard", k = 4
输出：1
 

提示：

1 <= s.length <= 10^5
s 由小写英文字母组成
1 <= k <= s.length
```

## 题目思路

- 滑动窗口题。设定窗口大小为 k，从左到右逐步滑动，每次滑动时判断窗口头尾字符的变化，更新窗口内的元音数量即可。还可以分情况简化写法，但时间复杂度基本不变。

## 题目代码

```cpp
class Solution {
public:
    bool isvaild(char ch) {
        return ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u';
    }

    int maxVowels(string s, int k) {
        int n = s.size();
        deque<char> ans;
        int count = 0, tmp = 0;
        for(int i = 0; i < k; i++)
        {
            if(isvaild(s[i])) count++; ans.push_back(s[i]);
        }

        tmp = count;

        for(int i = k; i < n; i++)
        {
            if(isvaild(ans.front())) count--; ans.pop_front();
            if(isvaild(s[i])) count++; ans.push_back(s[i]);
            if(tmp < count) tmp = count;
        }
        return tmp;
    }
};
```

## 复杂度

- 时间复杂度：O(n)

- 空间复杂度：O(1)
