---
title: "MySQL 学习笔记：SQL 复习、原理与优化"
published: 2026-08-11T00:00:00+08:00
updated: 2026-08-11T00:00:00+08:00
tags: ["2026", "mysql", "sql", "innodb", "middleware"]
category: "middleware"
---

> 2022 年学习 MySQL 的三篇笔记（SQL 语法复习、MySQL 原理、MySQL 优化）合并整理。原理先行，实践在后。

## 一、SQL 语法复习

轻量化复盘一下 SQL 操作，以及 MySQL。

### SELECT 语句

数据查询是关系运算理论在 SQL 语言中的主要体现。SQL 的数据查询只有一条 SELECT 语句，其使用最广泛。一个完整的 SELECT 语句包含了六个子句，前两个子句是必备的，其他子句可以省略：

```sql
SELECT [DISTINCT] 目标列名序列 ------ 查看的列 [distinct] 为去重操作
FROM 表名或视图名 ------------------- 数据来源
[WHERE 条件表达式] ------------------ 查询条件
[GROUP BY + 列名] ------------------ 分组依据
[HAVING + 组条件表达式] ------------- 分组条件
[ORDER BY + 列名 + [ASC|DESC]序列]--- 排序依据
```

其中使用 distinct 时要注意列名要放在 distinct 的后面，而使用聚合函数时，则是 `count(DISTINCT 列名)` 语法。

```sql
SELECT
	DISTINCT device_id
FROM usr_profile
```

查询列后，将列取别名操作，要使用 as，但是也能省略：

```sql
SELECT
	device_id as user_infos_example
FROM user_profile

# 等同于
SELECT
	device_id user_infos_example
FROM user_profile
```

### LIMIT 语句

在大表中，一般很少一次性查出所有数据，这样对数据库的压力太大。如果只是抽查一些数据，就可以使用 LIMIT 关键字来查询。LIMIT 子句用于强制 SELECT 语句返回指定的记录数，其接受一个或两个数字参数，且参数必须为整型常量。

如果只给定一个参数，则返回指定数目的记录行；如果给定两个参数，第一个参数是行数序号（从 0 开始表示第一行），第二个参数是数量：

```sql
SELECT * FROM table LIMIT 5,5   # 检索记录行 6-10
SELECT * FROM table LIMIT 10,-1

# 也能结合 offset 一起使用：跳过 0 条，从第一条开始取两条
select device_id from user_profile limit 2 offset 0
```

### BETWEEN 语句

当需要查询某个范围值的时候，一般使用两种语句：between and，以及 and 语句：

```sql
SELECT device_id, gender, age FROM user_profile
where age between 20 and 23
# 等价于
SELECT device_id, gender, age FROM user_profile
where age >= 20 and age <= 23
```

### NOT IN 语句

当需要查询集合中指定属性值时，使用 IN，除此属性值之外的所有值使用 NOT IN。

- IN：当列中的值与 IN 中的某个常量值相等时，则结果为 True，表明此记录为符合查询条件的记录
- NOT IN：当列中的值与 NOT IN 中的某个常量值相等时，结果为 False，表明此记录为不符合查询条件的记录

```sql
SELECT * FROM user_profile
where university NOT IN '复旦大学'
```

当需要过滤空值时：

```sql
SELECT device_id, gender, age, university FROM user_profile
WHERE age != '';
# 或者
SELECT device_id, gender, age, university FROM user_profile
WHERE age is NOT NULL
```

### AND、OR 语句

bool 值运算关系，混合使用时注意 **AND 的优先级大于 OR**：

```sql
SELECT device_id, gender, age, university, gpa FROM user_profile
WHERE gpa > 3.5 AND gender = 'male'

SELECT device_id, gender, age, university, gpa FROM user_profile
WHERE (gpa > 3.5 and university = '山东大学') OR (gpa > 3.8 and university = '复旦大学')
```

### 模糊匹配

数据库中要进行模糊查询，主要使用以下操作：

> 1. `_`：下划线，代表匹配任意一个字符
> 2. `%`：百分号，代表匹配 0 个或多个字符
> 3. `[]`：中括号，代表匹配其中的任意一个字符
> 4. `[^]`：取反，不匹配其中的任意一个字符

```sql
like 模糊查询用法：
  '%北京'   北京开头的
  '_北京%'  第二三个字为北京
  '%北京%'  含有北京的

SELECT device_id, age, university FROM user_profile
WHERE university LIKE '%北京%'
```

