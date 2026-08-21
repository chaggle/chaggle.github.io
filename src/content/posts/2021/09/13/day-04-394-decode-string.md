---
title: "Day 4 394. 字符串解码"
published: 2021-09-13T11:17:33+08:00
updated: 2021-09-13T11:17:33+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[394. 字符串解码](https://leetcode-cn.com/problems/decode-string/)**

## 题目

```cpp
给定一个经过编码的字符串，返回它解码后的字符串。

编码规则为: k[encoded_string]，表示其中方括号内部的 encoded_string 正好重复 k 次。

注意 k 保证为正整数。

你可以认为输入字符串总是有效的；输入字符串中没有额外的空格，且输入的方括号总是符合格式要求的。

此外，你可以认为原始数据不包含数字，所有的数字只表示重复的次数 k 。

例如不会出现像 3a 或 2[4] 的输入。

 

示例 1：

输入：s = "3[a]2[bc]"
输出："aaabcbc"
示例 2：

输入：s = "3[a2[c]]"
输出："accaccacc"
示例 3：

输入：s = "2[abc]3[cd]ef"
输出："abcabccdcdcdef"
示例 4：

输入：s = "abc3[cd]xyz"
输出："abccdcdcdxyz"
```

## 题目思路

- 创建一个 stack<string> 辅助栈，以及最终返回值 string 类型的 res，初始化为空；
- [ 之前的数字可能不止一位，所以要设置一个 sum 表示其之前数字的总和；
- 字符串题有大小写的区别，所以要注意大小写；
- 可以结合代码中的注释理解。

## 题目代码

### 代码块

```cpp
class Solution {
public:
    string decodeString(string s) {
        stack<string> pos;
        stack<int> nums;
        string res = "";
        int sum = 0;
        for(int i = 0; i < s.size(); i++)
        {
            if(isdigit(s[i]))
            //if(s[i] >= '0' && s[i] <= '9')
                sum = sum * 10 + s[i] - '0';
            else if(isalpha(s[i]))
                //if((s[i] >= 'a' && s[i] <= 'z')||(s[i] >= 'A' && s[i] <= 'Z'))
                res += s[i]; //注意大小写，之前第一次提交发现大小写也存在区分
            else if(s[i] == '[')
            {
                nums.push(sum);
                sum = 0;    //重置 0
                pos.push(res);
                res = "";   //重置为空字符串
            }
            else if(s[i] == ']')   //此处举例3[a2[c]];
            {       //出现[后将3放入nums中，sum重置，res仍为""
                sum = nums.top();  //而后再出现[，此时sum=2;res="a",存入pos
                nums.pop();    //第一次出现], 此时sum = nums.top() == 2
                while(sum)    //pos.top = a, res = 'c',输出为res = "acc"
                {      //第二次出现],sum = nums.top() == 3;
                    pos.top() += res;  //pos.top = "" 第一次存入的res, res ="acc",
                    sum--;    //画图更好理解，sum经历变化后的值最终始终为0
                }
                res = pos.top();
                pos.pop();
            }
        }
        return res;
    }
};
```

## 复杂度

- 时间复杂度：一次遍历 O(s.size)，其中的 while 循环应该是常数级；
- 空间复杂度：O(s.size)。
