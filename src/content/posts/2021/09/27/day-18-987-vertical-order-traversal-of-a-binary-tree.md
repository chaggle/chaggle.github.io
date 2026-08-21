---
title: "Day 18 987. 二叉树的垂序遍历"
published: 2021-09-27T15:45:43+08:00
updated: 2021-09-27T15:45:43+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[987. 二叉树的垂序遍历](https://leetcode-cn.com/problems/vertical-order-traversal-of-a-binary-tree/)**

## 题目

```cpp
给你二叉树的根结点 root ，

请你设计算法计算二叉树的 垂序遍历 序列。

对位于 (row, col) 的每个结点而言，

其左右子结点分别位于 (row + 1, col - 1) 和 (row + 1, col + 1) 。

树的根结点位于 (0, 0) 。

二叉树的垂序遍历从最左边的列开始直到最右边的列结束，

按列索引每一列上的所有结点，形成一个按出现位置从上到下排序的有序列表。

如果同行同列上有多个结点，则按结点的值从小到大进行排序。

返回二叉树的 垂序遍历 序列。

示例 1：

输入：root = [3,9,20,null,null,15,7]
输出：[[9],[3,15],[20],[7]]
解释：
列 -1 ：只有结点 9 在此列中。
列  0 ：只有结点 3 和 15 在此列中，按从上到下顺序。
列  1 ：只有结点 20 在此列中。
列  2 ：只有结点 7 在此列中。

示例 2：

输入：root = [1,2,3,4,5,6,7]
输出：[[4],[2],[1,5,6],[3],[7]]
解释：
列 -2 ：只有结点 4 在此列中。
列 -1 ：只有结点 2 在此列中。
列  0 ：结点 1 、5 和 6 都在此列中。
          1 在上面，所以它出现在前面。
          5 和 6 位置都是 (2, 0) ，所以按值从小到大排序，5 在 6 的前面。
列  1 ：只有结点 3 在此列中。
列  2 ：只有结点 7 在此列中。

示例 3：

输入：root = [1,2,3,4,6,5,7]
输出：[[4],[2],[1,5,6],[3],[7]]
解释：
这个示例实际上与示例 2 完全相同，只是结点 5 和 6 在树中的位置发生了交换。
因为 5 和 6 的位置仍然相同，所以答案保持不变，仍然按值从小到大排序。
 
提示：

树中结点数目总数在范围 [1, 1000] 内
0 <= Node.val <= 1000
```

## 题目思路

- 本质上还是 DFS 与 BFS 的题目，只是解决问题的方式要麻烦一点，所以花费时间较长；本质应属于中等题，算不上难度大的题目；
- DFS 采用哈希表加优先队列实现。由于 C++ 的 priority_queue 默认实现为大根堆，而此题需要小根堆，所以使用 multiset（小根堆）实现；
- BFS 解法留待考研后再写，现在每天思考题目一个小时，时间上已经太多了。

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
    typedef map<int, multiset<pair<int, int>>> maps;
    void dfs(TreeNode* root, int x, int y, maps &mp)
    {
        if(root == nullptr) return;
        mp[y].insert({x, root->val});
        if(root -> left ) dfs(root -> left, x + 1, y - 1, mp);
        if(root -> right) dfs(root -> right, x + 1, y + 1, mp);
    }
    vector<vector<int>> verticalTraversal(TreeNode* root)
    {
        maps mp;
        dfs(root, 0, 0, mp);
        vector<vector<int>> ans;
        for(auto & [k, v] : mp)
        {
            vector<int> vs;
            for(auto & p : v) vs.push_back(p.second);
            ans.push_back(vs);
        }
        return ans;
    }
};
```

## 复杂度

- 时间复杂度：O(n\*logn)
- 空间复杂度：O(n)
