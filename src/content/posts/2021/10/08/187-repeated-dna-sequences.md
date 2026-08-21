---
title: "187. 重复的 DNA 序列"
published: 2021-10-08T15:47:55+08:00
updated: 2021-10-08T15:47:55+08:00
tags: ["leetcode"]
category: "leetcode"
---

# [187. 重复的 DNA 序列](https://leetcode-cn.com/problems/repeated-dna-sequences/)

## 题目

```cpp
所有 DNA 都由一系列缩写为 'A'，'C'，'G' 和 'T' 的核苷酸组成，例如："ACGAATTCCG"。在研究 DNA 时，识别 DNA 中的重复序列有时会对研究非常有帮助。

编写一个函数来找出所有目标子串，目标子串的长度为 10，且在 DNA 字符串 s 中出现次数超过一次。

示例 1：

输入：s = "AAAAACCCCCAAAAACCCCCCAAAAAGGGTTT"
输出：["AAAAACCCCC","CCCCCAAAAA"]
示例 2：

输入：s = "AAAAAAAAAAAAA"
输出：["AAAAAAAAAA"]

提示：

0 <= s.length <= 105
s[i] 为 'A'、'C'、'G' 或 'T'
```

## 题目思路

> 使用滑动窗口，窗口长度为 10，用哈希表统计每个长度为 10 的子串出现的次数，出现次数超过一次的子串即为答案。

## 题目代码

```cpp
class Solution {
public:
    vector<string> findRepeatedDnaSequences(string s) {
        vector<string> ans;
        int n = s.size();
        unordered_map<string, int> st;
        for(int i = 0, j = 9; j < n; j++, i++)
        {
            if(st[s.substr(i,10)] == 1)
            {
                ans.push_back(s.substr(i, 10));
            }
            st[s.substr(i, 10)]++;
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n\*C)
- 空间复杂度：O(n)
