---
title: "Day 17 297. 二叉树的序列化与反序列化"
published: 2021-09-26T17:00:13+08:00
updated: 2021-09-26T17:00:13+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[297. 二叉树的序列化与反序列化](https://leetcode-cn.com/problems/serialize-and-deserialize-binary-tree/)**

## 题目

```cpp
序列化是将一个数据结构或者对象转换为连续的比特位的操作，

进而可以将转换后的数据存储在一个文件或者内存中，同时也可以通过网络传输到另一个计算机环境，

采取相反方式重构得到原数据。

请设计一个算法来实现二叉树的序列化与反序列化。

这里不限定你的序列 / 反序列化算法执行逻辑，

你只需要保证一个二叉树可以被序列化为一个字符串并且将这个字符串反序列化为原始的树结构。

提示: 输入输出格式与 LeetCode 目前使用的方式一致，

详情请参阅 LeetCode 序列化二叉树的格式。

你并非必须采取这种方式，你也可以采用其他的方法解决这个问题。

示例 1：

输入：root = [1,2,3,null,null,4,5]
输出：[1,2,3,null,null,4,5]

示例 2：

输入：root = []
输出：[]

示例 3：

输入：root = [1]
输出：[1]

示例 4：

输入：root = [1,2]
输出：[1,2]
 

提示：

树中结点数在范围 [0, 10^4] 内
-1000 <= Node.val <= 1000
```

## 题目思路

- 本质上还是 DFS 与 BFS 的题目，但此题难度较大，所以花费时间较长；
- DFS 有前序、后序两种递归形式，后序遍历因为时间限制暂时没有写；而中序遍历由于无法确定根节点，所以无法形成递归形式。

## 题目代码

### 代码块

```cpp
/**
 * Definition for a binary tree node.
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode(int x) : val(x), left(NULL), right(NULL) {}
 * };
 */
class Codec {
public:
    /* void predfs(TreeNode* root, string& data)
    {
        if(root == nullptr) data += "null,";
        else
        {
            data += to_string(root -> val) + ",";
            predfs(root -> left, data);
            predfs(root -> right, data);
        }
    }

    string serialize(TreeNode* root)
    {
        string data;
        predfs(root, data);
        return data;
    }

    TreeNode* rdfs(list<string>& str)
    {
        if (str.front() == "null")
        {
            str.erase(str.begin());
            return nullptr;
        }
        TreeNode* root = new TreeNode(stoi(str.front()));
        str.erase(str.begin());
        root -> left = rdfs(str);
        root -> right = rdfs(str);
        return root;
    }

    TreeNode* deserialize(string data)
    {
        list<string> str;
        string s;
        for (auto& ch : data)
        {
            if (ch == ',')
            {
                str.push_back(s);
                s.clear();
            }
            else s.push_back(ch);
        }
        if (s.empty() != 0)
        {
            str.push_back(s);
            s.clear();
        }
        return rdfs(str);
    } */
    string serialize(TreeNode* root) {
        string ans;
        queue<TreeNode* > q;
        if(root == nullptr) return ans;
        else q.push(root);
        while(!q.empty())
        {
            int n = q.size();
            for(int i = 0; i < n; ++i){
                auto node = q.front();
                q.pop();
                if(node == nullptr) ans += "null,";
                else
                {
                    ans += to_string(node->val) + ",";
                    q.push(node->left);
                    q.push(node->right);
                }
            }
        }
        return ans;
    }
    TreeNode* deserialize(string data) {
        if(data.empty()) return NULL;
        vector<TreeNode* > ans;
        int k = 0;
        int n = data.size();
        while(k < n)
        {
            string tmp;
            while(data[k] != ',')
            {
                tmp += data[k];
                k++;
            }
            if(tmp == "null") ans.push_back(NULL);
            else ans.push_back(new TreeNode(stoi(tmp)));
            tmp.clear();
            k++;
        }
        int pos = 1;
        for(int i = 0; i < ans.size(); i++)
        {
            if(ans[i] == NULL) continue;
            ans[i] -> left = ans[pos++];
            ans[i] -> right = ans[pos++];
        }
        return ans[0];
    }
};
// Your Codec object will be instantiated and called as such:
// Codec ser, deser;
// TreeNode* ans = deser.deserialize(ser.serialize(root));
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
