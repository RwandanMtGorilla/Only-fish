/**
 * UI 控制器 - 管理 checkbox/slider/select 的双向绑定
 * 替代原 wireUIControls(), 支持多动物组下拉框切换
 * @module ui/UIController
 */

export class UIController {
  constructor() {
    this.registry = null;
    this.settings = null;
    this.currentGroup = null;
    this.callbacks = {};
  }

  /**
   * 初始化所有 UI 绑定
   * @param {AnimalRegistry} registry
   * @param {Object} settings - 全局设置
   * @param {Object} callbacks - { releaseGrabbedFish }
   */
  init(registry, settings, callbacks) {
    this.registry = registry;
    this.settings = settings;
    this.callbacks = callbacks;

    this._initToggleButton();
    this._initMobileVisibility();
    this._initMobileClosers();
    this._initCheckboxes();
    this._initAnimalSelect();
    this._initSliders();
    this._initResizeHandler();
  }

  // === 齿轮按钮 ===

  _initToggleButton() {
    const controlsContainer = document.getElementById('boids-controls-container');
    const toggleBtn = document.getElementById('toggle-controls-btn');
    if (controlsContainer && toggleBtn) {
      controlsContainer.classList.add('hidden');
      toggleBtn.onclick = function () {
        controlsContainer.classList.toggle('hidden');
        toggleBtn.classList.toggle('active');
      };
    }
  }

  // === 移动端初始隐藏 ===

  _initMobileVisibility() {
    const collisionsMobileEl = document.getElementById('collisions-mobile');
    const mouseSeekMobileEl = document.getElementById('mouse-seek-mobile');
    if (collisionsMobileEl) collisionsMobileEl.style.display = 'none';
    if (mouseSeekMobileEl) mouseSeekMobileEl.style.display = 'none';
  }

  // === 移动端关闭按钮 ===

  _initMobileClosers() {
    const mobileClosers = document.getElementsByClassName('boids-control-close');
    for (let i = 0; i < mobileClosers.length; i++) {
      mobileClosers[i].onclick = function () {
        this.parentNode.classList.toggle('show');
        const mobileControls = document.getElementById('mobile-boids-controls');
        if (mobileControls) mobileControls.style.display = 'block';
      };
    }
  }

  // === 5个全局 Checkbox ===

  _initCheckboxes() {
    const self = this;
    const configs = [
      { desktopId: 'walls',              mobileId: 'walls-mobile',       settingKey: 'walls',      defaultChecked: false },
      { desktopId: 'collision-detection', mobileId: 'collisions-mobile', settingKey: 'collisions', defaultChecked: true },
      { desktopId: 'mouse-seek',          mobileId: 'mouse-seek-mobile', settingKey: 'mouseSeek',  defaultChecked: false },
      { desktopId: 'feed-mode',           mobileId: 'feed-mode-mobile',  settingKey: 'feedMode',   defaultChecked: true },
      {
        desktopId: 'grab-fish', mobileId: 'grab-fish-mobile', settingKey: 'grabFish', defaultChecked: true,
        onOff(val) { if (!val) self.callbacks.releaseGrabbedFish?.(); },
      },
      { desktopId: 'show-radii', mobileId: 'show-radii-mobile', settingKey: 'showRadii', defaultChecked: false },
    ];

    for (const cfg of configs) {
      this._bindCheckbox(cfg);
    }
  }

  /**
   * 绑定单个 checkbox 的桌面端/移动端双向同步
   */
  _bindCheckbox({ desktopId, mobileId, settingKey, defaultChecked, onOff }) {
    const input = document.getElementById(desktopId);
    const mobile = document.getElementById(mobileId);

    if (input) {
      input.checked = defaultChecked;
      this.settings[settingKey] = defaultChecked;
      input.onclick = () => {
        this.settings[settingKey] = input.checked;
        if (mobile) {
          mobile.dataset.checked = input.checked;
          mobile.classList.toggle('boids-checkbox-on');
        }
        onOff?.(input.checked);
      };
    }

    if (mobile) {
      mobile.dataset.checked = defaultChecked;
      mobile.onclick = () => {
        const newVal = mobile.dataset.checked === 'false';
        mobile.dataset.checked = newVal;
        if (input) input.checked = newVal;
        mobile.classList.toggle('boids-checkbox-on');
        this.settings[settingKey] = newVal;
        onOff?.(newVal);
      };
    }
  }

