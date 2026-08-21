---
title: "Day 12 146. LRU 缓存机制"
published: 2021-09-21T16:02:01+08:00
updated: 2021-09-21T16:02:01+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[146. LRU 缓存机制](https://leetcode-cn.com/problems/lru-cache/)**

## 题目

```cpp
运用你所掌握的数据结构，设计和实现一个  LRU (最近最少使用) 缓存机制 。
实现 LRUCache 类：

LRUCache(int capacity) 以正整数作为容量 capacity 初始化 LRU 缓存

int get(int key) 如果关键字 key 存在于缓存中，则返回关键字的值，否则返回 -1 。

void put(int key, int value) 如果关键字已经存在，则变更其数据值；

如果关键字不存在，则插入该组「关键字-值」。

当缓存容量达到上限时，它应该在写入新数据之前删除最久未使用的数据值，从而为新的数据值留出空间。

进阶：你是否可以在 O(1) 时间复杂度内完成这两种操作？

示例：

输入
["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]
[[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]
输出
[null, null, null, 1, null, -1, null, -1, 3, 4]

解释
LRUCache lRUCache = new LRUCache(2);
lRUCache.put(1, 1); // 缓存是 {1=1}
lRUCache.put(2, 2); // 缓存是 {1=1, 2=2}
lRUCache.get(1);    // 返回 1
lRUCache.put(3, 3); // 该操作会使得关键字 2 作废，缓存是 {1=1, 3=3}
lRUCache.get(2);    // 返回 -1 (未找到)
lRUCache.put(4, 4); // 该操作会使得关键字 1 作废，缓存是 {4=4, 3=3}
lRUCache.get(1);    // 返回 -1 (未找到)
lRUCache.get(3);    // 返回 3
lRUCache.get(4);    // 返回 4
 

提示：

1 <= capacity <= 3000
0 <= key <= 10000
0 <= value <= 10^5
最多调用 2 * 10^5 次 get 和 put
```

## 题目思路

- 本题需要自己实现一个 LRU 缓存机制。结合操作系统中学到的知识以及题目所给条件，实现上应该选用哈希表加双向链表：双向链表需要实现移除、插入、修改等操作，实现起来比较有难度；哈希表可以使用 STL 库中的 unordered_map 实现。

## 题目代码

### 代码块

```cpp
class LRUCache {
private:
    struct Node
    {
        int key, value;
        Node* left ,*right;
        Node(int _key,int _value) : key(_key), value(_value), left(NULL), right(NULL) {}
    } *l, *r;      //双链表的最左和最右节点，不存贮值。
    int n;
    unordered_map<int, Node*>hash;

public:
    void remove(Node* p)
    {
        p -> right -> left = p -> left;
        p -> left -> right = p -> right;
    }

    void insert(Node *p)
    {
        p -> right = l -> right;
        p -> left = l;
        l -> right -> left = p;
        l -> right = p;
    }

    LRUCache(int capacity)
    {
        n = capacity;
        l = new Node(-1, -1);
        r = new Node(-1, -1);
        l -> right = r;
        r -> left = l;
    }

    int get(int key)
    {
        if(hash.count(key) == 0) return -1;   //不存在关键字key
        auto p = hash[key];
        remove(p);
        insert(p);                              //将当前节点放在双链表的第一位
        return p -> value;
    }

    void put(int key, int value)
    {
        if(hash.count(key))                   //如果key存在，则修改对应的value
        {
            auto p = hash[key];
            p -> value = value;
            remove(p);
            insert(p);
        }
        else
        {
            if(hash.size() == n)              //如果缓存已满，则删除双链表最右侧的节点
            {
                auto  p = r -> left;
                remove(p);
                hash.erase(p -> key);         //更新哈希表
                delete p;                     //释放内存，c++注意内存管理
            }
            auto p = new Node(key, value);    //否则，插入(key, value)
            hash[key] = p;
            insert(p);
        }
    }
};

/**
 * Your LRUCache object will be instantiated and called as such:
 * LRUCache* obj = new LRUCache(capacity);
 * int param_1 = obj->get(key);
 * obj->put(key,value);
 */
```

## 复杂度

- 时间复杂度：O(1)，都是常数级复杂度；
- 空间复杂度：O(capacity + 1)。