:::warning
like 模糊查询会引起全表扫描，速度比较慢，应该尽量避免使用 like 关键字进行模糊查询。
:::


### SQL 中的常用函数

**max**：查找某个条件下最大值的时候，一般有两种方法：第一种为使用降序排序，取第一位；第二种为使用 max 函数：

```sql
SELECT max(gpa) FROM user_profile WHERE university = '复旦大学'

# 上为第二种，下为第一种方法
SELECT gpa FROM user_profile WHERE university = '复旦大学' ORDER BY gpa DESC limit 1
```

**count、round、avg**：count 用于统计某个值的数量，round 用于保留几位小数，avg 用于求某一列的平均值：

```sql
select COUNT(gender) as male_num, round(avg(gpa), 1) as avg_gpa
from user_profile where gender = 'male'
```

**having**：聚合函数结果作为筛选条件时，不能用 where，而是用 having 语法，配合重命名即可：

```sql
SELECT university, avg(question_cnt) as avg_question_cnt, avg(answer_cnt) as avg_answer_cnt
FROM user_profile
GROUP BY university
HAVING avg_question_cnt < 5 OR avg_answer_cnt < 20
```

### 多表查询

若一个查询同时涉及两个或两个以上的表，则称之为连接查询。连接查询是关系数据库中最主要的查询，包括内连接、外连接、交叉连接等，用于连接两个表的条件称为连接条件或者连接谓词。

```sql
SELECT … FROM 表名 [INNER] JOIN 被连接表 ON 连接条件

# 以上结果中会包含重复的列
SELECT * FROM 学生表 INNER JOIN 班级表 ON 学生表.班号=班级表.班号

# 去除重复列
SELECT 学号, 姓名, 班级表.班号, 班名 FROM 学生表 JOIN 班级表 ON 学生表.班号=班级表.班号

# 多表连接示例
select u.university, count(q.question_id) / count(DISTINCT (q.device_id)) as avg_answer_cnt
from user_profile as u
right join question_practice_detail as q
on u.device_id = q.device_id
group by u.university
```

> right join 联结结果保留右表的全部数据；left join 保留左表的全部数据；inner join 保留两表的公共数据。

### 组合查询

```sql
select device_id, gender, age, gpa
from user_profile
where university = '山东大学'
union all
select device_id, gender, age, gpa
from user_profile
where gender = 'male'
```

union 会去重，union all 不会去重；如果直接用 `where university = '山东大学' or gender = 'male'` 也会去重。

> 练习参考：<https://www.nowcoder.com/exam/oj?tab=SQL%E7%AF%87&topicId=199>

## 二、MySQL 原理

### redo-log 与 bin-log 两种日志的区别

redo-log 与 bin-log 两种日志是 InnoDB 数据库引擎为了满足事务的持久性与原子性而引入的。其中，redo-log 是 InnoDB 的特性，bin-log 是 MySQL 中 Server 层的日志。

#### redo-log 日志

> 在更新一条记录时，先将其写入 redo-log 中，然后更新内存，此时的记录就算更新完毕。等待数据库引擎空闲时，再将其更新至磁盘中。
>
> redo-log 大小固定，由 innodb_log_file_size 设置大小和 innodb_log_files_in_group 设置个数，若要修改，则需重启服务。
>
> 一旦更新的数据条数达到 redo-log 日志记录数的上限，数据库引擎则先停止手中的活，将一部分的 redo-log 日志中的数据更新入磁盘，再继续运行。

本质上来说，redo-log 就是一个循环队列，如下图所示（原图来自极客时间专栏）：

![redo-log](/images/SQL/redo_log.png)

其中 write_pos 为当前记录日志的地址，checkpoint 为当前要擦除的地址，擦除记录前需要将记录更新到数据库文件。write_pos 和 checkpoint 之间是 redo-log 空闲的地址块，可以用来记录新的操作。如果 write_pos 追上 checkpoint，说明 redo-log 记录操作已满，不能再执行新的更新，需要数据库引擎先擦除一些记录。

redo-log 可以防止因为数据库异常重启而导致提交记录丢失的问题——这种特性称为 "crash-safe"。

#### bin-log 日志

> 最开始的时候，MySQL 中没有 InnoDB 数据库引擎，其自带的引擎为 MyISAM，而 MyISAM 没有 "crash-safe" 的能力，bin-log 日志只是归档记录的功能。

