/**
 * 高斯分布生成器 (Box-Muller 变换)
 * @param {number} mean - 均值
 * @param {number} stdev - 标准差
 * @returns {function(): number} 返回一个生成器函数, 每次调用返回一个正数
 */
export function gaussian(mean, stdev) {
  let y2;
  let use_last = false;
  return function () {
    let y1;
    if (use_last) {
      y1 = y2;
      use_last = false;
    } else {
      let x1, x2, w;
      do {
        x1 = 2.0 * Math.random() - 1.0;
        x2 = 2.0 * Math.random() - 1.0;
        w = x1 * x1 + x2 * x2;
      } while (w >= 1.0);
      w = Math.sqrt((-2.0 * Math.log(w)) / w);
      y1 = x1 * w;
      y2 = x2 * w;
      use_last = true;
    }
    let retval = mean + stdev * y1;
    if (retval > 0) return retval;
    return -retval;
  };
}
