---
title: "一些刷算法的小模板"
published: 2022-02-18T18:00:36+08:00
updated: 2022-02-18T18:00:36+08:00
draft: true
tags: ["leetcode"]
category: "leetcode"
---

:::note
属于之前用 golang 刷算法题的模板，仅作为思维训练使用。实际工作中，遇到的具体场景一般比算法要复杂，所以算法在实际生活中使用较少。
:::


## 快排

```go
func QuickSort(q []int, l, r int) {
 if l == r {
  return
 }

 x := q[(l+r)>>1]
 i, j := l-1, r+1

 for i < j {
  for {
   i++
   if q[i] >= x {
    break
   }
  }
  for {
   j--
   if q[j] <= x {
    break
   }
  }

  if i < j {
   q[i], q[j] = q[j], q[i]
  }
 }
 QuickSort(q, l, j)
 QuickSort(q, j+1, r)
}
```

## 归并排序（针对单个数组版本）

```go
func MergeSort(p, q []int, l, r int) {
 if l == r {
  return
 }

 mid := (l + r) >> 1
 MergeSort(p, q, l, mid)
 MergeSort(p, q, mid+1, r)

 k, i, j := 0, l, mid+1

 for i <= mid && j <= r {
  if q[i] <= q[j] {
   p[k] = q[i]
   k++
   i++
  } else {
   p[k] = q[j]
   k++
   j++
  }
 }
 for i <= mid {
  p[k] = q[i]
  k++
  i++
 }
 for j <= r {
  p[k] = q[j]
  k++
  j++
 }

 i, j = l, 0
 for i < r {
  q[i] = p[j]
  i++
  j++
 }

}
```