两种日志的区别：

- redo-log 是 **InnoDB 引擎特有** 的；bin-log 是 MySQL 的 Server 层实现的，所有引擎都可以使用
- redo-log 是 **物理日志**，记录 "在某个数据页上的修改"；bin-log 是逻辑日志，记录的是这个语句的 **原始逻辑**，比如 "给 ID=2 这一行的 c 字段加 1"
- redo-log 是 **循环写的，空间固定**；bin-log 是以 **追加** 的方式写入的，"追加写" 是 bin-log 文件达到一定大小后，会切换到下一个 bin-log 日志文件，并不会覆盖以前的日志

所以可得到以下结论：

> 1、redo-log 的写盘时间会直接影响系统的吞吐，所以 redo-log 的数据量要尽量少。
>
> 2、由于系统崩溃的不确定性，重启重放 redo-log 文件时，系统不会知道 redo-log 中的那个 page 页已经修改入磁盘，所以 redo-log 的重放必须是可重复的。
>
> 3、一般来说，**建议一个 redo-log 只涉及一个内存 page 页来进行修改**，这样就可以兼顾逻辑日志与物理日志的优势。

而 redo-log 提交是有两个阶段的：**prepare 和 commit 阶段**。之所以进行两个阶段的提交，也是为了达到 "crash-safe" 的目的。

#### 两阶段提交的情景

假设 redo-log 都是一次性提交，不分两个阶段，此时我们对一个字段 c 值进行更新，让 c 值从当前的 0 更新为 1。

**情景 1**：我们先写 redo-log 后写 bin-log。假设在 redo-log 写完、bin-log 并未写完时，MySQL 进程异常重启。

> redo-log 写完之后，虽然系统崩溃也能将 MySQL 异常启动前的数据恢复回来。但是 bin-log 并未写完，此时记录的 bin-log 文件就没有记录之前操作的语句。之后用于备份的 bin-log 中也没有相应的操作语句，而若我们需要恢复临时库，由于 bin-log 记录的语句丢失，临时库恢复出来的这一行 c 的值就是 0，与原库的值不同。

**情景 2**：我们先写 bin-log，后写 redo-log。假设在 bin-log 写完、redo-log 并未写完时，MySQL 进程异常重启。

> 如果在 bin-log 写完之后系统崩溃，由于 bin-log 不具备 "crash-safe" 的功能，而 redo-log 没写，所以崩溃恢复以后这个事务无效。但是 bin-log 里面已经记录了 "c 从 0 改为 1" 的日志，所以在之后用 bin-log 恢复临时库时，就会多出一个事务，恢复出来的 c 的值就是 1，与原库的值不同。

所以两阶段提交就是让 redo-log 与 bin-log 两个状态保持逻辑上的一致。针对于异常重启，在 MySQL 设置中的 `innodb_flush_log_at_trx_commit`、`sync_binlog` 均设置为 1，能保证 MySQL 异常重启之后数据不丢失与 bin-log 文件不丢失。

#### 一些补充

1、MySQL 的 bin-log 完整性：

> 1、statement 格式，最后会有 COMMIT；
>
> 2、row 格式，最后会有 XID event；
>
> 3、MySQL 5.6.5 版本后也引入了 bin-log checksum 用于验证 bin-log 内容的正确性，所以一旦 bin-log 所在的磁盘出现故障，可以通过验证 checksum 来确定准确性。

2、关于 bin-log 备份建议：

一般建议在一周一备份与一日一备份之间进行选择，具体看业务的评估，比如 RTO（恢复目标时间）指标。一周一备份存储成本小，但是 RTO 长；而一日一备份 RTO 时间小，但是存储的成本大。

### 事务中的隔离性

事务是数据库在操作数据时，为了保证其逻辑一致性而划分的最小单位。

> 事务的特性：**A（Atomicity）、C（Consistency）、I（Isolation）、D（Durability）**，即原子性、一致性、隔离性、持久性。

事务是保持逻辑一致性、可恢复性的重要方法，而锁是保证事务的完整性与并发性的重要概念。

#### 隔离性的概念

隔离性的存在主要是为了**区分多个事务并行执行的顺序问题**，比如多个事务并行执行时，出现脏读、不可重复读、幻读等。

> 脏读：读取到其他事务未提交的数据
>
> 不可重复读：前后读取记录内容不一致
>
> 幻读：前后读取记录数量不一致

