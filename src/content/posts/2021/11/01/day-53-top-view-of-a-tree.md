---
title: "Day 53 Top View of a Tree"
published: 2021-11-01T17:29:48+08:00
updated: 2021-11-01T17:29:48+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[Top View of a Tree](https://binarysearch.com/problems/Top-View-of-a-Tree)**

## 题目

```cpp
Given a binary tree root,

 return the top view of the tree, sorted left-to-right.

Constraints

n ≤ 100,000 where n is the number of nodes in root

Example 1

Input
root = [1, [2, null, [4, null, [5, null, [6, null,
       [7, null, null]]]]], [3, null, null]]

Output
[2, 1, 3, 6, 7]

Explanation

Note that directly above 4 is 1 and directly above 5 is 3

so these are not part of the top view.

Example 2
Input
root = [3, [1, [0, null, null], [2, null, null]], [4, null, null]]
Output
[0, 1, 3, 4]
```

## 题目思路

- 题目要求返回树的顶视图（Top View），并按从左到右排序。俯视视角下，上层的节点会遮挡下层节点：覆盖自己左孩子节点的右孩子节点，以及自己右孩子节点的左孩子节点都是看不见的。因此只要 y 值（层级）相同，同一层只需加入其中 x 值最大和最小的那两个节点。

## 题目代码

```cpp
/**
 * class Tree {
 *     public:
 *         int val;
 *         Tree *left;
 *         Tree *right;
 * };
 */
void dfs(Tree* root, int x, int y, map<int, pair<int, int>>& up) {
    if(root == nullptr) return;
    if(up.find(x) == up.end() || up[y].first > h) up[x] = {h, root -> val};

    dfs(root -> left, x - 1, h + 1, up);
    dfs(root -> right, x + 1, h + 1, up);
}

vector<int> solve(Tree* root) {
    map<int, pair<int, int>> up;
    dfs(root, 0, 0, up);
    vector<int> ans;
    for (auto [k, v] : up) {
        ans.push_back(v.second);
    }
    return ans;
}
```

## 复杂度

- 时间复杂度：O(nlogn)

- 空间复杂度：O(n)
