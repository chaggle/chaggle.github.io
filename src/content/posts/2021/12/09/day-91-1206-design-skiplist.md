---
title: "Day 91 1206. 设计跳表"
published: 2021-12-09T16:35:22+08:00
updated: 2021-12-09T16:35:22+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[1206. 设计跳表](https://leetcode-cn.com/problems/design-skiplist/)**

## 题目

```cpp
不使用任何库函数，设计一个跳表。

跳表是在 O(log(n)) 时间内完成增加、删除、搜索操作的数据结构。

跳表相比于树堆与红黑树，其功能与性能相当，并且跳表的代码长度相较下更短，其设计思想与链表相似。

例如，一个跳表包含 [30, 40, 50, 60, 70, 90]，然后增加 80、45 到跳表中，以下图的方式操作：

跳表中有很多层，每一层是一个短的链表。

在第一层的作用下，增加、删除和搜索操作的时间复杂度不超过 O(n)。

跳表的每一个操作的平均时间复杂度是 O(log(n))，空间复杂度是 O(n)。

在本题中，你的设计应该要包含这些函数：

bool search(int target) : 返回target是否存在于跳表中。

void add(int num): 插入一个元素到跳表。

bool erase(int num): 在跳表中删除一个值，如果 num 不存在，直接返回 false.

如果存在多个 num ，删除其中任意一个即可。

了解更多 : https://en.wikipedia.org/wiki/Skip_list

注意，跳表中可能存在多个相同的值，你的代码需要处理这种情况。

样例:

Skiplist skiplist = new Skiplist();

skiplist.add(1);
skiplist.add(2);
skiplist.add(3);
skiplist.search(0);   // 返回 false
skiplist.add(4);
skiplist.search(1);   // 返回 true
skiplist.erase(0);    // 返回 false，0 不在跳表中
skiplist.erase(1);    // 返回 true
skiplist.search(1);   // 返回 false，1 已被擦除
约束条件:

0 <= num, target <= 20000
最多调用 50000 次 search, add, 以及 erase操作。
```

## 题目思路

> 没什么时间重新写一个容器，现在偷点懒直接用 vector 的库函数，用它存放跳表每一层的后继指针，节点的层数通过随机数生成。

## 题目代码

```cpp
struct Node
{
    int key;
    vector<Node*> nexts;
    Node(int level,int k) : nexts(level + 1),key(k) {};
};

class Skiplist {
private:
    Node* head;
    int allLevel = -1;
public:
    Skiplist() {
        head = new Node(31,-1);
    }

    bool search(int key) {
        Node* cur = head;
        for(int curLevel = allLevel; curLevel >= 0; curLevel--)
        {
            while(cur -> nexts[curLevel] && cur -> nexts[curLevel] -> key < key) {
                cur = cur -> nexts[curLevel];
            }
            if(cur -> nexts[curLevel] && cur -> nexts[curLevel] -> key == key)
                return true;
        }
        return false;
    }
    void add(int key) {
        int newLevel = getLevel();
        allLevel = max(allLevel, newLevel);
        Node* cur = head;
        Node* newNode = new Node(newLevel, key);
        for(int curLevel = allLevel; curLevel >= 0; curLevel--)
        {
            while(cur -> nexts[curLevel] && cur -> nexts[curLevel] -> key < key){
                cur = cur -> nexts[curLevel];
            }
            if(curLevel <= newLevel)
            {
                newNode -> nexts[curLevel] = cur -> nexts[curLevel];
                cur -> nexts[curLevel] = newNode;
            }
        }
    }
    bool erase(int key) {
        Node* cur = head;
        bool flag = false;
        for(int curLevel = allLevel; curLevel >= 0; curLevel--)
        {
            while(cur -> nexts[curLevel] && cur -> nexts[curLevel] -> key < key) {
                cur = cur -> nexts[curLevel];
            }
            if(cur -> nexts[curLevel] && cur -> nexts[curLevel] -> key == key) {
                flag = true;
                Node* tmp = cur -> nexts[curLevel] -> nexts[curLevel];
                cur -> nexts[curLevel] -> nexts[curLevel] = nullptr;
                cur -> nexts[curLevel] = tmp;
            }
        }
        if(flag == false) return false;
        return true;
    }
    int getLevel() {
        int ans = 0;
        while(ans < 32 && rand() < RAND_MAX * 0.25) ans++;
        return ans;
    }
};
/**
 * Your Skiplist object will be instantiated and called as such:
 * Skiplist* obj = new Skiplist();
 * bool param_1 = obj->search(target);
 * obj->add(num);
 * bool param_3 = obj->erase(num);
 */
```

## 复杂度

- 时间复杂度：O(nlogn)
- 空间复杂度：O(n ^ 2)