所以隔离性针对于以上的情况，分成如下几个级别的隔离：**读未提交、读提交、可重复读与串行化**：

- 读未提交：一个事务还未提交，其所做的变更可以被其他事务读取
- 读提交：一个事务提交之后，其所做的变更才能被其他事务读取
- 可重复读：一个事务执行过程中看到的数据是一致的，未提交时其所做的变更对其余事务不可见
- 串行化：对一个记录进行加读写锁，若其发生冲突，后访问的事务需要等前一个事务执行完毕时，才能继续执行

上面四种情况，并行性逐步降低，但是安全性逐步升高。

:::note
Oracle 数据库的默认隔离级别是读提交，所以从 Oracle 数据库迁移到 MySQL 数据库中，需要将 MySQL 的启动参数 `transaction-isolation` 的值设置成 READ-COMMITTED。MySQL 数据库默认的隔离级别是可重复读，但是可重复读会导致幻读的情况。
:::


#### 隔离性的实现

在 MySQL 数据库中，为了控制并发执行的语句的顺序，引入了多版本并发控制 MVCC（Multi-Version Concurrency Control）。

其具体内容可以概括如下：每条记录在更新的时候都会同时记录一条回滚日志：undo-log，同一条记录在系统中可以存在多个版本：

![isolation](/images/SQL/MySQL-isolation1.png)

若我们需要将当前 4 的值恢复到 1 时，需要执行 3 次 undo-log 回滚。而当系统中不存在比回滚日志更早的 read-view 时，undo-log 则会被删除。以上图为例子，当 read-viewA 视图被删除后，将 3 改为 2 之前的 undo-log 即会被删除。所以说一般开发时，MySQL 数据层的事务尽量避免过长。

#### 事务的启动方式

MySQL 中的事务启动方式一般为两种：

> 1、显式启动：使用 begin 或 start transaction，配套的提交语句为 commit，回滚语句为 rollback
>
> 2、set autocommit = 0：此命令会关闭自动提交，只有手动执行上述配套的语句，才能进行一个事务的提交，或者断开连接时提交

所以建议使用 **set autocommit = 1**，通过显式语句来启动事务，而 commit 命令一般使用 **commit work and chain** 命令，即提交并且启动下一个事务。带来的效果是从程序开发的角度可以明确的知道每个语句是否存在于事务中。

## 三、MySQL 优化

### 索引

索引只是一种数据结构而已，具体看 MySQL 的数据库引擎。比如 MyISAM 使用 B 树，InnoDB 使用的是 B+ 树。

:::note
聚簇索引与非聚簇索引就是 B 树与 B+ 树的两个别名。
:::


缺点：

- 少量数据不需要索引
- 频繁更新的数据不适合作为索引
- 很少使用的字段不需要索引
- 索引提升查询效率，但会降低增删改的效率
- 索引占用空间很大

优点：

- 查询效率高
- CPU 占用少（order by XXX desc 时，B 树、B+ 树不用排序，所以 CPU 计算少）

#### 索引细节

**分类**：索引一般有三种：单值索引、唯一索引、复合索引。

- 单值索引：单列的索引，一个表可以有很多单值索引
- 唯一索引：所有值不能重复，即 distinct
- 复合索引：多个列组成的二级索引

**创建索引**：

```sql
# 方式一：create
create index 索引名称 on 表(字段名称)                    # 单值
create unique index 索引名称 on 表(字段名称)             # 唯一
create index 索引名称 on 表(字段名称)                    # 复合

# 方式二：alter
alter table 表名 add index 索引名称(字段名称)            # 单值
alter table 表名 add unique index 索引名称(字段名称)     # 唯一
alter table 表名 add index 索引名称(字段名称, 字段名称)   # 复合
```

:::note
primary key 设置后自动就是主键索引。主键与唯一索引均不能为 null。
:::


**查询/删除索引**：`show index from 表名` / `drop index 索引名 on 表名`

### SQL 优化之执行计划

SQL 优化的主要原因即是：性能低、SQL 语句执行时间长、等待时间长、索引失效、服务器参数不合理等。

:::warning
有索引才能涉及到 SQL 优化，没有索引一般都是 ALL 级别。
:::


先说 SQL 语句的执行。在 MySQL 数据库引擎进行数据解析的过程中，识别 SQL 语句后，实际的执行过程与编写的语句不一致，一般执行过程如下：

```sql
from...on...join...where...group by...
having...select (distinct)...order by... limit
```

