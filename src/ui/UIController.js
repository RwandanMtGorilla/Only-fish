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
    this._initRenderMode();
    this._initMobileVisibility();
    this._initMobileClosers();
    this._initCheckboxes();
    this._initAnimalSelect();
    this._initSliders();
    this._initResizeHandler();
  }

  // === 齿轮按钮 ===

  _initRenderMode() {
    const button = document.getElementById('render-mode');
    if (!button) return;
    const sync = () => {
      button.textContent = this.settings.asciiMode ? 'ASCII' : 'Original';
      button.setAttribute('aria-pressed', String(this.settings.asciiMode));
    };
    button.onclick = () => {
      this.settings.asciiMode = !this.settings.asciiMode;
      sync();
    };
    sync();
  }

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

    const sync = value => {
      this.settings[settingKey] = value;
      if (input) input.checked = value;
      if (mobile) {
        mobile.dataset.checked = String(value);
        mobile.classList.toggle('boids-checkbox-on', value);
        mobile.setAttribute('aria-pressed', String(value));
      }
    };
    sync(this.settings[settingKey] ?? defaultChecked);
    if (input) input.onchange = () => {
      sync(input.checked);
      onOff?.(input.checked);
    };
    if (mobile) mobile.onclick = () => {
      const value = !this.settings[settingKey];
      sync(value);
      onOff?.(value);
    };
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

  // Sliders and mobile buttons are generated from the selected group's schema.
  _initSliders() {
    if (this.currentGroup) this._syncSlidersToGroup(this.currentGroup);
  }

  _syncSlidersToGroup(group) {
    for (const el of document.querySelectorAll('[data-species-slider]')) el.remove();
    const host = document.getElementById('species-sliders');
    const mobileHost = document.getElementById('mobile-boids-controls');
    if (!host) return;
    const values = this.registry.getSliderUIValues(group);
    const configs = this.registry.getSliderConfigs(group);
    for (const [key, cfg] of Object.entries(configs)) {
      const container = document.createElement('div');
      container.id = key + '-control-container';
      container.className = 'boids-control boids-control-range';
      container.dataset.speciesSlider = '';
      const close = document.createElement('span');
      close.className = 'boids-control-close';
      close.onclick = () => {
        container.classList.remove('show');
        if (mobileHost) mobileHost.style.display = '';
      };
      const row = document.createElement('div');
      row.className = 'range-slider';
      const label = document.createElement('label');
      label.htmlFor = key;
      const title = document.createElement('p');
      title.textContent = cfg.label ?? key;
      label.appendChild(title);
      const input = document.createElement('input');
      Object.assign(input, { id: key, name: key, type: 'range', className: 'input-range',
        min: cfg.min, max: cfg.max, step: cfg.step, value: values[key] });
      const value = document.createElement('span');
      value.className = 'range-value';
      value.textContent = input.value;
      input.oninput = () => {
        value.textContent = input.value;
        this.registry.setSliderValue(group, key, Number(input.value));
      };
      row.append(label, input, value);
      container.append(close, row);
      host.appendChild(container);
      if (mobileHost) {
        const button = document.createElement('button');
        button.id = key + '-mobile';
        button.textContent = cfg.label ?? key;
        button.dataset.speciesSlider = '';
        button.onclick = () => {
          mobileHost.style.display = 'none';
          container.classList.add('show');
        };
        mobileHost.appendChild(button);
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
