---
title: "C++ STL 容器学习笔记"
published: 2026-08-11T00:00:00+08:00
updated: 2026-08-11T00:00:00+08:00
tags: ["2026", "STL", "C++", "map", "set", "priority_queue"]
category: "cpp"
---

> 2020-2021 年算法刷题时期学习的 C++ STL 容器笔记（map、priority_queue/multiset、unordered_map、unordered_set）合并整理。除了 bitset、priority_queue（堆）以及 AVL（平衡树相关）之外，其他的都可以进行短时间的手撕代码实现，但熟悉容器用法依然是刷题效率的基础。

## map（有序映射）

### map 简介

map 是 STL（Standard Template Library，标准模板库）的一个关联容器。

> 1. 可以将任何基本类型映射到任何基本类型。如 int array[100] 事实上就是定义了一个 int 型到 int 型的映射
> 2. map 提供一对一的数据处理，key-value 键值对，其类型可以自己定义，第一个称为关键字，第二个为关键字的值
> 3. map 内部是自动排序的

使用 map 前必须引入头文件 `#include <map>`。

### map 的定义

`map<type1name, type2name> maps;`，第一个是键的类型，第二个是值的类型：

```cpp
map<string, int> maps;
```

### map 容器内元素的访问

> - 通过下标进行访问：`maps['c'] = 5;`
> - 通过迭代器进行访问

map 可以使用 `it->first` 来访问键，使用 `it->second` 访问值：

```cpp
#include <map>
#include <iostream>
using namespace std;
int main()
{
   map<char,int> maps;
   maps['a'] = 10;
   maps['b'] = 20;
   maps['c'] = 30;
   for(map<char,int>::iterator it=maps.begin(); it!=maps.end(); it++)
   {
       cout<<it -> first<<" "<<it -> second<<endl;
   }
   return 0;
}
```

### map 的常用用法

- maps.insert() 插入：

```cpp
// 定义一个map对象
map<int, string> m;

//用insert函数插入pair
m.insert(pair<int, string>(11, "kk"));

// 用insert函数插入value_type数据
m.insert(map<int, string>::value_type(22, "pp"));

// 用数组方式插入
m[12] = "dd";
m[34] = "ff";
```

- maps.find() 查找一个元素
- maps.clear() 清空
- maps.erase() 删除一个元素
- maps.size() 长度
- maps.begin() 返回指向 map 头部的迭代器
- maps.end() 返回指向 map 末尾的迭代器
- maps.rbegin() 返回指向 map 尾部的逆向迭代器
- maps.rend() 返回指向 map 头部的逆向迭代器
- maps.empty() 判断其是否为空
- maps.swap() 交换两个 map

```cpp
map<string, int>::iterator it;

it=maps.find("123");

//迭代器删除
it = maps.find("123");
maps.erase(it);

//关键字删除
int n = maps.erase("123"); //如果删除了返回1，否则返回0

//用迭代器范围删除 : 把整个map清空
maps.erase(maps.begin(), maps.end());
//等同于maps.clear()

int len = maps.size(); //获取到map中映射的个数

//迭代
map<string, int>::iterator it;
for(it = maps.begin(); it != maps.end(); it++)
    cout<< it-> first<<" "<<it -> second<<endl;//输出key 和value值

//反向迭代
map<string,int>::reverse_iterator it;
for(it = maps.rbegin(); it != maps.rend(); it++)
    cout<<it -> first<<' '<<it -> second<<endl;
```

## priority_queue 与 multiset（堆与平衡树）

### priority_queue 堆 / 优先队列

```cpp
定义：

priority_queue<T>
priority_queue<int> 大根堆
priority_queue<int, vector<int>, less<int> > 大根堆
priority_queue<int, vector<int>, greater<int> > 小根堆
priority_queue <struct T>

基本函数：

push(x)：加入一个元素，可以是数 or 结构体
pop()：弹出堆顶
top()：堆顶的元素
size()：堆的大小
empty()：是否为空（空即为 1）

关于结构体的比较：

struct type
{
	int x,y;
	friend bool operator < (type left, type right)
    {
        return left.x < right.x;
    }
};
结构体的赋值可以为{a,b,...}或名称{a,b,...}
```

### multiset