优化时，必须解决的问题就是 SQL 语句的执行计划。SQL 执行计划的关键字：**explain**，可以模拟 SQL 优化器执行 SQL 语句，从而让开发人员具体知道自己写的 SQL 语句是如何执行的。

**使用方法**：`explain + SQL 语句`，如 `explain select * from tables`：

![](/images/SQL/index1.png)

#### id 值相同的执行计划

id 值相同，即按照 table 字段从上到下的顺序进行执行。而此种情况下的表查询的顺序，会因为表内数据量的多少而改变。原因是计算权重的算法就是笛卡尔积，笛卡尔积是连乘，产生的中间过程的数据量，理应越小越好。所以在执行计划中，在表最终的结果集一致的情况下，表遵循表内数据从小到大的顺序进行执行。

#### id 值不同的执行计划

id 值不同时，id 值越大越优先执行。本质即是多表联结查询转变为子查询，子查询是先执行最内层查询，再执行外层查询，所以即是 id 值越大，越优先执行。

#### select_type 查询类型

> 1、primary：主查询方法，为最外层的查询
>
> 2、subquery：主查询的对立方法，即子查询方法，为内层查询
>
> 3、simple：简单查询，即不涉及子查询与 union 查询
>
> 4、derived：衍生查询，会创建一个临时表。（如果在 from 子查询中只涉及一个表，则该表为临时表；如果在 from 子查询中涉及两个表，则左表是临时表）

#### type 索引类型

一般企业中常用的索引类型如下：

```
system >> const >> eq_ref >> ref >> range >> index >> all
```

以上类型的索引效率越往左越高。其中 system 与 const 只是理想情况下的效果，一般 SQL 优化，在 ref ~ range 之间。

- system（忽略）：只有一条数据的系统表，或衍生表只有一条数据的主查询
- const（忽略）：仅仅能查到一条数据，只能用于 primary key 或 unique index
- eq_ref（尽量满足，但是可遇不可求）：唯一性索引，对于每个索引键的查询，返回匹配的唯一行数据（只能为 1，不能多、也不能是 0），常见于主键索引与唯一索引。即查询的主数据表与临时的表内的数据数量必须一致，才能达到 eq_ref 的效果
- ref：非唯一性索引，对于每一个索引键的查询，返回匹配的所有行（0 或 多）
- range：检索指定范围的行，where 后面为范围查询的情况（between、in、>、< 等），但是 in 有时候会索引失效，转变为 ALL 级别
- index：查询全部索引的数据，索引查询肯定要小于等于全表查询
- all：查询全部表中数据

总结：system、const 结果只能有一条数据；eq_ref 结果是多条，但是每条数据具有唯一性；ref 结果多条，但是每条数据是 0 或 多条。

#### possible_keys、key、key_len、ref、rows、Extra

- possible_keys 为预测的索引值，不准确
- key 为实际使用的索引。**注意**：如果 possible_keys / key 均为 null，则没使用索引
- 判断复合索引是否完全被使用。如果复合索引有一个索引允许为空，那么 key_len 长度会默认 +1B，作为空标识符；2B 标识 varchar 的可变长度
- ref 为：指明当前表所参照的字段。**注意**：与 type 中的 ref 进行区分
- rows 为：被索引优化查询的个数，即量级

Extra 常见有以下字段：

- using filesort：性能消耗大，需要进行额外一次排序（查询）。对于单索引，如果排序查找的是同一字段，则不会出现 filesort；如果排序与查找的不是同一字段，则需要使用 using filesort。在复合索引下，避免使用 using filesort，就使用 where 与 order by 按照复合索引的顺序使用，不要跨列就不用使用（最佳左前缀）
- using temporary：出现性能损耗，用到了临时表，一般出现在 group by 语句中
- using index：性能提升，覆盖索引。原因：不读取原文件，只从索引文件读取数据，不需要回表查询。但是使用 using index 时，会对 possible_keys 和 key 造成影响：没有 where 时，索引出现在 key 中；有 where 时，索引出现在 key 和 possible_keys 中
- using where：既查索引，又查原表（即回表查询）
- impossible where：where 子句永远为 false

### 单表优化

在进行单表优化时，主要注意以下几点：

- where 与 order by 联合使用索引查询，尽量不要跨列进行搜索
- 如果复合索引的使用顺序全部一致（且不跨列使用），则复合索引全部使用；如果部分使用（且不跨列使用），则使用部分索引

