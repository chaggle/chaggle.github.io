---
title: "Day 74 677. 键值映射"
published: 2021-11-22T11:45:25+08:00
updated: 2021-11-22T11:45:25+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[677. 键值映射](https://leetcode-cn.com/problems/map-sum-pairs/)**

## 题目

```cpp
实现一个 MapSum 类，支持两个方法，insert 和 sum：

MapSum() 初始化 MapSum 对象

void insert(String key, int val) 插入 key-val 键值对，字符串表示键 key ，整数表示值 val 。

如果键 key 已经存在，那么原来的键值对将被替代成新的键值对。

int sum(string prefix) 返回所有以该前缀 prefix 开头的键 key 的值的总和。
 

示例：

输入：
["MapSum", "insert", "sum", "insert", "sum"]
[[], ["apple", 3], ["ap"], ["app", 2], ["ap"]]
输出：
[null, null, 3, null, 5]

解释：
MapSum mapSum = new MapSum();
mapSum.insert("apple", 3);
mapSum.sum("ap");           // return 3 (apple = 3)
mapSum.insert("app", 2);
mapSum.sum("ap");           // return 5 (apple + app = 3 + 2 = 5)
 

提示：

1 <= key.length, prefix.length <= 50
key 和 prefix 仅由小写英文字母组成
1 <= val <= 1000
最多调用 50 次 insert 和 sum
```

## 题目思路

> 最简单的方法可以直接使用 C++ 的容器组件完成，但由于是学习 Trie 树的用法，这里使用 Trie 来构建：插入时在 key 的末尾节点记录对应的 val，sum 时顺着前缀走到对应节点后，用 dfs 累加该节点子树上的所有值。

## 题目代码

```cpp
const int N = 3000;
int ans[N][26];
int cnt[N];
int idx = 0;

class MapSum {
public:
    MapSum() {
        memset(ans, 0, sizeof ans); // 也可以使用动态数组进行i
        memset(cnt, 0, sizeof cnt);
    }

    void insert(string key, int val) {
        int p = 0;
        for (auto &i : key)
        {
            int q = i - 'a';
            if (!ans[p][q]) ans[p][q] = ++idx;
            p = ans[p][q];
        }
        cnt[p] = val;
    }

    int sum(string prefix) {
        int p = 0;
        for (auto &i : prefix)
        {
            int q = i - 'a';
            if (!ans[p][q]) return 0;
            p = ans[p][q];
        }
        return dfs(p);
    }

    int dfs(int p) {
        if (!p) return 0;
        int res = cnt[p];
        for (int i = 0; i < 26; ++i) {
            res += dfs(ans[p][i]);
        }
        return res;
    }
};

/**
 * Your MapSum object will be instantiated and called as such:
 * MapSum* obj = new MapSum();
 * obj->insert(key,val);
 * int param_2 = obj->sum(prefix);
 */
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n * m * C)