```cpp
multiset vs set
    multiset 可以有重复元素，故一般情况下，（除解决重复元素的集合类问题）都用 multiset
	multiset 也进行自实现排序。

定义：

multiset<T>
multiset<int> 从小到大
multiset<int, less<int> > less<int>表示数字大的优先级大
multiset<int, greater<int> > greater<int>表示数字小的优先级大
multiset<struct T>

迭代器：

multiset<定义和对应的 set 一致> ::iterator，其作用是遍历 set/特别指向某一个元素

基本函数：

insert(x)：加入一个元素，可以是数/结构体
erase(x)：当x为数或结构体，即为删掉所有的x；当x 为迭代器，那么只会删掉迭代器对应的元素
begin()：返回关键值最小的元素指针，指针x对应的值为 *x，如果是结构体则为（*x）.a
end()：返回关键值最大的元素指针的后一位（最大的是end()--）
size(), empty()：同优先队列
lower_bound(x)：第一个大于等于 x 的元素指针
upper_bound(x)：第一个大于 x 的元素指针

multiset<T> st
st.insert(1);
st.insert(2);
st.insert(3);
st.insert(4);
st.insert(5);
cout<<*st.lower_bound(3)<<" " <<*st.upper_bound(3)<<endl;    //>= >
cout<<*--st.lower_bound(3)<<" "<<*--st.upper_bound(3)<<endl; //< <=
//3 4
//2 3

遍历：
可以通过迭代器的移动来遍历（头为 begin()，尾为--end()，最大能走到 end()）

st.insert(1);
st.insert(2);
st.insert(3);
auto a = st.begin();
while (a != st.end())
{
    cout<< *a <<" ";
    ++a;
	cout<<endl;
}
//1 2 3区别
//multiset可以遍历、前驱、后继、删除；
//而priority_queue的比较机制和set/sort相反
```

### 完整示例程序

```cpp
#include <algorithm>
#include <iostream>
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <queue>
#include <set>

#define fo(a, b, c) for (a = b; a <= c; a++)
#define fd(a, b, c) for (a = b; a >= c; a--)

using namespace std;

struct type
{
	int x,y;
	friend bool operator < (type left, type right)
    {
        return left.x < right.x;//此处不能重载大于号，在数学上来说重载小于号的作用更好
    }
};

multiset<type> a;
priority_queue<type> b;
type c[3];

int main()
{
    a.insert({3,3});
    a.insert({2,2});
    a.insert({1,1});
    b.push({1,1});
    b.push({2,2});
    b.push({3,3});
    c[0] = {3,3};
    c[1] = {2,2};
    c[2] = {1,1};
    sort(c, c + 3);
    cout << (*a.begin()).x <<" " << b.top().x << " " << c[0].x << endl;
    //1 3 1
}
```

可以发现，priority_queue 得到的结果和 multiset/sort 刚好相反。

实际上 multiset 与 sort 的最终状态满足 a1 < a2 < a3 < ... < an（< 可重载）。

而 priority_queue 应该是当一个元素 x 满足 f(a[x]) < x 时交换，实质上维护的是大根堆。

> 优先队列 ⇔ 排序后为先大后小。

## unordered_map（哈希表实现的映射）

> unordered_map 是一个关联容器，内部采用的是 hash 表结构，拥有快速检索的功能。

### 特性

> 1. 关联性：通过 key 去检索 value，而不是通过绝对地址（和顺序容器不同）
> 2. 无序性：使用 hash 表存储，内部无序
> 3. Map：每个值对应一个键值
> 4. 键唯一性：不存在两个元素的键一样
> 5. 动态内存管理：使用内存管理模型来动态管理所需要的内存空间

### 模板

```cpp
template < class Key,                                    // unordered_map::key_type
           class T,                                      // unordered_map::mapped_type
           class Hash = hash<Key>,                       // unordered_map::hasher
           class Pred = equal_to<Key>,                   // unordered_map::key_equal
           class Alloc = allocator< pair<const Key,T> >  // unordered_map::allocator_type
           > class unordered_map;
```

一般只使用模板前 2 个参数 `<Key, T>`，即 `unordered_map<const Key, T> map;`。

### 迭代器

unordered_map 的迭代器是一个指针，指向这个元素，通过迭代器来取得它的值：

```cpp
unordered_map<Key, T>::iterator it;
(*it).first;             // the key value (of type Key)
(*it).second;            // the mapped value (of type T)
(*it);                   // the "element value" (of type pair<const Key,T>)

it -> first;  key       // 它的键值分别是迭代器的first和second属性
it -> second; T
```

### 构造函数

> unordered_map 的构造方式有几种：构造空的容器、复制构造、范围构造、用数组构造

```cpp
#include <iostream>
#include <string>
#include <unordered_map>
using namespace std;

typedef unordered_map<string, string> stringmap;

stringmap merge(stringmap a, stringmap b)
{
    stringmap temp(a);
    temp.insert(b.begin(), b.end());
    return temp;
}

int main()
{
    stringmap first;                                                // 空
    stringmap second({{"apple", "red"}, {"lemon", "yellow"}});      // 用数组初始
    stringmap third({{"orange", "orange"}, {"strawberry", "red"}}); // 用数组初始
    stringmap fourth(second);                                       // 复制初始化
    stringmap fifth(merge(third, fourth));                          // 移动初始化
    stringmap sixth(fifth.begin(), fifth.end());                    // 范围初始化

    cout << "sixth contains:";
    for (auto &x : sixth)
        cout << " " << x.first << ":" << x.second;
    cout << endl;
    return 0;
}
```

