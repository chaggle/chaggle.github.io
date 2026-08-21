---
title: "Day 73 208. 实现 Trie (前缀树)"
published: 2021-11-21T09:35:06+08:00
updated: 2021-11-21T09:35:06+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[208. 实现 Trie (前缀树)](https://leetcode-cn.com/problems/implement-trie-prefix-tree/)**

## 题目

```cpp
Trie（发音类似 "try"）或者说 前缀树 是一种树形数据结构，用于高效地存储和检索字符串数据集中的键。

这一数据结构有相当多的应用情景，例如自动补完和拼写检查。

请你实现 Trie 类：

Trie() 初始化前缀树对象。

void insert(String word) 向前缀树中插入字符串 word 。

boolean search(String word) 如果字符串 word 在前缀树中, 返回 true; 否则，返回 false。

boolean startsWith(String prefix) 如果之前已经插入的字符串 word 的前缀之一，返回 true
 

示例：

输入
["Trie", "insert", "search", "search", "startsWith", "insert", "search"]
[[], ["apple"], ["apple"], ["app"], ["app"], ["app"], ["app"]]
输出
[null, null, true, false, true, null, true]

解释
Trie trie = new Trie();
trie.insert("apple");
trie.search("apple");   // 返回 True
trie.search("app");     // 返回 False
trie.startsWith("app"); // 返回 True
trie.insert("app");
trie.search("app");     // 返回 True
 

提示：

1 <= word.length, prefix.length <= 2000
word 和 prefix 仅由小写英文字母组成
insert、search 和 startsWith 调用次数 总计 不超过 3 * 104 次
```

## 题目思路

> Trie 树（前缀树）的设计模板题目，建议先了解其概念，然后背诵模板实现，多做几道 Trie 树的题目即可熟练掌握。

## 题目代码

```cpp
class Trie {
private:
    bool isEnd;
    vector<Trie*> next;
public:
    Trie() : next(26), isEnd(false) {}

    void insert(string word) {
        Trie* T = this;
        for (char c : word)
        {
            if (T -> next[c - 'a'] == NULL)
            {
                T -> next[c - 'a'] = new Trie();
            }
            T = T -> next[c - 'a'];
        }
        T -> isEnd = true;
    }

    bool search(string word) {
        Trie* T = this;
        for (char c : word)
        {
            T = T -> next[c - 'a'];
            if (T == NULL) return false;
        }
        return T -> isEnd;
    }

    bool startsWith(string prefix) {
        Trie* T = this;
        for (char c : prefix)
        {
            T = T -> next[c-'a'];
            if (T == NULL) return false;
        }
        return true;
    }
};
/**
 * Your Trie object will be instantiated and called as such:
 * Trie* obj = new Trie();
 * obj->insert(word);
 * bool param_2 = obj->search(word);
 * bool param_3 = obj->startsWith(prefix);
 */
```

## 复杂度

- 时间复杂度：O(1 + |S|)
- 空间复杂度：O(|T| * sum)