  // === 动物下拉框 ===

  _initAnimalSelect() {
    const selectEl = document.getElementById('animal-select');
    if (!selectEl) return;

    const groups = this.registry.getGroupList();

    // 动态生成 <option>
    for (const { group, label } of groups) {
      const opt = document.createElement('option');
      opt.value = group;
      opt.textContent = label;
      selectEl.appendChild(opt);
    }

    this.currentGroup = groups[0]?.group || null;
    selectEl.value = this.currentGroup;

    selectEl.onchange = () => {
      this.currentGroup = selectEl.value;
      this._syncSlidersToGroup(this.currentGroup);
      // 同步移动端按钮文本
      const mobileBtn = document.getElementById('animal-select-mobile');
      if (mobileBtn) mobileBtn.textContent = selectEl.selectedOptions[0].textContent;
    };

    // 移动端按钮: 点击循环切换
    const mobileBtn = document.getElementById('animal-select-mobile');
    if (mobileBtn && groups.length > 1) {
      mobileBtn.onclick = () => {
        const currentIdx = groups.findIndex(g => g.group === this.currentGroup);
        const nextIdx = (currentIdx + 1) % groups.length;
        this.currentGroup = groups[nextIdx].group;
        selectEl.value = this.currentGroup;
        mobileBtn.textContent = groups[nextIdx].label;
        this._syncSlidersToGroup(this.currentGroup);
      };
    }
  }

  // === 4个滑块 ===

  _initSliders() {
    const sliderKeys = ['introversion', 'speed', 'racism', 'diversity'];
    for (const key of sliderKeys) {
      const input = document.getElementById(key);
      if (!input) continue;

      // 桌面端滑块值变更
      input.oninput = () => {
        // 更新 range-value span
        const valueSpan = input.parentElement?.querySelector('.range-value');
        if (valueSpan) valueSpan.textContent = input.value;
      };
      input.onchange = () => {
        if (!this.currentGroup) return;
        this.registry.setSliderValue(this.currentGroup, key, Number(input.value));
      };

      // 移动端按钮: 展开对应滑块面板
      const containerId = key + '-control-container';
      const mobileId = key + '-mobile';
      const container = document.getElementById(containerId);
      const mobileBtn = document.getElementById(mobileId);
      if (mobileBtn && container) {
        mobileBtn.onclick = function () {
          const mobileControls = document.getElementById('mobile-boids-controls');
          if (mobileControls) mobileControls.style.display = 'none';
          container.classList.toggle('show');
        };
      }
    }

    // 初始回显
    if (this.currentGroup) {
      this._syncSlidersToGroup(this.currentGroup);
    }
  }

  /**
   * 切换组时, 将4个滑块的值同步为该组的当前值
   * @param {string} group
   */
  _syncSlidersToGroup(group) {
    const uiValues = this.registry.getSliderUIValues(group);
    const sliderConfigs = this.registry.getSliderConfigs(group);
    for (const [key, val] of Object.entries(uiValues)) {
      const input = document.getElementById(key);
      if (input) {
        const cfg = sliderConfigs[key];
        if (cfg) {
          input.min = cfg.min;
          input.max = cfg.max;
          input.step = cfg.step;
        }
        input.value = val;
        const valueSpan = input.parentElement?.querySelector('.range-value');
        if (valueSpan) valueSpan.textContent = val;
      }
    }
  }

  // === Resize ===

  _initResizeHandler() {
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    addEventListener('resize', function () {
      const mobileControls = document.getElementById('mobile-boids-controls');
      if (!mobileControls) return;
      if (innerWidth >= 1000 && !mobile) {
        mobileControls.style.display = 'none';
      } else {
        mobileControls.style.display = 'block';
      }
    });
  }
}