输出结果：

```text
sixth contains: apple:red lemon:yellow orange:orange strawberry:red
```

### 常用成员函数

- size()：返回 unordered_map 的大小
- empty()：为空返回 true，不为空返回 false，和用 size() == 0 判断一样
- find()：查找 key 所在的元素。找到：返回元素的迭代器，通过迭代器的 second 属性获取值；没找到：返回 unordered_map::end
- insert()：复制插入（复制一个已有的 pair 的内容）、数组插入（直接插入一个初始化数组）、范围插入（复制一个起始迭代器和终止迭代器中间的内容）、数组访问模式插入（和数组的 [] 操作很相似）
- at()：查找 key 所对应的值。如果存在：返回 key 对应的值，可以直接修改，和 [] 操作一样；如果不存在：抛出 out_of_range 异常
- erase()：通过位置（迭代器）、通过 key、通过范围（两个迭代器）
- clear()：清空 unordered_map
- swap()：`void swap(unordered_map& ump);` 交换两个 unordered_map（整个交换两个 map 中的所有元素）

```cpp
#include <iostream>
#include <string>
#include <unordered_map>
using namespace std;

void display(unordered_map<string, double> myrecipe, string str)
{
    cout << str << endl;
    for (auto &x : myrecipe)
        cout << x.first << ": " << x.second << endl;
    cout << endl;
}

int main()
{
    unordered_map<string, double> myrecipe, mypantry = {
        {"milk", 2.0},
        {"flour", 1.5}
    };

    pair<string, double> myshopping("baking powder", 0.3);

    myrecipe.insert(myshopping);                             // 复制插入
    myrecipe.insert(make_pair<string, double>("eggs", 6.0)); // 移动插入
    myrecipe.insert(mypantry.begin(), mypantry.end());       // 范围插入
    myrecipe.insert({{"sugar", 0.8}, {"salt", 0.1}});        // 初始化数组插入
    myrecipe["coffee"] = 10.0;                               // 数组形式插入

    display(myrecipe, "myrecipe contains:");

    /****************查找*****************/
    unordered_map<string, double>::const_iterator got = myrecipe.find("coffee");
    if (got == myrecipe.end())
        cout << "not found";
    else
        cout << "found " << got->first << " is " << got->second << "\n\n";

    /****************修改*****************/
    myrecipe.at("coffee") = 9.0;
    myrecipe["milk"] = 3.0;
    display(myrecipe, "After modify myrecipe contains:");

    /****************擦除*****************/
    myrecipe.erase(myrecipe.begin()); //通过位置
    myrecipe.erase("milk");           //通过key
    display(myrecipe, "After erase myrecipe contains:");

    /****************交换*****************/
    myrecipe.swap(mypantry);
    display(myrecipe, "After swap with mypantry, myrecipe contains:");

    /****************清空*****************/
    myrecipe.clear();
    display(myrecipe, "After clear, myrecipe contains:");
    return 0;
}
```

输出结果：

```text
myrecipe contains:
salt: 0.1
milk: 2
flour: 1.5
coffee: 10
eggs: 6
sugar: 0.8
baking powder: 0.3

found coffee is 10

After modify myrecipe contains:
salt: 0.1
milk: 3
flour: 1.5
coffee: 9
eggs: 6
sugar: 0.8
baking powder: 0.3

After erase myrecipe contains:
flour: 1.5
coffee: 9
eggs: 6
sugar: 0.8
baking powder: 0.3

After swap with mypantry, myrecipe contains:
flour: 1.5
milk: 2

After clear, myrecipe contains:
```

### begin() / end()

> begin()：返回开始的迭代器；begin(int n)：返回 n 号 bucket 的第一个迭代器
>
> end()：返回结束位置的迭代器；end(int n)：返回 n 号 bucket 的最后一个迭代器

### bucket（桶）操作

> - bucket()：返回通过哈希计算 key 所在的 bucket。此处仅使用哈希计算确定 bucket，不保证 key 一定存在 bucket 中
> - bucket_count()：返回 bucket 的总数
> - bucket_size()：返回第 i 个 bucket 的大小。此位置的桶里的元素数量，但是函数并不会判断 n 是否在 count 范围内

