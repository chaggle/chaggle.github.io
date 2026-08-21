---
title: "Day 1 989. 数组形式的整数加法"
published: 2021-09-10T10:12:05+08:00
updated: 2022-06-13T10:48:56+08:00
tags: ["leetcode"]
category: "leetcode"
---

# **[989. 数组形式的整数加法](https://leetcode-cn.com/problems/add-to-array-form-of-integer/)**

## 题目

```cpp
对于非负整数 X 而言，X 的数组形式是每位数字按从左到右的顺序形成的数组。

例如，如果 X = 1231，那么其数组形式为 [1,2,3,1]。

给定非负整数 X 的数组形式 A，返回整数 X+K 的数组形式。

示例 1：

输入：A = [1,2,0,0], K = 34
输出：[1,2,3,4]
解释：1200 + 34 = 1234
示例 2：

输入：A = [2,7,4], K = 181
输出：[4,5,5]
解释：274 + 181 = 455
示例 3：

输入：A = [2,1,5], K = 806
输出：[1,0,2,1]
解释：215 + 806 = 1021
示例 4：

输入：A = [9,9,9,9,9,9,9,9,9,9], K = 1
输出：[1,0,0,0,0,0,0,0,0,0,0]
解释：9999999999 + 1 = 10000000000


提示：

1 <= A.length <= 10000
0 <= A[i] <= 9
0 <= K <= 10000
如果 A.length > 1，那么 A[0] != 0
```

## 题目思路

- 建立一个动态数组 res，以位数的形式存储最后的结果值；
- 既可以通过对 k 取 10 的模值进行加减，也可以从后往前与 k 相加，再对相加得到的值对 10 取模；
- 如果 k 的位数大于数组所给的位数，那么循环内 k 除以 10 后余留的值必然大于 0；
- 此时需要扩展数组，由于是动态数组，直接在循环内改写为类似 k = sum / 10 的形式，即 k /= 10，直到 k 为 0 为止；
- 最后将数组逆序输出即可。

## 题目代码

### 代码块

```java
class Solution {
    public List<Integer> addToArrayForm(int[] num, int k) {
        List<Integer> res = new ArrayList<>();
        int n = num.length;
        for(int i = num.length - 1; i >= 0; i--) {
            int sum = num[i] + k % 10;
            k /= 10;
            if(sum >= 10) {
                k++;
                sum -= 10;
            }
            res.add(sum);
        }
        for(; k > 0; k /= 10) {
            res.add(k % 10);
        }
        // Collections.reverse 源码中会判断对存储的数据结构进行判断，如果支持随机存储的数据结构，默认使用的是 swap 交换元素，而如果是链表，那么默认使用的是头插法进行逆序
        Collections.reverse(res);
        return res;
    }
}
```

```cpp
class Solution {
public:
    vector<int> addToArrayForm(vector<int>& nums, int k) {
        vector<int> res;

        for(int i = nums.size() - 1; i >= 0; i--)
        {
            int sum = nums[i] + k;
            res.push_back(sum % 10);
            k = sum / 10;
        }

        while(k > 0)
        {
            res.push_back(k % 10);
            k /= 10;
        }

        reverse(res.begin(), res.end());

        return res;
    }
};
```

```go
func addToArrayForm(num []int, k int) []int {
    n := len(num)
    ans := make([]int, 0)

    for i := n - 1; i >= 0; i-- {
        v := num[i] + k;
        ans = append(ans, v % 10)
        k = v / 10

    }

    for k > 0 {
        ans = append(ans, k % 10)
        k = k / 10
    }
    
    return reverse(ans)
}

func reverse(num []int) []int {
    for i, j := 0, len(num) - 1; i <= j; {
        num[i], num[j] = num[j], num[i]
        i++
        j--
    }
    
    return num;
}
```

## 复杂度

- 空间复杂度：申请了一个常数级数组，故空间为 O(1)
- 时间复杂度：$O(max(n, \log k))$，其中 n 为数组的长度。
