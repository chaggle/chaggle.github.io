---
title: "284. 顶端迭代器"
published: 2021-10-05T16:23:28+08:00
updated: 2021-10-05T16:23:28+08:00
tags: ["leetcode"]
category: "leetcode"
---

# [284. 顶端迭代器](https://leetcode-cn.com/problems/peeking-iterator/)

## 题目

```cpp
请你设计一个迭代器，除了支持 hasNext 和 next 操作外，还支持 peek 操作。

实现 PeekingIterator 类：

PeekingIterator(int[] nums) 使用指定整数数组 nums 初始化迭代器。
int next() 返回数组中的下一个元素，并将指针移动到下个元素处。
bool hasNext() 如果数组中存在下一个元素，返回 true ；否则，返回 false 。
int peek() 返回数组中的下一个元素，但 不 移动指针。

示例：

输入：
["PeekingIterator", "next", "peek", "next", "next", "hasNext"]
[[[1, 2, 3]], [], [], [], [], []]
输出：
[null, 1, 2, 2, 3, false]

解释：
PeekingIterator peekingIterator = new PeekingIterator([1, 2, 3]); // [1,2,3]
peekingIterator.next();    // 返回 1 ，指针移动到下一个元素 [1,2,3]
peekingIterator.peek();    // 返回 2 ，指针未发生移动 [1,2,3]
peekingIterator.next();    // 返回 2 ，指针移动到下一个元素 [1,2,3]
peekingIterator.next();    // 返回 3 ，指针移动到下一个元素 [1,2,3]
peekingIterator.hasNext(); // 返回 False

提示：

1 <= nums.length <= 1000
1 <= nums[i] <= 1000
对 next 和 peek 的调用均有效
next、hasNext 和 peek 最多调用  1000 次
```

## 题目思路

> 简单的迭代器设计题，主要考察对迭代器的理解。常规迭代器的「访问」只支持两种操作：
>
> - hasNext() 操作：如果存在下一元素，返回 true，否则返回 false。实现上，就是判断游标是否到达结尾位置；
> - next() 操作：返回下一元素（当不存在下一元素时，返回 null）。实现上，就是返回游标指向的元素，并让游标后移。

## 题目代码

```cpp
/*
 * Below is the interface for Iterator, which is already defined for you.
 * **DO NOT** modify the interface for Iterator.
 *
 *  class Iterator {
 *  struct Data;
 *   Data* data;
 *  public:
 *  Iterator(const vector<int>& nums);
 *   Iterator(const Iterator& iter);
 *
 *   // Returns the next element in the iteration.
 *  int next();
 *
 *   // Returns true if the iteration has more elements.
 *  bool hasNext() const;
 * };
 */

class PeekingIterator : public Iterator {
private:
    int _next;
    bool _hasNext;

public:
 PeekingIterator(const vector<int>& nums) : Iterator(nums) {
     // Initialize any member here.
     // **DO NOT** save a copy of nums and manipulate it directly.
     // You should only use the Iterator interface methods.
     _hasNext = Iterator::hasNext();
        if(_hasNext) _next = Iterator::next();
 }

    // Returns the next element in the iteration without advancing the iterator.
 int peek() {
        return _next;
 }

 // hasNext() and next() should behave the same as in the Iterator interface.
 // Override them if needed.
 int next() {
     int dummy = _next;
        _hasNext = Iterator::hasNext();
        if(_hasNext) _next = Iterator::next();
        return dummy;
 }

 bool hasNext() const {
     return _hasNext;
 }
};
```

## 复杂度

- 时间复杂度：O(n)
- 空间复杂度：O(n)