举个例子，假设我们有一张 book 表，建表语句如下所示，我们也先添加四个数据：

```sql
create table book
(
	bid int(4) primary key,
	name varchar(20) not null,
	authorid int(4) not null,
	publicid int(4) not null,
	typeid int(4) not null
);

insert into book values(1, 'tjava', 1, 1, 2);
insert into book values(2, 'tc', 2, 1, 2);
insert into book values(3, 'wx', 3, 2, 2);
insert into book values(4, 'math', 4, 3, 2);
```

然后我们想查询 authorid = 1 且 typeid 为 2 或 3 的 bid：

```sql
select bid from book where typeid in (2,3) and authorid = 1;
explain select bid from book where typeid in (2,3) and authorid = 1;
```

![](/images/SQL/explain1.png)

发现没有索引的情况下，默认发生的是全表查询，即 explain 执行计划 type 字段值为 all，extra 字段为 using where。而后我们为了让优化的效果更加明显一点，再配合 order by desc 来使用：

```sql
select bid from book where typeid in (2,3) and authorid = 1 order by typeid desc;
explain select bid from book where typeid in (2,3) and authorid = 1 order by typeid desc;
```

![](/images/SQL/explain2.png)

此时我们会发现，extra 字段会出现 using filesort 字段值，即查询全表后还对返回的数据重新排序，这样很浪费性能，所以我们对其添加索引优化：

```sql
alter table book add index idx_bta (bid, typeid, authorid);
```

然后再执行上述的 SQL 语句：

![](/images/SQL/explain3.png)

可见，增加索引后可以将全表查询变为索引查询，type 等字段发生改变，但是 using where 与 using filesort 还是未能优化掉，所以说此条 SQL 语句还能继续进行相应的优化。

而 SQL 语句的优化，即是我们之前说的，理解 SQL 语句在 MySQL 中的执行顺序，那么按照执行顺序进行索引的优化即是最好。比如我们这里是先查 bid，再查 typeid 与 authorid。但是 MySQL 中，select 语句执行时在 where 之后，所以优化时，索引应为 (typeid, authorid, bid)。

**那么索引 bid 是否能去除呢？**这里我选择不去除，因为虽然删除 bid 索引后，根据索引也能回表进行查询，但是如果只查一次索引即可得到数据，还是建议只查索引。虽然这样会导致索引很大，但是牺牲空间换时间也是一种常用的做法。

继续回到原 SQL 语句：

```sql
select bid from book where typeid in (2,3) and authorid = 1 order by typeid desc;
explain select bid from book where typeid in (2,3) and authorid = 1 order by typeid desc;
```

**这里注意**：如果是范围查询的 `in` 语句，有时候会生效，有时候会失效，所以我们需要在开始使用索引时就走一个必定生效的索引，更改语句如下。同时，我们需要先删除之前添加的索引，防止之前的索引干扰：

```sql
drop index idx_bta on book;

select bid from book where authorid = 1 and typeid in (2,3) order by typeid desc;
explain select bid from book where authorid = 1 and typeid in (2,3) order by typeid desc;

alter table book add index idx_atb (authorid, typeid, bid);
```

![](/images/SQL/explain4.png)

通过 explain 查看相应的执行计划，可见 type 级别从 index 变为了 range，提升了一个级别。其中有字段 `Backward index scan`，这是 MySQL 8 的新特性，叫做降序索引。在 MySQL 5.x 中执行计划显示 type 优化为 ref 级别，而在 MySQL 8 中则是 range 级别，可见在 MySQL 8 中，这样优化达不到 MySQL 5.x 的优化效果。

using where 与 using index 最大的区别即是需不需要回原表进行查询。而两者同时出现，即是 in 范围查询有时候失效、有时候不失效的情况。所以为了消除这种情况，一般情况用其他有效条件替换 in 即可：

```sql
select bid from book where authorid = 1 and typeid = 3 order by typeid desc;
explain select bid from book where authorid = 1 and typeid = 3 order by typeid desc;
```

![](/images/SQL/explain5.png)

其 explain 结果可见 type 字段变为 ref 值，优化上升两个级别，而一般达到 ref 或者 eq_ref 级别，已经是比较好的一种情况了。

### 多表优化

创建两个表 teacher2 与 course2：

