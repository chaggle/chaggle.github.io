---
title: "Day 87 23. 合并K个升序链表"
published: 2021-12-05T21:29:57+08:00
updated: 2021-12-05T21:29:57+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[23. 合并 K 个升序链表](https://leetcode-cn.com/problems/merge-k-sorted-lists/)**

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

> 本题目在 day 69 时使用分治的思想做过，今日使用小顶堆解决：用优先队列每次取出当前最小的节点接入结果链表，再将其后继节点入队。这两日时间花费有些多，故今日不手写堆。

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
    ListNode* mergeKLists(vector<ListNode*>& lists) {
        auto min = [](ListNode *a, ListNode *b)
        {
            return a -> val > b -> val;
            };
        priority_queue<ListNode*, vector<ListNode*>, decltype(min)> ans(min);
        auto *root = new ListNode();
        for(auto p:  lists)
        {
            if(p != nullptr) ans.push(p);
        }
        ListNode *cur = root;
        while(!ans.empty())
        {
            ListNode *tmp = ans.top(); ans.pop();
            if(tmp -> next != nullptr) ans.push(tmp->next);
            tmp -> next = cur -> next;
            cur -> next = tmp;
            cur = cur -> next;
        }
        return root -> next;
    }
};
```

## 复杂度

- 时间复杂度：O(logn)
- 空间复杂度：O(n)
