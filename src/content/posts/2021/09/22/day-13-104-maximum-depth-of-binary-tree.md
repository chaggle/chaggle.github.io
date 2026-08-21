---
title: "Day 13 104. 二叉树的最大深度"
published: 2021-09-22T16:42:13+08:00
updated: 2021-09-22T16:42:13+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[104. 二叉树的最大深度](https://leetcode-cn.com/problems/maximum-depth-of-binary-tree/)**

## 题目

```cpp
给定一个二叉树，找出其最大深度。

二叉树的深度为根节点到最远叶子节点的最长路径上的节点数。

说明: 叶子节点是指没有子节点的节点。

示例：
给定二叉树 [3,9,20,null,null,15,7]，
    3
   / \
  9  20
    /  \
   15   7
返回它的最大深度 3 。
```

## 题目思路

- 简单题，可以使用递归解决问题，也可以进行层序遍历，顺便熟悉一下 BFS 的模板。

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
    int maxDepth(TreeNode* root) {
        /* if (root == nullptr) return 0;
        int l, r;
        l = maxDepth(root -> left);
        r = maxDepth(root -> right);
        return max(l, r) + 1; */
        //以下为BFS
        queue<TreeNode* > q;
        if (root == nullptr) return 0;
        q.push(root);
        int tmp = 0;
        while(q.empty() == 0)
        {
            int n = q.size();
            tmp++;
            for(int i = 0; i < n; i++)
            {
                TreeNode* res = q.front();
                q.pop();
                if(res -> left != nullptr) q.push(res -> left);
                if(res -> right != nullptr) q.push(res -> right);
            }
        }
        return tmp;
    }
};
```

## 复杂度

- 时间复杂度：O(n)，因为要遍历所有节点，层序遍历时间复杂度也是 O(n)；
- 空间复杂度：递归为 O(height)，调用栈使用的空间即为二叉树的高度；层序遍历为 O(n)，用于存放所有的节点数。