```sql
create table teacher2
(
	id int(4) primary key,
	cid int(4) not null
);

create table course2
(
	cid int(4),
	cname varchar(20)
);

insert into teacher2 values (1,2);
insert into teacher2 values (2,1);
insert into teacher2 values (3,3);

insert into course2 values (1,'java');
insert into course2 values (1,'python');
insert into course2 values (1,'kotlin');
```

然后我们将两表通过左连接进行两表连接，查询 cname = 'java' 的值：

```sql
select * from teacher2 as t left outer join course2 as c on t.cid = c.cid where c.cname = 'java';
```

![](/images/SQL/explain6.png)

可见 type 为 all，即全表查询，而且 extra 出现一个新的字段值：using join buffer。出现此字段就说明 SQL 写得很差，MySQL 底层使用优化器对 SQL 进行了优化，即使用连接缓存。但是由于不涉及索引查询，所以必然还是很慢。

所以两表的索引应该如何去加呢？直接上结论：**小表驱动大表**，写法如 **小表.X = 大表.X**。原理就是根据 CPU 与内存的空间局部性原理，不用频繁进入磁盘访存拿出数据。

所以，关于两表索引的增加，一般是先看连接，比如左外连接在左表上加索引、右外连接在右表上加索引。小表中使用频繁的字段加索引：

```sql
alter table teacher2 add index index_teacher2_cid(cid);
alter table course2 add index index_course2_cname(cname);
```

![](/images/SQL/explain7.png)

此后执行效果直接提升为 ref 级别，而且不再出现 using join buffer，证明 SQL 语句优化得还行。

而关于三表优化只需要记住两个原则即可：

- 小表驱动大表
- 索引建立在经常查询的字段上

:::warning
注意：SQL 优化是一种概率事件！是否实际使用了我们的优化，需要通过 explain 进行查看。
:::


### 避免索引失效的一些原则

- 复合索引不跨列或者无序使用（最佳左前缀匹配），尽量使用全索引匹配
- 不要在索引上进行任何操作（函数计算、类型转换等），否则都会使索引失效：
  - 复合索引中，如果对左侧的索引进行操作，那么包括此索引的右侧索引全部失效
  - 复合索引不能使用不等于（!=、>、<）或 is null（is not null），否则自身以及右侧的索引全部失效
  - 复合索引使用等于（=、>、<）有部分概率使自身以及右侧的索引全部失效
  - SQL 优化由于 SQL 优化器等原因，并非 100% 成立。一般而言，范围查询的（>、<、in）之后的索引失效
  - 补救方式：尽量使用覆盖索引
- like 后尽量以 "常量" 开头，不要以 % 开头，否则索引失效
- 尽量不要使用类型转换（显式、隐式），否则索引失效
- 尽量不要使用 or，否则索引失效，左右的索引都会失效

### 索引优化方法

- exist 与 in 使用情况：主查询数据集大用 in，子查询数据集大用 exist
- order by 优化：
  - using filesort 有两种算法：双路排序与单路排序（根据 I/O 的次数）
  - 选择使用单路、双路，调整 buffer 的容量大小
  - 避免使用 select *
  - 复合索引不跨列
  - 保证全部的排序字段排序的一致性（都是升序或降序）

### SQL 排查之慢查询

慢查询日志是 MySQL 提供的一种日志记录，用于记录 MySQL 中响应时间超过阈值的 SQL 语句。配置文件中显示为：long_query_time，默认为 10s。慢查询日志默认是关闭的：开发时建议打开，部署时关闭：

![默认关闭](/images/SQL/slow-query.png)

一般是临时开启，如果需要永久开启，直接在配置文件中追加配置即可。

Linux 上也能通过使用 mysqldumpslow 工具对慢 SQL 语句进行排查，可以通过设置，对 SQL 语句进行快速筛选。使用命令 `mysqldumpslow --help`：

> - s：排序方式
> - r：逆序
> - l：锁定时间
> - g：正则匹配

参考 bash 写法如下：

```bash
# 获取返回记录最多的 3 个 SQL
mysqldumpslow -s r -t 3 /var/lib/mysql/localhost-slow.log

# 获取访问次数最多的 3 个 SQL
mysqldumpslow -s c -t 3 /var/lib/mysql/localhost-slow.log
```

:::note
一般来说，实际的生产过程中有挺多复杂的场景，但是在业务量没有提升的时候，具体问题可以不进行优化，待业务量与使用量上来后，再进行优化，毕竟做事都是有时间成本的。
:::

