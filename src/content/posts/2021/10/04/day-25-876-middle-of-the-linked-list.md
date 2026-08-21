---
title: "Day 25 876. 链表的中间结点"
published: 2021-10-04T15:29:39+08:00
updated: 2021-10-04T15:29:39+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[876. 链表的中间结点](https://leetcode-cn.com/problems/middle-of-the-linked-list/)**

## 题目

```cpp
给定一个头结点为 head 的非空单链表，返回链表的中间结点。

如果有两个中间结点，则返回第二个中间结点。

示例 1：

输入：[1,2,3,4,5]
输出：此列表中的结点 3 (序列化形式：[3,4,5])
返回的结点值为 3 。 (测评系统对该结点序列化表述是 [3,4,5])。
注意，我们返回了一个 ListNode 类型的对象 ans，这样：
ans.val = 3, ans.next.val = 4, ans.next.next.val = 5, 以及 ans.next.next.next = NULL.

示例 2：

输入：[1,2,3,4,5,6]
输出：此列表中的结点 4 (序列化形式：[4,5,6])
由于该列表有两个中间结点，值分别为 3 和 4，我们返回第二个结点。

提示：

给定链表的结点数介于 1 和 100 之间。
```

## 题目思路

- 简单题目，开始的思路是求出链表长度：奇数折半，偶数折半减一；优化后直接使用快慢指针即可。

## 题目代码

```cpp
/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* middleNode(ListNode* head) {
        /* if(head -> next == nullptr) return head;
        int len = 1;
        ListNode* fast = head;
        while(fast)
        {
            fast = fast -> next;
            len++;
        }
        if(len % 2 != 0) len /= 2;
        else len = len / 2 - 1;
        ListNode* slow = head;
        while(len)
        {
            slow = slow -> next;
            len--;
        }
        return slow; */
        ListNode* slow = head;
        ListNode* fast = head;
        while (fast != nullptr && fast -> next != nullptr)
        {
            slow = slow -> next;
            fast = fast -> next -> next;
        }
        return slow;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(1)
