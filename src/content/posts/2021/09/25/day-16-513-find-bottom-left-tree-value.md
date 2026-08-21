---
title: "Day 16 513. 找树左下角的值"
published: 2021-09-25T15:13:58+08:00
updated: 2021-09-25T15:13:58+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[513. 找树左下角的值](https://leetcode-cn.com/problems/find-bottom-left-tree-value/)**

## 题目

```cpp
给定一个二叉树的 根节点 root，请找出该二叉树的 最底层 最左边 节点的值。

假设二叉树中至少有一个节点。

示例 1:

输入: root = [2,1,3]
输出: 1

示例 2:

输入: root = [1,2,3,4,null,5,6,null,null,7]
输出: 7

提示:

二叉树的节点个数的范围是 [1,10^4]
-2^31 <= Node.val <= 2^31 - 1 

```

## 题目思路

- DFS 与 BFS 题目，DFS 变式多，BFS 单一，更简单。

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
    /* int findBottomLeftValue(TreeNode* root) {
        queue<TreeNode* > q;
        if(root != NULL) q.push(root);
        int result = 0;
        while (!q.empty())
        {
            int n = q.size();
            for (int i = 0; i < n; i++)
            {
                TreeNode* node = q.front();
                q.pop();
                if(i == 0) result = node->val;
                if(node -> left != nullptr) q.push(node -> left);
                if(node -> right != nullptr) q.push(node -> right);
            }
        }
        return result; */
        int len = INT_MIN;
        int value;
        void dfs(TreeNode* root, int deep)
        {
            if(root != nullptr)
            {
                if(root -> left == nullptr && root -> right == nullptr)
                {
                    if(deep > len)
                    {
                        len = deep;
                        value = root -> val;
                    }
                    return;
                }
                dfs(root -> left, deep + 1);
                dfs(root -> right, deep + 1);
            }
            return;
        }
    int findBottomLeftValue(TreeNode* root)
    {
        dfs(root, 0);
        return value;
    }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
