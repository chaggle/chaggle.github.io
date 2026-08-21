---
title: "Day 2 821. 字符的最短距离"
published: 2021-09-11T14:27:35+08:00
updated: 2022-06-14T10:48:56+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[821. 字符的最短距离](https://leetcode-cn.com/problems/shortest-distance-to-a-character/)**

## 题目

```cpp
给定一个字符串 S 和一个字符 C

返回一个代表字符串 S 中每个字符到字符串 S 中的字符 C 的最短距离的数组。

示例 1：

输入：s = "loveleetcode", c = "e"

输出：[3,2,1,0,1,0,0,1,2,2,1,0]

解释：字符 'e' 出现在下标 3、5、6 和 11 处（下标从 0 开始计数）

距下标 0 最近的 'e' 出现在下标 3 ，所以距离为 abs(0 - 3) = 3

距下标 1 最近的 'e' 出现在下标 3 ，所以距离为 abs(1 - 3) = 2

对于下标 4 来说，出现在下标 3 和下标 5 处的 'e' 都离它最近。

但距离是一样的 abs(4 - 3) == abs(4 - 5) = 1

距下标 8 最近的 'e' 出现在下标 6 ，所以距离为 abs(8 - 6) = 2
示例 2：

输入：s = "aaab", c = "b"
输出：[3,2,1,0]
```

## 题目思路

- 建立一个 vector，存储遍历字符串后等于输入字符 c 的位置下标；
- 对于每一个位置，将其减去数组中的值，取绝对值，并返回其中最小的值；
- min(abs(i - pos[j]), abs(i - pos[j + 1])) 中会出现数组长度为一的特殊情况，此处的特殊情况之后会进一步优化。

## 题目代码

### 代码块

```java
class Solution {
    public int[] shortestToChar(String s, char c){
        // 双重for循环查找
        int n = s.length();
        int[] res = new int[n];
        Arrays.fill(res, n + 1);
        for (int i = 0, j = -1; i < n; i++) {
            if (s.charAt(i) == c) {
                j = i;
            }
            if (j != -1) {
                res[i] = i - j;
            }
        }
        for (int i = n - 1, j = -1; i >= 0; i--) {
            if (s.charAt(i) == c) {
                j = i;
            }
            if (j != -1) {
                res[i] = Math.min(res[i], j - i);
            }
        }
        return res;
    }
}
```

```cpp
class Solution {
public:
    vector<int> shortestToChar(string s, char c) {
        int n = s.size();
        vector<int> pos;
        vector<int> ans(n, n);

        for(int i = 0; i < n; i++)
        {
            if(s[i] == c) pos.push_back(i);
        }

        for(int i = 0; i < n; i++)
        {
            int tmp = 0;
            if(pos.size() != 1)
            {
                for(int j = 0; j < pos.size() - 1; j++)
                {
                    tmp = min(abs(i - pos[j]), abs(i - pos[j + 1]));
                    if(ans[i] > tmp) ans[i] = tmp;
                }
            }
            else
            {
                ans[i] = abs(i - pos[0]);
            }

        }
        return ans;
    }
};
```

```go
func shortestToChar(s string, c byte) []int {
    n := len(s)

    ans := make([]int, n)
    pos := make([]int, 0)

    for i := 0; i < n; i++ {
        if s[i] == c {
            pos = append(pos, i)
        }
    }

    for i := 0; i < n; i++ {
        if s[i] != c {
            ans[i] = min(pos, i)
        } else {
            ans[i] = 0
        }
    }

    return ans
}

func min(num []int, n int) int {
    min := 10000 //因为最长为10000
    
    for i := 0; i < len(num); i++ {
        if min > abs(n - num[i]) {
            min = abs(n - num[i])
        }
    }

    return min
}

func abs(a int) int {
    if a < 0 {
        return -a
    }

    return a
}
```

## 复杂度

- 时间复杂度：O($n*k$)，n 是 s 的长度，k 是字符 c 在字符串中出现的次数，k <= n。
- 空间复杂度：O(k)，k 为字符 c 出现的次数，这是记录字符 c 出现下标的辅助数组消耗的空间。
