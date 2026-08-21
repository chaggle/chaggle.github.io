---
title: "Day 9 109. 有序链表转换二叉搜索树"
published: 2021-09-18T16:17:01+08:00
updated: 2021-09-18T16:17:01+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[109. 有序链表转换二叉搜索树](https://leetcode-cn.com/problems/convert-sorted-list-to-binary-search-tree/)**

## 题目

```cpp
给定一个单链表，其中的元素按升序排序，将其转换为高度平衡的二叉搜索树。

本题中，一个高度平衡二叉树是指一个二叉树每个节点 的左右两个子树的高度差的绝对值不超过 1。

示例:

给定的有序链表： [-10, -3, 0, 5, 9],

一个可能的答案是：[0, -3, 9, -10, null, 5], 它可以表示下面这个高度平衡二叉搜索树：

      0
     / \
   -3   9
   /   /
 -10  5
```

## 题目思路

- 本题相当于将链表转化为一棵二叉搜索树（Binary Search Tree，BST）；
- 基于中序遍历恢复二叉搜索树，即可从任意节点出发，以节点左边的升序序列作为左子树，右边的升序序列作为右子树。本题要求高度平衡，即左右子树高度差至多为 1，所以从链表的中点开始建树最好；
- 本题也可以用 BFS 建树、DFS 填节点值，但这样空间复杂度较高，在时间复杂度与递归链表差不多的情况下，确实不是特别优秀的解法，不过也可以用来熟悉一下 DFS 与 BFS。

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
/**
 * Definition for a binary tree node.
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode() : val(0), left(nullptr), right(nullptr) {}
 *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
 *     TreeNode(int x, TreeNode *left, TreeNode *right) :
        val(x), left(left), right(right) {}
 * };
 */
class Solution {
public:
    TreeNode* sortedListToBST(ListNode* head) {
        if(head == nullptr) return nullptr;
        if(head -> next == nullptr)
        {
            TreeNode* root = new TreeNode(head -> val);
            return root;
        }
        ListNode* fast = head;
        int len = 1;
        while(fast -> next != nullptr)
        {
            fast = fast -> next;
            len++;
        }
        len = len >> 1;
        ListNode* slow = head;
        ListNode* p = slow;
        while(len--)
        {
            p = slow;
            slow = slow -> next;
        }
        p -> next = nullptr;
        TreeNode* root = new TreeNode(slow -> val);
        root -> left = sortedListToBST(head);
        root -> right = sortedListToBST(slow -> next);
        return root;
    }
};
```

## 复杂度

- 时间复杂度：O(log n)
- 空间复杂度：O(1)