```cpp
#include <iostream>
#include <string>
#include <unordered_map>
using namespace std;

int main()
{
    unordered_map<string, string> mymap =
    {
            {"house", "maison"},
            {"apple", "pomme"},
            {"tree", "arbre"},
            {"book", "livre"},
            {"door", "porte"},
            {"grapefruit", "pamplemousse"}
    };

    /************begin和end迭代器***************/
    cout << "mymap contains:";
    for (auto it = mymap.begin(); it != mymap.end(); ++it)
        cout << " " << it->first << ":" << it->second;
    cout << endl;

    /************bucket操作***************/
    unsigned n = mymap.bucket_count();
    cout << "mymap has " << n << " buckets.\n";

    for (unsigned i = 0; i < n; ++i)
    {
        cout << "bucket #" << i << "'s size:"
             << mymap.bucket_size(i) << " contains: ";
        for (auto it = mymap.begin(i); it != mymap.end(i); ++it)
            cout << "[" << it->first << ":" << it->second << "] ";
        cout << "\n";
    }

    cout << "\nkey:'apple' is in bucket #" << mymap.bucket("apple") << endl;
    cout << "\nkey:'computer' is in bucket #" << mymap.bucket("computer") << endl;
    return 0;
}
```

输出结果：

```text
mymap contains: door:porte grapefruit:pamplemousse tree:arbre apple:pomme book:livre house:maison
mymap has 7 buckets.
bucket #0's size:2 contains: [book:livre] [house:maison]
bucket #1's size:0 contains:
bucket #2's size:0 contains:
bucket #3's size:2 contains: [grapefruit:pamplemousse] [tree:arbre]
bucket #4's size:0 contains:
bucket #5's size:1 contains: [apple:pomme]
bucket #6's size:1 contains: [door:porte]

key:'apple' is in bucket #5

key:'computer' is in bucket #6
```

## unordered_set（哈希表实现的集合）

> unordered_set 是一种关联容器。set 和 map 内部实现是基于红黑树（RedBlackTree），unordered_set 和 unordered_map 是基于哈希表（Hashtable）。红黑树有序，而哈希表无序。

### 特性

> 1. 不再以键值对的形式存储数据，而是直接存储数据的值（只有一个值）
> 2. 容器内部存储的各个元素的值都互不相等，且不能被修改
> 3. 不会对内部存储的数据进行排序

### 模板

```cpp
template < class Key,                        // unordered_set::key_type/value_type
           class Hash = hash<Key>,           // unordered_set::hasher
           class Pred = equal_to<Key>,       // unordered_set::key_equal
           class Alloc = allocator<Key>      // unordered_set::allocator_type
           > class unordered_set;

//一般定义使用
unordered_set<T> ans;
```

### 迭代器

```cpp
//返回头迭代器 begin()
unordered_set<int>::iterator it_begin = ans.begin();

//返回尾迭代器 end()
unordered_set<int>::iterator it_end = ans.end();

//返回const头迭代器 cbegin()
unordered_set<int>::const_iterator const_it_begin = ans.cbegin();

//返回const尾迭代器 cend()
unordered_set<int>::const_iterator const_it_end = ans.cend();

//槽迭代器
unordered_set<int>::local_iterator local_iter_begin = ans.begin(1);
unordered_set<int>::local_iterator local_iter_end = ans.end(1);
```

### 一般操作

```cpp
//查找函数 find() 通过给定主键查找元素
unordered_set<int>::iterator find_iter = ans.find(1);

//value出现的次数 count() 返回匹配给定主键的元素的个数
ans.count(1);

//返回元素在哪个区域 equal_range() 返回值匹配给定搜索值的元素组成的范围
pair<unordered_set<int>::iterator, unordered_set<int>::iterator>
    							   pair_equal_range = ans.equal_range(1);

//插入函数 emplace()
ans.emplace(1);

//插入函数 emplace_hint() 使用迭代器
ans.emplace_hint(it_begin, 1);

//插入函数 insert()
ans.insert(1);

//删除 erase()
ans.erase(1);//1.迭代器 value 区域

//清空 clear()
ans.clear();

//交换 swap()，括号内可接另外一个unordered_set
ans.swap();

//判断是否为空
ans.empty();

//获取元素个数 size()
ans.size();

//获取最大存储量 max_size()
ans.max_size();

//篮子操作 篮子个数 bucket_count() 返回槽（Bucket）数
ans.bucket_count();

//篮子最大数量 max_bucket_count() 返回最大槽数
ans.max_bucket_count();

//篮子个数 bucket_size() 返回槽大小
ans.bucket_size(3);

//返回篮子 bucket() 返回元素所在槽的序号
ans.bucket(1);

//load_factor 返回载入因子，即一个元素槽（Bucket）的最大元素数
ans.load_factor();

//max_load_factor 返回或设置最大载入因子
ans.max_load_factor();

//rehash 设置槽数
ans.rehash(1);

//reserve 请求改变容器容量
ans.reserve(1000);

//hash_function() 返回与hash_func相同功能的函数指针
auto hash_func_test = ans.hash_function();

//key_eq() 返回比较key值得函数指针
auto key_eq_test = ans.key_eq();
```

> 参考：C++ STL 函数库（<https://www.cplusplus.com/reference/>）
