---
title: "Day 57 1143. 最长公共子序列"
published: 2021-11-05T15:47:17+08:00
updated: 2021-11-05T15:47:17+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1143. 最长公共子序列](https://leetcode-cn.com/problems/longest-common-subsequence/)**

## 题目

```cpp
给定两个字符串 text1 和 text2，返回这两个字符串的最长 公共子序列 的长度。

如果不存在 公共子序列 ，返回 0 。

一个字符串的 子序列 是指这样一个新的字符串：

它是由原字符串在不改变字符的相对顺序的情况下删除某些字符后组成的新字符串。

例如，"ace" 是 "abcde" 的子序列，但 "aec" 不是 "abcde" 的子序列。

两个字符串的 公共子序列 是这两个字符串所共同拥有的子序列。

 

示例 1：

输入：text1 = "abcde", text2 = "ace"
输出：3
解释：最长公共子序列是 "ace" ，它的长度为 3 。
示例 2：

输入：text1 = "abc", text2 = "abc"
输出：3
解释：最长公共子序列是 "abc" ，它的长度为 3 。
示例 3：

输入：text1 = "abc", text2 = "def"
输出：0
解释：两个字符串没有公共子序列，返回 0 。
 

提示：

1 <= text1.length, text2.length <= 1000
text1 和 text2 仅由小写英文字符组成。
```

## 题目思路

- 本题既可以用两个一维数组求解，也可以用二维数组求解，这里选择使用二维数组。
- 优化后与之前做的几道题一致，可以优化空间为一个 2 列、text2.size() 行的滚动数组，由于时间关系暂时作为 TODO。
- 状态转移方程为：当 `text1[i] == text2[j]` 时，`ans[i][j] = ans[i - 1][j - 1] + 1`，即当前字符匹配上时，最长公共子序列的长度加一；当 `text1[i] != text2[j]` 时，`ans[i][j] = max(ans[i - 1][j], ans[i][j - 1])`，分别代表必然不使用 s1[i]（但可能使用 s2[j]）和必然不使用 s2[j]（但可能使用 s1[i]）时的长度。
- 在字符串前面补一个空格，可以更好地处理边界条件。

## 题目代码

```cpp
class Solution {
public:
    int longestCommonSubsequence(string text1, string text2) {
        int n = text1.size(), m = text2.size();
    	text1 = " " + text1;
        text2 = " " + text2;
        vector<vector<int>> ans(n + 1, vector<int>(m + 1, 0));

    	for(int i = 0; i <= n; i++) ans[i][0] = 1;
    	for(int j = 0; j <= m; j++) ans[0][j] = 1;

    	for(int i = 1; i <= n; i++)
        {
    		for(int j = 1; j <= m; j++)
            {
    			if(text1[i] == text2[j])
				{
					ans[i][j] = max(
						ans[i - 1][j - 1] + 1,
						max(ans[i - 1][j], ans[i][j - 1])
					);
				}
    			else ans[i][j] = max(ans[i - 1][j], ans[i][j - 1]);
    		}
    	}
    	return ans[n][m] - 1;
    }
};
```

## 复杂度

- 时间复杂度：O(n \* m)

- 空间复杂度：O(n \* m)
