---
title: "Day 48 401. 二进制手表"
published: 2021-10-27T22:33:25+08:00
updated: 2021-10-27T22:33:25+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[401. 二进制手表](https://leetcode-cn.com/problems/binary-watch/)**

## 题目

```cpp
二进制手表顶部有 4 个 LED 代表 小时（0-11），底部的 6 个 LED 代表 分钟（0-59）。

每个 LED 代表一个 0 或 1，最低位在右侧。

例如，下面的二进制手表读取 "3:25" 。

给你一个整数 turnedOn ，表示当前亮着的 LED 的数量，

返回二进制手表可以表示的所有可能时间。你可以 按任意顺序 返回答案。

小时不会以零开头：

例如，"01:00" 是无效的时间，正确的写法应该是 "1:00" 。
分钟必须由两位数组成，可能会以零开头：

例如，"10:2" 是无效的时间，正确的写法应该是 "10:02" 。
 

示例 1：

输入：turnedOn = 1
输出：["0:01","0:02","0:04","0:08","0:16","0:32","1:00","2:00","4:00","8:00"]
示例 2：

输入：turnedOn = 9
输出：[]
 

提示：

0 <= turnedOn <= 10
```

## 题目思路

- 这类题目使用打表（枚举）的方法可能更好，直接枚举小时和分钟的所有组合，判断亮灯数量是否等于 turnedOn 即可。

## 题目代码

```cpp
class Solution {
public:
    int count1(int n)
    {
        int k = 0;
        while(n != 0)
        {
            n = n & (n - 1);
            k++;
        }
        return k;
    }

    vector<string> readBinaryWatch(int turnedOn) {
        vector<string> ans;
        for (int i = 0; i < 12; i++)
        {
            for (int j = 0; j < 60; j++)
            {
                if (count1(i) + count1(j) == turnedOn)
                {
                    ans.push_back(to_string(i)+":"+
                                  (j < 10 ? "0"+to_string(j) : to_string(j)));
                }
            }
        }
        return ans;
    }

};
```

## 复杂度

- 时间复杂度：O(1)

- 空间复杂度：O(1)
