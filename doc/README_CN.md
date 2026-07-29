# Only-fish

基于 **p5.js** 的多物种群体模拟项目。使用 Boids 算法驱动群体行为，结合反向运动学 (IK) 链条实现程序化动物动画。所有动物完全由代码绘制在 Canvas 2D 上，无需任何图片资源。

[**English**](../README.md)

## 演示

鱼群展示完整的 Boid 行为（分离、对齐、聚合），乌龟则以缓慢的速度漫游，四足由 FABRIK 算法驱动。不同物种之间通过跨组分离力互相避让。

## 特性

- **Boids 群体行为** -- 同组动物执行完整的分离 + 对齐 + 聚合；不同组之间仅做排斥避让
- **IK 动画系统** -- 基于反向运动学链条的程序化脊椎和肢体动画
- **多物种架构** -- 只需 3 个文件（渲染器 + 行为 + 配置）即可注册新动物
- **丰富的交互** -- 抓取动物、投放食物、切换墙壁边界、调节行为参数滑块
- **全程序化渲染** -- 每种动物都由代码绘制，无精灵图或图片
- **响应式 UI** -- 桌面端和移动端双套控制面板，实时调参
- **零构建步骤** -- 纯 ES Modules，无需打包器或编译器

## 动物种类

| 物种 | 数量 | IK 关节 | 特殊特性 |
|------|------|---------|----------|
| 鱼 | 18 | 12 节脊椎 | 胸鳍/腹鳍/尾鳍，身体光泽 |
| 乌龟 | 8 | 10 节脊椎 + 4x3 腿 | FABRIK 四足行走，刚性龟壳 |

## 快速开始

### 前置条件

项目使用 ES Modules (`type="module"`)，需要本地 HTTP 服务器。启动脚本会自动处理。

### 运行

**Windows：**
```bash
start.bat
```

**Linux / macOS：**
```bash
chmod +x start.sh
./start.sh
```

脚本会在 **8080** 端口启动本地服务器并自动打开浏览器。默认使用 `python -m http.server`，Windows 下无 Python 环境时回退到 PowerShell 内置服务器。

## 控件说明

| 控件 | 类型 | 默认值 | 作用域 |
|------|------|--------|--------|
| Animal Select | 下拉框 | 第一个注册的动物 | 切换当前编辑的动物组 |
| Walls | 开关 | 关 | 全局 |
| Collisions | 开关 | 开 | 全局 |
| Seek Mouse | 开关 | 关 | 全局 |
| Feed | 开关 | 开 | 全局 |
| Catch Fish | 开关 | 开 | 全局 |
| Introversion | 滑块 (0-20) | 10 | 当前动物组 |
| Speed | 滑块 (0-20) | 12 | 当前动物组 |
| Racism | 滑块 (0-20) | 10 | 当前动物组 |
| Diversity | 滑块 (1-8) | 3 | 当前动物组 |

### 鼠标交互

- **点击空白处**（Feed 模式开启）-- 投放食物
- **点击并按住动物**（Catch 模式开启）-- 抓取并拖拽，动物会有挣扎逃脱动画
- **鼠标追踪**（Seek Mouse 开启）-- 动物轻微跟随鼠标移动

## 架构

```
src/
  main.js                        -- 主入口：注册动物 + p5.js 生命周期
  registry/AnimalRegistry.js     -- 动物注册中心：管理组/创建/更新/渲染
  ui/UIController.js             -- UI 控制器：双向绑定
  boids/BoidPhysics.js           -- Boid 公共物理方法 mixin
  core/Chain.js                  -- IK 链条类（反向运动学）
  entities/FoodItem.js           -- 鱼食实体
  utils/                         -- 几何与高斯分布工具
  animals/
    fish/                        -- 鱼的渲染 + 行为 + 配置
    turtle/                      -- 乌龟的渲染 + 行为 + 配置
```

### 每帧数据流

```
draw()
  -> registry.update(grabbedBoid)
    -> boid.flock(同组, settings)                // 组内：分离 + 对齐 + 聚合
    -> boid.separateFromOthers(所有boid, group)  // 跨组：仅分离排斥
    -> boid.physicsUpdate(同组, settings)         // 物理更新 + IK 求解
  -> registry.checkFoodCollisions(foods)
  -> foods[i].display()
  -> registry.render()
```

### 关键设计决策

- **Mixin 而非继承** -- Boid 物理方法通过 `applyBoidPhysics()` 混入，不使用类继承层级
- **三文件约定** -- 每种动物由渲染类 + 行为类 + 配置文件组成，放在 `animals/<name>/` 目录下
- **配置驱动滑块** -- 每个配置文件定义 `applySliderValue` 回调，描述滑块值如何应用到实例
- **共享食物池** -- 所有物种竞争同一个食物池

## 添加新动物

1. 创建 `src/animals/<name>/` 目录，包含三个文件：

   | 文件 | 用途 |
   |------|------|
   | `<Name>.js` | 渲染类（IK 链条、绘制逻辑） |
   | `<Name>Boid.js` | 行为类（群体行为、物理、显示），末尾调用 `applyBoidPhysics()` |
   | `<name>.config.js` | 注册配置（组名、标签、调色板、物理参数、滑块） |

2. 在 `main.js` 中注册：
   ```js
   import { myAnimalConfig } from './animals/myAnimal/myAnimal.config.js';
   registry.register(myAnimalConfig);
   ```

### Boid 类接口契约

你的 Boid 类需要实现：

- **构造函数** 接受配置对象，包含：`id, group, x, y, scale, bodyColor, finColor, colorId, introversion, introversionCoefficient, quickness, quicknessCoefficient, racism, racismCoefficient, speedIndex, reactionDelayMs`
- **实例属性**：`position, velocity, maxSpeed, maxForce, radius, mass, group, isGrabbed`
- **方法**：`flock(sameGroupBoids, settings, updateTime)`、`physicsUpdate(sameGroupBoids, settings)`、`display()`、`resolveRenderPosition()`
- 可选进食功能：定义 `lastEatTime` 和 `eatCooldown` 即可参与食物消耗

## 技术栈

- [p5.js](https://p5js.org/) v1.9.0 -- Canvas 2D 渲染
- 原生 JavaScript（ES Modules）
- 无构建工具，除 p5.js 外无其他依赖

## 许可证

[MIT](../LICENSE) -- Copyright (c) 2026 YangZH
