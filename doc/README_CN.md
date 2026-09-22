# Only-fish

基于 p5.js 1.9.0 与原生 ES Modules 的程序化池塘模拟，无需构建。[English](../README.md)

## 运行

在仓库目录执行：

```sh
python -m http.server 8080
```

浏览器打开 http://localhost:8080。也可使用 Windows 的 start.bat 或 Linux/macOS 的 start.sh。不要直接双击 HTML；模块需要 HTTP 服务，p5.js CDN 需要联网。

## 场景与操作

默认包含 5 条鱼、22 条金鱼、3 只乌龟、8 只虾、3 片荷叶和 2 朵具有独立花瓣的荷花。数量、大小和配色由各物种配置定义。

点击空白处投食，按住动物或植物拖动，齿轮打开控制栏。Walls 默认关闭；Collisions、Feed、Catch 默认开启；Seek Mouse 和半径调试默认关闭。

切换物种后，移动动物显示 Introversion、Speed、Color Separation（不同颜色之间的额外排斥）和 Diversity。植物依靠弹簧、阻尼与碰撞漂浮，仅显示有效的 Diversity 控件。滑块及移动端按钮由配置生成，不再限定四个固定键名。

## 架构与时序

- main.js：注册、p5 生命周期、固定步长调度、抓取与投食。
- core/FixedStepClock.js：独立于绘制刷新率的 60Hz 模拟时钟。
- registry/AnimalRegistry.js：创建、分阶段更新、食物处理与层级渲染。
- boids/BoidPhysics.js：转向、边界、碰撞和延迟速度采样。
- core/FishLocomotion.js、FishSpine.js、LighthillGait.js：鱼与金鱼的路径跟随脊柱及时间驱动步态。
- core/Chain.js：虾、乌龟和鱼鳍的 IK 链。
- animals/：渲染、行为与配置；pond_plant 自定义创建 lilypad、lotus 组成的复合组。
- ui/UIController.js：动态控件与桌面/移动端状态同步。
- entities/FoodItem.js：食物吸引、消耗冷却与绘制。

每次 draw 累积时间，执行零到多个固定模拟步，最后绘制。每步先更新抓取与速度历史，再计算所有 flock/跨组排斥：邻居的位置和速度保持为步开始时的状态；然后统一提交速度及植物反作用冲量，积分位移、处理食物吸引和消耗。速度单位为像素/模拟步，maxForce 为每步转向增量，步态 dt 固定为 1/60 秒。反应延迟、进食冷却和花瓣淡出使用模拟时间（毫秒）。

每次 draw 最多补算 250ms，避免后台恢复后瞬间跳跃；不做绘制插值，所以高刷新率设备仍显示 60Hz 运动。碰撞仍按稳定的组名/id 顺序依次解算，并非同时求解多个物体；同组 id 必须唯一且稳定。

## 新增物种

普通移动动物通常包含渲染类、Boid 行为类、配置文件，在 main.js 中 import 并 register。配置定义 group、label、数量、缩放、调色板、physics、个体系数、sliders 与 applySliderValue。

标准工厂把 physics 传给构造函数。初始化和滑块更新应使用相同速度公式。Boid 提供 position、velocity、radius、mass、maxSpeed、maxForce、id/group，以及 flock、separateFromOthers、physicsUpdate、display、resolveRenderPosition。公共方法可通过 applyBoidPhysics 混入。

flock 可以修改自身速度，但对其他对象的反作用力须累加至 pendingImpulse；位置更新放在 physicsUpdate。自定义构造参数或复合物种使用 customCreateBoids(groupState)。

每个 slider 提供 label、min/max/step、defaultValue、toParam、toUI；applySliderValue 映射到实例。UI 支持任意键名，不需要修改 HTML。植物只暴露实际生效的配色数量。

zIndex 为默认渲染层，getZIndex(boid) 可覆盖单个对象层级；脱落花瓣通过此接口进入较低层，Registry 不包含花瓣特判。eatCooldown/lastEatTime 启用进食，isDead 启用清理。

## 测试与仓库约定

开发测试需要 Node.js 22+，无 npm 依赖：

```sh
npm test
```

测试使用 Node 内置 runner 和确定性的 p5 数学/DOM 适配器，覆盖刷新率一致性、长帧限制、遍历顺序、更新前邻居状态、速度与配置一致性、植物、动态滑块和 checkbox 同步。测试不验证 Canvas 外观或真实触屏设备。GitHub Actions 在 push 和 pull_request 时运行。

个人 IDE、虚拟环境及 AI 工具配置已加入忽略规则。颜色排斥统一命名为 colorSeparation，界面显示 Color Separation。

## 许可

[MIT](../LICENSE)
