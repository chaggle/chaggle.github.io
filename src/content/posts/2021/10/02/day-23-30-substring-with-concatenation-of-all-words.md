---
title: "Day 23 30. 串联所有单词的子串"
published: 2021-10-02T13:49:39+08:00
updated: 2021-10-02T13:49:39+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[30. 串联所有单词的子串](https://leetcode-cn.com/problems/substring-with-concatenation-of-all-words/)**

## 题目

```cpp
给定一个字符串 s 和一些 长度相同 的单词 words 。

找出 s 中恰好可以由 words 中所有单词串联形成的子串的起始位置。

注意子串要与 words 中的单词完全匹配，

中间不能有其他字符 ，但不需要考虑 words 中单词串联的顺序。

 

示例 1：

输入：s = "barfoothefoobarman", words = ["foo","bar"]
输出：[0,9]
解释：
从索引 0 和 9 开始的子串分别是 "barfoo" 和 "foobar" 。
输出的顺序不重要, [9,0] 也是有效答案。
示例 2：

输入：s = "wordgoodgoodgoodbestword", words = ["word","good","best","word"]
输出：[]
示例 3：

输入：s = "barfoofoobarthefoobarman", words = ["bar","foo","the"]
输出：[6,9,12]
 

提示：

1 <= s.length <= 10^4
s 由小写英文字母组成
1 <= words.length <= 5000
1 <= words[i].length <= 30
words[i] 由小写英文字母组成
```

## 题目思路

- 困难题目，开局思考半小时，发现应该可以使用滑动窗口的解法；
- 具体思想是使用两个 unordered_map：up 记录 words 中所有单词及对应数量，ump 记录滑动窗口内 words 中出现的单词及对应数量；
- 遍历时每次增加一个单词的长度，按照 ws 去移动窗口，对于每一趟遍历，维持窗口 l = r；
- 若单词在 up 里不存在，重置窗口并清空 ump；
- 若单词在 up 里存在，则检查其出现次数是否超过 up 中的次数，若超过则需要增大左边界（右移 l）来缩小窗口；当 cnt 满足等于 ns 时，将 l 作为当前的答案插入。

## 题目代码

```cpp
class Solution {
public:
    vector<int> findSubstring(string s, vector<string>& words) {
        vector<int> ans;
        int n = s.size();
        if(n <= 0 || words.empty()) return ans;
        int ws = words[0].size();		//words中的word的长度，为统一长度
        int ns = words.size();			//words中的word数量
        unordered_map<string, int> up; //保存words中的word
        for(auto & w : words)
        {
            up[w]++;	//记录每一个单词出现的次数
        }
        for(int i = 0; i < ws; i++)
        {
            int l = i, r = i; //从左开始
            int cnt = 0;	//下文ump存放的单词总数！
            unordered_map<string, int> ump;
            while(r + ws <= n)	//右边长度加每个单词长度要小于s的全长
            {
                string res = s.substr(r, ws); //在右边界加入一个单词
                r += ws;		//扩展右边界
                if(up.find(res) != up.end()) //查看res在up中的位置
                {
                    ump[res]++;
                    cnt++;
                    while(ump[res] > up[res])// 需要检查数量是否超过，超过则要右移left
                    {						 //来缩小窗口
                        string tmp = s.substr(l, ws);
                        l += ws;
                        cnt--;
                        ump[tmp]--;
                    }
                    if(cnt == ns) ans.push_back(l);
                }
                else //未出现，舍弃此单词。清空
                {
                    l = r;
                    cnt = 0;
                    ump.clear();
                }
            }
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：整体复杂度为 O(ns * ws)
- 空间复杂度：O(ns * ws)，可能有一些问题，有空再来思考
