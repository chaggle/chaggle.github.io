---
title: "Day 14 100. 相同的树"
published: 2021-09-23T15:32:27+08:00
updated: 2021-09-23T15:32:27+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[100. 相同的树](https://leetcode-cn.com/problems/same-tree/)**

## 题目

```cpp
给你两棵二叉树的根节点 p 和 q ，编写一个函数来检验这两棵树是否相同。

如果两个树在结构上相同，并且节点具有相同的值，则认为它们是相同的。


示例 1：

输入：p = [1,2,3], q = [1,2,3]
输出：true

示例 2：

输入：p = [1,2], q = [1,null,2]
输出：false

示例 3：

输入：p = [1,2,1], q = [1,1,2]
输出：false
 
提示：

两棵树上的节点数目都在范围 [0, 100] 内
-10^4 <= Node.val <= 10^4
```

## 题目思路

- 简单题，与昨日的解法类似，可以使用递归解决问题，也可以进行层序遍历，熟悉一下 BFS 的模板。

## 题目代码

### 代码块

```cpp
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
    bool isSameTree(TreeNode* p, TreeNode* q) {
        /* if (p == nullptr && q == nullptr) {
            return true;
        } else if (p == nullptr || q == nullptr) {
            return false;
        } else if (p->val != q->val) {
            return false;
        } else {
            return isSameTree(p->left, q->left) && isSameTree(p->right, q->right);
        } */
        if (p == nullptr && q == nullptr) return true;
        else if (p == nullptr || q == nullptr) return false;
        queue <TreeNode*> q1, q2;
        q1.push(p);
        q2.push(q);
        while (q1.empty() == 0 && q2.empty() == 0) {
            auto n1 = q1.front();
            q1.pop();
            auto n2 = q2.front();
            q2.pop();
            if (n1 -> val != n2 -> val) return false;
            auto l1 = n1 -> left, r1 = n1 -> right, l2 = n2 -> left, r2 = n2 -> right;
            if ((l1 == nullptr) ^ (l2 == nullptr)) return false;
            if ((r1 == nullptr) ^ (r2 == nullptr)) return false;
            if (l1 != nullptr) q1.push(l1);
            if (r1 != nullptr) q1.push(r1);
            if (l2 != nullptr) q2.push(l2);
            if (r2 != nullptr) q2.push(r2);
        }
        return q1.empty() && q2.empty();
    }
};
```

## 复杂度

- 时间复杂度：O(min(n, m))
- 空间复杂度：递归为 O(min(n, m))，调用栈使用的空间即为二叉树的高度；层序遍历为 O(n)，用于存放所有的节点数。
