---
title: "Day 69 23. 合并K个升序链表"
published: 2021-11-17T17:35:08+08:00
updated: 2021-11-17T17:35:08+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[23. 合并K个升序链表](https://leetcode-cn.com/problems/merge-k-sorted-lists/)**

## 题目

```cpp
给你一个链表数组，每个链表都已经按升序排列。

请你将所有链表合并到一个升序链表中，返回合并后的链表。

 

示例 1：

输入：lists = [[1,4,5],[1,3,4],[2,6]]
输出：[1,1,2,3,4,4,5,6]
解释：链表数组如下：
[
  1->4->5,
  1->3->4,
  2->6
]
将它们合并到一个有序链表中得到。
1->1->2->3->4->4->5->6
示例 2：

输入：lists = []
输出：[]
示例 3：

输入：lists = [[]]
输出：[]
 

提示：

k == lists.length
0 <= k <= 10^4
0 <= lists[i].length <= 500
-10^4 <= lists[i][j] <= 10^4
lists[i] 按 升序 排列
lists[i].length 的总和不超过 10^4
```

## 题目思路

> 看题目很明显，这是 merge_sort 的考察点，使用的大多是分治的思想。虽然是 k 个升序链表，但仍可以分解为两两合并：把区间不断二分，再合并左右两半的结果即可。使用 y 神给的模板进行改写，确实十分好用。

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
    ListNode* merge_sort(ListNode* a, ListNode* b) {
        if (a == nullptr || b == nullptr) return a ? a : b;
        ListNode head, *tail = &head, *p = a, *q = b;
        while (p && q)
        {
            if (p -> val < q -> val) {
                tail -> next = p;
                p = p -> next;
            }
            else {
                tail -> next = q;
                q = q -> next;
            }
            tail = tail -> next;
        }
        tail -> next = (p ? p : q);
        return head.next;
    }

    ListNode* merge(vector <ListNode*>& lists, int l, int r) {
        if (l == r) return lists[l];
        if (l > r) return nullptr;
        int mid = (l + r) >> 1;
        return merge_sort(merge(lists, l, mid), merge(lists, mid + 1, r));
    }

    ListNode* mergeKLists(vector<ListNode*>& lists) {
        return merge(lists, 0, lists.size() - 1);
    }
};
```

## 复杂度

- 时间复杂度：O(k * logk)

- 空间复杂度：O(logk)
