---
title: "Day 8 24. 两两交换链表中的节点"
published: 2021-09-17T15:12:01+08:00
updated: 2021-09-17T15:12:01+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[24. 两两交换链表中的节点](https://leetcode-cn.com/problems/swap-nodes-in-pairs/)**

## 题目

```cpp
给定一个链表，两两交换其中相邻的节点，并返回交换后的链表。

你不能只是单纯的改变节点内部的值，而是需要实际的进行节点交换。

示例 1：

输入：head = [1,2,3,4]
输出：[2,1,4,3]

示例 2：

输入：head = []
输出：[]

示例 3：

输入：head = [1]
输出：[1]
 
提示：

链表中节点的数目在范围 [0, 100] 内
0 <= Node.val <= 100
 

进阶：你能在不修改链表节点值的情况下解决这个问题吗?（也就是说，仅修改节点本身。）
```

## 题目思路

- 最简单的思路自然是递归的思路；
- 而递归调用的也是栈的实现方法，所以自然也能想到用栈来做的解法。

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
    ListNode* swapPairs(ListNode* head) {
		if(head == nullptr || head -> next == nullptr) return head;
		stack<ListNode* > stk;
		ListNode* p = new ListNode();
		ListNode* pos = head;
        head = p;
		while(pos != nullptr && pos -> next != nullptr)
        {
			stk.push(pos);
			stk.push(pos -> next);
			pos = pos -> next -> next;
			p -> next = stk.top();
            stk.pop();
			p = p -> next;
			p -> next = stk.top();
            stk.pop();
			p = p -> next;
		}
		if(pos != nullptr) p -> next = pos;
	    else p -> next = nullptr;
		return head -> next;
		/*
		if (head == nullptr || head->next == nullptr) return head;
        ListNode* p = head -> next;
        head -> next = swapPairs(p -> next);
        p -> next = head;
        return p;
		*/
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
