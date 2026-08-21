---
title: "Day 79 814. 二叉树剪枝"
published: 2021-11-27T00:10:45+08:00
updated: 2021-11-27T00:10:45+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[814. 二叉树剪枝](https://leetcode-cn.com/problems/binary-tree-pruning/)**

## 题目

```cpp
给你二叉树的根结点 root ，此外树的每个结点的值要么是 0 ，要么是 1 。

返回移除了所有不包含 1 的子树的原二叉树。

节点 node 的子树为 node 本身加上所有 node 的后代。


示例 1：


输入：root = [1,null,0,0,1]
输出：[1,null,0,null,1]
解释：
只有红色节点满足条件"所有不包含 1 的子树"。 右图为返回的答案。
示例 2：


输入：root = [1,0,1,0,0,0,1]
输出：[1,null,1,null,1]

示例 3：

输入：root = [1,1,0,1,1,0,1,0]
输出：[1,1,0,1,1,null,1]

提示：

树中节点的数目在范围 [1, 200] 内
Node.val 为 0 或 1
```

## 题目思路

> 二叉树递归的典型想法：dfs 返回以当前节点为根的子树节点值之和，左子树之和为 0 则剪掉左子树，右子树同理；若整棵子树之和为 0，则整棵树被剪掉。

## 题目代码

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
    int dfs(TreeNode* root) {
        if(!root) return 0;
        auto l = dfs(root -> left);
        auto r = dfs(root -> right);
        if(!l) root -> left = nullptr;
        if(!r) root -> right = nullptr;
        return root -> val + l + r;
    }
    TreeNode* pruneTree(TreeNode* root) {
        return dfs(root) != 0 ? root : nullptr;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
