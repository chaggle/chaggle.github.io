---
title: "Day 7 61. 旋转链表"
published: 2021-09-16T16:32:11+08:00
updated: 2021-09-16T16:32:11+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[61. 旋转链表](https://leetcode-cn.com/problems/rotate-list/)**

## 题目

```cpp
给你一个链表的头节点 head ，旋转链表，将链表每个节点向右移动 k 个位置。

示例 1：

输入：head = [1,2,3,4,5], k = 2
输出：[4,5,1,2,3]

示例 2:

输入：head = [0,1,2], k = 4
输出：[2,0,1]
 
提示：

链表中节点的数目在范围 [0, 500] 内
-100 <= Node.val <= 100
0 <= k <= 2 * 10^9
```

## 题目思路

- 理清 len - 1 - k % len 即为尾节点，就能弄明白这道题。

## 题目代码

### 代码块

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
    ListNode* rotateRight(ListNode* head, int k) {
        if(k == 0 || head == NULL || head -> next == nullptr) return head;
        int len = 1;
        ListNode* fast = head;
        ListNode* slow = head;
        while(fast -> next != nullptr)
        {
            fast = fast -> next;
            ++len;
        }
        fast -> next = head;
        k = len - 1 - k % len; //此处注意移动k步后的末尾节点,鄙人在此卡了接近半小时
        if(k == len) return head;//最后想明白了len - 1是链表尾节点，k % len为剩余步数
        while(k)     //len - 1 - k % n为尾节点
        {
            slow = slow -> next;
            k--;
        }
        fast = slow -> next;
        slow -> next = nullptr;
        return fast;
    }
};
```

## 复杂度

- 时间复杂度：O(n)，遍历两次链表
- 空间复杂度：O(1)，常数级
