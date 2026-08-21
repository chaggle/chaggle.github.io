---
title: "Day 11 142. 环形链表 II"
published: 2021-09-20T15:20:01+08:00
updated: 2021-09-20T15:20:01+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[142. 环形链表 II](https://leetcode-cn.com/problems/linked-list-cycle-ii/)**

## 题目

```cpp
给定一个链表，返回链表开始入环的第一个节点。 如果链表无环，则返回 null。

为了表示给定链表中的环，我们使用整数 pos 来表示链表尾连接到链表中的位置（索引从 0 开始）。

如果 pos 是 -1，则在该链表中没有环。

注意，pos 仅仅是用于标识环的情况，并不会作为参数传递到函数中。

说明：不允许修改给定的链表。

进阶：

你是否可以使用 O(1) 空间解决此题？
 
示例 1：

输入：head = [3,2,0,-4], pos = 1
输出：返回索引为 1 的链表节点
解释：链表中有一个环，其尾部连接到第二个节点。

示例 2：

输入：head = [1,2], pos = 0
输出：返回索引为 0 的链表节点
解释：链表中有一个环，其尾部连接到第一个节点。

示例 3：

输入：head = [1], pos = -1
输出：返回 null
解释：链表中没有环。

提示：

链表中节点的数目范围在范围 [0, 10^4] 内
-10^5 <= Node.val <= 10^5
pos 的值为 -1 或者链表中的一个有效索引
```

## 题目思路

- 经典双指针问题，同时与昨日的题目一样，也可以使用哈希表解法，但哈希表的空间复杂度较高，效果不佳；
- 双指针解法的完整证明见官方题解，此处不再赘述。

## 题目代码

### 代码块

```cpp
/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode(int x) : val(x), next(NULL) {}
 * };
 */
class Solution {
public:
    ListNode *detectCycle(ListNode *head) {
        if(head == NULL || head -> next == nullptr) return NULL;
        ListNode* fast = head;
        ListNode* slow = head;
        while(fast != nullptr && fast -> next != nullptr)
        {
            slow = slow -> next;
            fast = fast -> next -> next;
            if(fast == slow)
            {
                ListNode* tmp = head;
                while(tmp != slow)
                {
                    tmp = tmp -> next;
                    slow = slow -> next;
                }
                return tmp;
            }
        }
        return NULL;
    }
        /* if(head == NULL || head -> next == nullptr) return NULL;
        unordered_set<ListNode* > m;
        ListNode* fast = head;
        while(fast -> next != nullptr)
        {
            if(m.count(fast) != 0) return fast;
            m.insert(fast);
            fast = fast -> next;
        }
        return nullptr; */
    }
};
```

## 复杂度

- 时间复杂度：双指针 O(n)，哈希表为 O(n)；
- 空间复杂度：双指针 O(1)，哈希表为 O(n)。
